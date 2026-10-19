import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { claimTask, claimAllTasks, getTaskBoard } from './tasks'
import { commissionSp, REFERRAL_REGISTRATION_BONUS_SP, REFERRAL_COMMISSION_BPS } from './referralRewards'
import { netUsdtString, MIN_GROSS_SP } from './withdrawals'

interface EventRow { id: number; userId: number; type: string; createdAt: Date }
interface ClaimRow { userId: number; taskKey: string; periodKey: string; xpAwarded: number }
interface ProgressRow { userId: number; xp: number; level: number }

class FakePrisma {
  events: EventRow[] = []
  claims: ClaimRow[] = []
  progress: ProgressRow[] = []
  /**
   * When set, the next taskClaim.create simulates a concurrent writer: it
   * persists the row then throws the PostgreSQL unique violation (P2002) the
   * real database would raise, exercising the service's idempotent catch path.
   */
  emitUniqueViolationOnCreate = false
  private seq = 1

  taskEvent = {
    findMany: async (args: any): Promise<EventRow[]> => {
      const w = args?.where ?? {}
      return this.events.filter(
        (e) => e.userId === w.userId && (w.createdAt?.gte === undefined || e.createdAt >= w.createdAt.gte),
      )
    },
  }

  taskClaim = {
    findMany: async (args: any): Promise<ClaimRow[]> => {
      const w = args?.where ?? {}
      const periods: string[] | undefined = w.periodKey?.in
      return this.claims.filter(
        (c) => c.userId === w.userId && (periods === undefined || periods.includes(c.periodKey)),
      )
    },
    findUnique: async (args: any): Promise<ClaimRow | null> => {
      const k = args?.where?.userId_taskKey_periodKey
      return (
        this.claims.find(
          (c) => c.userId === k.userId && c.taskKey === k.taskKey && c.periodKey === k.periodKey,
        ) ?? null
      )
    },
    create: async (args: any): Promise<ClaimRow> => {
      const d = args.data
      const row: ClaimRow = {
        userId: d.userId,
        taskKey: d.taskKey,
        periodKey: d.periodKey,
        xpAwarded: d.xpAwarded,
      }
      if (this.emitUniqueViolationOnCreate) {
        this.emitUniqueViolationOnCreate = false
        this.claims.push(row)
        const err = new Error('unique violation') as Error & { code?: string }
        err.code = 'P2002'
        throw err
      }
      this.claims.push(row)
      return row
    },
  }

  progressAccount = {
    upsert: async (args: any): Promise<ProgressRow> => {
      const userId = args.where.userId
      let row = this.progress.find((p) => p.userId === userId)
      if (!row) {
        row = { userId, xp: args.create.xp, level: 1 }
        this.progress.push(row)
      } else if (args.update.xp?.increment) {
        row.xp += args.update.xp.increment
      }
      return row
    },
    update: async (args: any): Promise<ProgressRow> => {
      const row = this.progress.find((p) => p.userId === args?.where?.userId)!
      Object.assign(row, args.data)
      return row
    },
    findUnique: async (args: any): Promise<ProgressRow | null> =>
      this.progress.find((p) => p.userId === args?.where?.userId) ?? null,
  }

  /** Advisory lock is a no-op in the fake. */
  $executeRaw = async (): Promise<number> => 1
  $transaction = async <T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T> => fn(this)
}

const asClient = (f: FakePrisma): PrismaClient => f as unknown as PrismaClient

function seedToday(f: FakePrisma, userId = 100): void {
  const now = new Date()
  const src = {
    LOGIN: 1,
    CYCLE_START: 3,
    CYCLE_COLLECT: 3,
  } as const
  for (const [type, count] of Object.entries(src)) {
    for (let i = 0; i < count; i += 1) {
      f.events.push({ id: f.events.length + 1, userId, type, createdAt: now })
    }
  }
}

