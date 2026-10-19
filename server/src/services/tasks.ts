import type { Prisma, PrismaClient } from '@prisma/client'
import { isUniqueViolation } from '../lib/idempotency'
import {
  computeTaskBoard,
  taskXp,
  utcDayKey,
  utcWeekKey,
  type ClaimLike,
  type TaskBoard,
  type TaskEventTypeName,
} from '../lib/tasks'
import { awardXp } from './progress'

type Tx = Prisma.TransactionClient

/** Structural view of the two delegates needed to read task state. */
type TaskReadStore = {
  taskEvent: PrismaClient['taskEvent']
  taskClaim: PrismaClient['taskClaim']
}

/** EventSink used by production/login hooks (records a task event inside a tx). */
type EventSink = Pick<Prisma.TransactionClient, 'taskEvent'>

/** Records a task event inside an existing transaction (login/start/collect hooks). */
export async function recordTaskEvent(
  tx: EventSink,
  userId: number,
  type: TaskEventTypeName,
): Promise<void> {
  await tx.taskEvent.create({ data: { userId, type } })
}

/** Records a LOGIN event once per UTC day (idempotent session bootstrap hook). */
export async function recordLogin(db: PrismaClient, userId: number): Promise<void> {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const existing = await db.taskEvent.findFirst({
    where: { userId, type: 'LOGIN', createdAt: { gte: start } },
    select: { id: true },
  })
  if (existing) return
  await db.taskEvent.create({ data: { userId, type: 'LOGIN' } })
}

const EVENT_WINDOW_DAYS = 8
/** Advisory-lock namespace that serializes all claim operations for one user. */
const CLAIM_LOCK_NAMESPACE = 21592 // 'TX'

function windowStart(now: Date): Date {
  return new Date(now.getTime() - EVENT_WINDOW_DAYS * 24 * 3600 * 1000)
}

/** Current-day and current-week period keys; claims outside these never apply. */
function currentPeriodKeys(now: Date): string[] {
  return [utcDayKey(now), utcWeekKey(now)]
}

async function loadEvents(store: TaskReadStore, userId: number, now: Date) {
  return store.taskEvent.findMany({
    where: { userId, createdAt: { gte: windowStart(now) } },
    select: { type: true, createdAt: true },
  })
}

async function loadClaims(store: TaskReadStore, userId: number, now: Date): Promise<ClaimLike[]> {
  return store.taskClaim.findMany({
    where: { userId, periodKey: { in: currentPeriodKeys(now) } },
    select: { taskKey: true, periodKey: true },
  })
}

type Candidate = {
  key: string
  xp: number
  completed: boolean
  claimed: boolean
  periodKey: string
}

function candidates(board: TaskBoard): Candidate[] {
  return [...board.daily, ...board.weekly, board.dailyBonus, board.weeklyBonus]
}

/**
 * Serializes claim writes for a single user within the current transaction.
 * Two concurrent claim requests for the same user therefore run one after the
 * other, so the second observes the first's committed claims instead of racing
 * into a unique-constraint violation.
 */
async function lockUserClaims(tx: Tx, userId: number): Promise<void> {
  // $executeRaw (not $queryRaw) avoids deserializing pg_advisory_xact_lock's
  // "void" result, which Prisma cannot map to a scalar.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CLAIM_LOCK_NAMESPACE}::int, ${userId}::int)`
}

export async function getTaskBoard(db: PrismaClient, userId: number): Promise<TaskBoard> {
  const now = new Date()
  const [events, claims] = await Promise.all([
    loadEvents(db, userId, now),
    loadClaims(db, userId, now),
  ])
  return computeTaskBoard(events, now, claims)
}

export interface ClaimResult {
  taskKey: string
  /** XP awarded by this call (0 when nothing was newly claimed). */
  xpAwarded: number
  /** True only when this call persisted a new claim. */
  claimed: boolean
  /** True when the task was already claimed for the current period. */
  alreadyClaimed: boolean
  /** True when the task is completed (regardless of prior claim). */
  claimable: boolean
  /** The task board after this call, so the client can update in one round trip. */
  board: TaskBoard
}

/**
 * Claims one completed task (or completion bonus) for its current period.
 * Atomic and idempotent: a repeat or concurrent claim never double-awards.
 */
export async function claimTask(
  db: PrismaClient,
  userId: number,
  taskKey: string,
): Promise<ClaimResult> {
  const now = new Date()
  try {
    return await db.$transaction(async (tx) => {
      await lockUserClaims(tx, userId)
      const events = await loadEvents(tx, userId, now)
      const claims = await loadClaims(tx, userId, now)
      const board = computeTaskBoard(events, now, claims)
      const task = candidates(board).find((t) => t.key === taskKey)

      if (!task || !task.completed) {
        return { taskKey, xpAwarded: 0, claimed: false, alreadyClaimed: false, claimable: false, board }
      }
      if (task.claimed) {
        return { taskKey, xpAwarded: 0, claimed: false, alreadyClaimed: true, claimable: true, board }
      }

      await tx.taskClaim.create({
        data: { userId, taskKey, periodKey: task.periodKey, xpAwarded: task.xp },
      })
      await awardXp(tx, userId, task.xp)

      const updated = computeTaskBoard(events, now, [
        ...claims,
        { taskKey, periodKey: task.periodKey },
      ])
      return { taskKey, xpAwarded: task.xp, claimed: true, alreadyClaimed: false, claimable: true, board: updated }
    })
  } catch (error) {
    // Defensive: the advisory lock should prevent this, but a unique violation
    // still means the claim already exists, so report it as already claimed.
    if (isUniqueViolation(error)) {
      return {
        taskKey,
        xpAwarded: 0,
        claimed: false,
        alreadyClaimed: true,
        claimable: true,
        board: await getTaskBoard(db, userId),
      }
    }
    throw error
  }
}

export interface ClaimAllResult {
  claimed: string[]
  xpAwarded: number
  board: TaskBoard
}

/** Claims every completed, unclaimed task and bonus for the current periods. */
export async function claimAllTasks(db: PrismaClient, userId: number): Promise<ClaimAllResult> {
  const now = new Date()
  try {
    return await db.$transaction(async (tx) => {
      await lockUserClaims(tx, userId)
      const events = await loadEvents(tx, userId, now)
      const claims = await loadClaims(tx, userId, now)
      const board = computeTaskBoard(events, now, claims)
      const pending = candidates(board).filter((t) => t.completed && !t.claimed)

      const claimed: string[] = []
      let xpAwarded = 0
      const persisted: ClaimLike[] = [...claims]
      for (const task of pending) {
        await tx.taskClaim.create({
          data: { userId, taskKey: task.key, periodKey: task.periodKey, xpAwarded: task.xp },
        })
        await awardXp(tx, userId, task.xp)
        claimed.push(task.key)
        xpAwarded += task.xp
        persisted.push({ taskKey: task.key, periodKey: task.periodKey })
      }

      return { claimed, xpAwarded, board: computeTaskBoard(events, now, persisted) }
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { claimed: [], xpAwarded: 0, board: await getTaskBoard(db, userId) }
    }
    throw error
  }
}

export { taskXp }
