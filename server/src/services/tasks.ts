import type { Prisma, PrismaClient } from '@prisma/client'
import {
  computeTaskBoard,
  taskXp,
  type TaskBoard,
  type TaskEventTypeName,
} from '../lib/tasks'
import { awardXp } from './progress'

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

function windowStart(now: Date): Date {
  return new Date(now.getTime() - EVENT_WINDOW_DAYS * 24 * 3600 * 1000)
}

export async function getTaskBoard(db: PrismaClient, userId: number): Promise<TaskBoard> {
  const now = new Date()
  const events = await db.taskEvent.findMany({
    where: { userId, createdAt: { gte: windowStart(now) } },
    select: { type: true, createdAt: true },
  })
  return computeTaskBoard(events, now)
}

interface ClaimRow {
  taskKey: string
  periodKey: string
  claimedAt: Date
}

function claimedSet(rows: ClaimRow[]): Set<string> {
  return new Set(rows.map((r) => `${r.taskKey}:${r.periodKey}`))
}

/**
 * Claims one completed task (or completion bonus) for its current period. Atomic and
 * idempotent: the `TaskClaim` unique key makes a repeat claim a no-op. Returns the XP
 * awarded (0 if not claimable).
 */
export async function claimTask(db: PrismaClient, userId: number, taskKey: string): Promise<number> {
  return db.$transaction(async (tx) => {
    const now = new Date()
    const events = await tx.taskEvent.findMany({
      where: { userId, createdAt: { gte: windowStart(now) } },
      select: { type: true, createdAt: true },
    })
    const board = computeTaskBoard(events, now)
    const candidates = [...board.daily, ...board.weekly, board.dailyBonus, board.weeklyBonus]
    const task = candidates.find((t) => t.key === taskKey)
    if (!task || !task.completed) return 0

    const existing = await tx.taskClaim.findUnique({
      where: { userId_taskKey_periodKey: { userId, taskKey, periodKey: task.periodKey } },
    })
    if (existing) return 0

    await tx.taskClaim.create({
      data: { userId, taskKey, periodKey: task.periodKey, xpAwarded: task.xp },
    })
    await awardXp(tx, userId, task.xp)
    return task.xp
  })
}

export interface ClaimAllResult {
  claimed: string[]
  xpAwarded: number
}

/** Claims every completed, unclaimed task and bonus for the current periods. */
export async function claimAllTasks(db: PrismaClient, userId: number): Promise<ClaimAllResult> {
  return db.$transaction(async (tx) => {
    const now = new Date()
    const events = await tx.taskEvent.findMany({
      where: { userId, createdAt: { gte: windowStart(now) } },
      select: { type: true, createdAt: true },
    })
    const board = computeTaskBoard(events, now)
    const existing = await tx.taskClaim.findMany({
      where: { userId },
      select: { taskKey: true, periodKey: true, claimedAt: true },
    })
    const already = claimedSet(existing)

    const candidates = [...board.daily, ...board.weekly, board.dailyBonus, board.weeklyBonus]
    const claimed: string[] = []
    let xpAwarded = 0
    for (const task of candidates) {
      if (!task.completed) continue
      if (already.has(`${task.key}:${task.periodKey}`)) continue
      await tx.taskClaim.create({
        data: { userId, taskKey: task.key, periodKey: task.periodKey, xpAwarded: task.xp },
      })
      await awardXp(tx, userId, task.xp)
      claimed.push(task.key)
      xpAwarded += task.xp
    }
    return { claimed, xpAwarded }
  })
}

export { taskXp }
