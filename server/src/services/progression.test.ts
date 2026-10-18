import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { claimTask } from './tasks'
import { commissionSp, REFERRAL_REGISTRATION_BONUS_SP, REFERRAL_COMMISSION_BPS } from './referralRewards'
import { netUsdtString, MIN_GROSS_SP } from './withdrawals'

interface EventRow { id: number; userId: number; type: string; createdAt: Date }
interface ClaimRow { userId: number; taskKey: string; periodKey: string; xpAwarded: number }
interface ProgressRow { userId: number; xp: number; level: number }

class FakePrisma {
  events: EventRow[] = []
  claims: ClaimRow[] = []
  progress: ProgressRow[] = []
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

test('claimTask awards XP once and is idempotent per period', async () => {
  const f = new FakePrisma()
  seedToday(f)
  const client = asClient(f)
  assert.equal(await claimTask(client, 100, 'daily_login'), 10)
  assert.equal(await claimTask(client, 100, 'daily_login'), 0) // same period, replay
  assert.equal(await claimTask(client, 100, 'daily_start_3'), 30)
  assert.equal(f.progress.find((p) => p.userId === 100)!.xp, 40)
  assert.equal(f.claims.length, 2)
})

test('claimTask returns 0 for an incomplete task', async () => {
  const f = new FakePrisma()
  f.events.push({ id: 1, userId: 100, type: 'LOGIN', createdAt: new Date() })
  assert.equal(await claimTask(asClient(f), 100, 'daily_collect_3'), 0)
  assert.equal(f.claims.length, 0)
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