test('claimTask awards XP once and reports claimed state in the returned board', async () => {
  const f = new FakePrisma()
  seedToday(f)
  const client = asClient(f)

  const first = await claimTask(client, 100, 'daily_login')
  assert.equal(first.xpAwarded, 10)
  assert.equal(first.claimed, true)
  assert.equal(first.alreadyClaimed, false)
  assert.equal(first.claimable, true)
  assert.equal(first.board.daily.find((t) => t.key === 'daily_login')!.claimed, true)

  const replay = await claimTask(client, 100, 'daily_login')
  assert.equal(replay.xpAwarded, 0)
  assert.equal(replay.claimed, false)
  assert.equal(replay.alreadyClaimed, true)
  assert.equal(replay.board.daily.find((t) => t.key === 'daily_login')!.claimed, true)

  const third = await claimTask(client, 100, 'daily_start_3')
  assert.equal(third.xpAwarded, 30)
  assert.equal(f.progress.find((p) => p.userId === 100)!.xp, 40)
  assert.equal(f.claims.length, 2)
})

test('claimTask returns 0 and claimable:false for an incomplete task', async () => {
  const f = new FakePrisma()
  f.events.push({ id: 1, userId: 100, type: 'LOGIN', createdAt: new Date() })
  const res = await claimTask(asClient(f), 100, 'daily_collect_3')
  assert.equal(res.xpAwarded, 0)
  assert.equal(res.claimable, false)
  assert.equal(res.claimed, false)
  assert.equal(f.claims.length, 0)
})

test('a concurrent duplicate claim is caught as already-claimed, never double-awarded', async () => {
  const f = new FakePrisma()
  seedToday(f)
  const client = asClient(f)

  // Simulate the win/lose race: the row is persisted by a concurrent writer and
  // our insert raises P2002 after the pre-read saw no claim.
  f.emitUniqueViolationOnCreate = true
  const result = await claimTask(client, 100, 'daily_login')

  assert.equal(result.claimed, false)
  assert.equal(result.alreadyClaimed, true)
  assert.equal(result.xpAwarded, 0)
  assert.equal(result.board.daily.find((t) => t.key === 'daily_login')!.claimed, true)
  // No XP was awarded and exactly one claim row exists.
  assert.equal(f.progress.find((p) => p.userId === 100)?.xp ?? 0, 0)
  assert.equal(f.claims.length, 1)
})

test('claimAllTasks claims every completed task once and returns the updated board', async () => {
  const f = new FakePrisma()
  seedToday(f)
  const client = asClient(f)

  const first = await claimAllTasks(client, 100)
  // 5 dailies + daily bonus + weekly_start_15 (3/15) is not complete, so:
  // dailies: login, start_1, collect_1, start_3, collect_3 = 115 XP
  // daily bonus = 50 XP; weekly_start_15 is 3/15 => not complete.
  assert.equal(first.claimed.length, 6)
  assert.equal(first.xpAwarded, 165)
  assert.equal(first.board.daily.every((t) => t.claimed), true)
  assert.equal(first.board.dailyBonus.claimed, true)
  assert.equal(first.board.weekly.every((t) => !t.claimed), true)

  const replay = await claimAllTasks(client, 100)
  assert.deepEqual(replay.claimed, [])
  assert.equal(replay.xpAwarded, 0)
  assert.equal(f.progress.find((p) => p.userId === 100)!.xp, 165)
})

test('getTaskBoard surfaces persisted claims without re-awarding', async () => {
  const f = new FakePrisma()
  seedToday(f)
  const client = asClient(f)
  await claimTask(client, 100, 'daily_login')

  const board = await getTaskBoard(client, 100)
  assert.equal(board.daily.find((t) => t.key === 'daily_login')!.claimed, true)
  assert.equal(board.daily.find((t) => t.key === 'daily_start_3')!.completed, true)
  assert.equal(board.daily.find((t) => t.key === 'daily_start_3')!.claimed, false)
  assert.equal(f.claims.length, 1)
})

test('referral commission is 10% and the registration bonus is 10 Bonus SP', () => {
  assert.equal(REFERRAL_REGISTRATION_BONUS_SP, 10n)
  assert.equal(REFERRAL_COMMISSION_BPS, 1000)
  assert.equal(commissionSp(1000n), 100n)
  assert.equal(commissionSp(999n), 99n) // floor
})

test('withdrawal net matches the approved minimum and flat fee', () => {
  assert.equal(MIN_GROSS_SP, 3000n)
  assert.equal(netUsdtString(3000n), '2.70')
  assert.equal(netUsdtString(5000n), '4.70')
})
