import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import {
  ReferralError,
  getPlayerReferralSummary,
  recordReferralPurchaseEvent,
  reviewReferral,
  type ReferralErrorCode,
} from './referrals'
import { invalidateSiteSettingsCache } from './siteSettings'
import { clawbackBonusSp, spendSp } from './spLedger'

type RefStatus = 'PENDING' | 'QUALIFIED' | 'REJECTED' | 'REVOKED'
type RewardStatus = 'PENDING' | 'PAID' | 'REVERSED'

interface Attr {
  id: number
  referrerId: number
  referredUserId: number
  code: string
  status: RefStatus
  eligible: boolean
  createdAt: Date
  qualifiedAt: Date | null
  reviewedBy: number | null
  reviewedAt: Date | null
  reviewNote: string | null
  signupIpHash: string | null
}
interface RewardRow {
  id: number
  referralId: number
  kind: 'REGISTRATION_BONUS' | 'PURCHASE_COMMISSION'
  status: RewardStatus
  amountSp: bigint
  currency: string
  purchaseRef: string
  paidAt: Date | null
  reversedAt: Date | null
  reason: string | null
  heldSp?: bigint
}
interface EventRow {
  id: number
  referralId: number
  referredUserId: number
  purchaseRef: string
  valueSp: bigint
  status: string
  occurredAt: Date
  metadata: unknown
}

class FakePrisma {
  users: Array<{ id: number; username: string; createdAt: Date }> = [
    { id: 1, username: 'alice', createdAt: new Date('2026-01-01T00:00:00Z') },
    { id: 2, username: 'bob', createdAt: new Date('2026-01-02T00:00:00Z') },
  ]
  attributions: Attr[] = []
  rewards: RewardRow[] = []
  events: EventRow[] = []
  audits: Array<{ actorId: number; action: string; targetType: string; targetId: string }> = []
  accounts: Array<{ userId: number; earnedSp: bigint; bonusSp: bigint; lifetimeEarnedSp: bigint; depositFundedBonusSp?: bigint; version: number }> = []
  ledger: Array<{ id: number; userId: number; bucket: string; amountSp: bigint; sourceType: string; sourceId: bigint | null; depositFundedSp?: bigint }> = []
  private seq = 1

  private username(id: number) {
    return this.users.find((u) => u.id === id)?.username ?? `#${id}`
  }

  user = {
    findUnique: async (args: any): Promise<any> => {
      const u = this.users.find((x) => x.id === args?.where?.id)
      return u ? { id: u.id, username: u.username, createdAt: u.createdAt } : null
    },
  }

  appMeta = {
    findMany: async (): Promise<Array<{ key: string; value: string }>> => [],
  }

  referralAttribution = {
    findUnique: async (args: any): Promise<Attr | null> => {
      const w = args?.where ?? {}
      if (w.id !== undefined) return this.attributions.find((a) => a.id === w.id) ?? null
      if (w.referredUserId !== undefined) return this.attributions.find((a) => a.referredUserId === w.referredUserId) ?? null
      return null
    },
    findUniqueOrThrow: async (args: any): Promise<Attr> => {
      const row = this.attributions.find((a) => a.id === args?.where?.id)
      if (!row) throw new Error('not found')
      return row
    },
    findMany: async (args: any): Promise<any[]> => {
      const w = args?.where ?? {}
      let rows = this.attributions.filter((a) => w.referrerId === undefined || a.referrerId === w.referrerId)
      if (args?.include?.referredUser) {
        rows = rows.map((a) => ({ ...a, referredUser: { username: this.username(a.referredUserId), createdAt: new Date() } })) as unknown as Attr[]
        if (args?.include?.rewards) {
          rows = rows.map((a) => ({
            ...a,
            rewards: this.rewards.filter((r) => r.referralId === (a as Attr).id).map((r) => ({ kind: r.kind, status: r.status, amountSp: r.amountSp, heldSp: r.heldSp ?? 0n, currency: r.currency, purchaseRef: r.purchaseRef, createdAt: new Date(), reversedAt: r.reversedAt })),
          })) as unknown as Attr[]
        }
      }
      return rows
    },
    updateMany: async (args: any): Promise<{ count: number }> => {
      const w = args.where
      const row = this.attributions.find((a) => a.id === w.id)
      if (!row) return { count: 0 }
      if (w.status !== undefined && row.status !== w.status) return { count: 0 }
      Object.assign(row, args.data)
      return { count: 1 }
    },
    update: async (args: any): Promise<Attr> => {
      const row = this.attributions.find((a) => a.id === args?.where?.id)!
      Object.assign(row, args.data)
      return row
    },
  }

  referralReward = {
    upsert: async (args: any): Promise<RewardRow> => {
      const k = args.where.referralId_kind_purchaseRef
      let row = this.rewards.find((r) => r.referralId === k.referralId && r.kind === k.kind && r.purchaseRef === k.purchaseRef)
      if (!row) {
        const d = args.create
        row = {
          id: this.seq++,
          referralId: d.referralId,
          kind: d.kind,
          status: 'PENDING',
          amountSp: d.amountSp,
          currency: d.currency,
          purchaseRef: d.purchaseRef ?? '',
          paidAt: null,
          reversedAt: null,
          reason: null,
        }
        this.rewards.push(row)
      }
      return row
    },
    update: async (args: any): Promise<RewardRow> => {
      const row = this.rewards.find((r) => r.id === args?.where?.id)!
      Object.assign(row, args.data)
      return row
    },
    updateMany: async (args: any): Promise<{ count: number }> => {
      const w = args.where
      const rows = this.rewards.filter(
        (r) =>
          (w.referralId === undefined || r.referralId === w.referralId) &&
          (w.kind === undefined || r.kind === w.kind) &&
          (w.purchaseRef === undefined || r.purchaseRef === w.purchaseRef) &&
          (w.status === undefined || (typeof w.status === 'object' ? r.status !== w.status.not : r.status === w.status)),
      )
      for (const r of rows) Object.assign(r, args.data)
      return { count: rows.length }
    },
    findUnique: async (args: any): Promise<RewardRow | null> => {
      const k = args?.where?.referralId_kind_purchaseRef
      if (!k) return null
      return (
        this.rewards.find(
          (r) => r.referralId === k.referralId && r.kind === k.kind && r.purchaseRef === k.purchaseRef,
        ) ?? null
      )
    },
    findMany: async (args: any): Promise<any[]> => {
      const refFilter = args?.where?.referral
      const status = args?.where?.status
      let rows = this.rewards.filter((r) => {
        if (refFilter?.referrerId !== undefined) {
          const attr = this.attributions.find((a) => a.id === r.referralId)
          if (!attr || attr.referrerId !== refFilter.referrerId) return false
        }
        if (status !== undefined && r.status !== status) return false
        return true
      })
      if (args?.include?.referral) {
        rows = rows.map((r) => {
          const attr = this.attributions.find((a) => a.id === r.referralId)!
          return {
            ...r,
            referral: {
              code: attr.code,
              referrer: { username: this.username(attr.referrerId) },
              referredUser: { username: this.username(attr.referredUserId) },
            },
          }
        }) as unknown as RewardRow[]
      }
      return rows
    },
  }

  referralPurchaseEvent = {
    findUnique: async (args: any): Promise<EventRow | null> =>
      this.events.find((e) => e.purchaseRef === args?.where?.purchaseRef) ?? null,
    create: async (args: any): Promise<EventRow> => {
      const d = args.data
      const row: EventRow = { id: this.seq++, ...d }
      this.events.push(row)
      return row
    },
    update: async (args: any): Promise<EventRow> => {
      const row = this.events.find((e) => e.purchaseRef === args?.where?.purchaseRef)!
      Object.assign(row, args.data)
      return row
    },
    count: async (args: any): Promise<number> => {
      const w = args?.where ?? {}
      return this.events.filter(
        (e) =>
          (w.referralId === undefined || e.referralId === w.referralId) &&
          (w.status === undefined || e.status === w.status) &&
          (w.purchaseRef?.not === undefined || e.purchaseRef !== w.purchaseRef.not),
      ).length
    },
  }

  adminAuditLog = {
    create: async (args: any): Promise<unknown> => {
      const d = args.data
      this.audits.push({ actorId: d.actorId, action: d.action, targetType: d.targetType, targetId: d.targetId })
      return { id: this.seq++ }
    },
  }

  spAccount = {
    findUnique: async (args: any) => this.accounts.find((a) => a.userId === args?.where?.userId) ?? null,
    findUniqueOrThrow: async (args: any) => this.accounts.find((a) => a.userId === args?.where?.userId)!,
    upsert: async (args: any) => {
      const userId = args.where.userId
      let row = this.accounts.find((a) => a.userId === userId)
      if (!row) {
        row = {
          userId,
          earnedSp: args.create.earnedSp ?? 0n,
          bonusSp: args.create.bonusSp ?? 0n,
          lifetimeEarnedSp: args.create.lifetimeEarnedSp ?? 0n,
          depositFundedBonusSp: args.create.depositFundedBonusSp ?? 0n,
          version: 0,
        }
        this.accounts.push(row)
      } else {
        if (args.update.bonusSp?.increment) row.bonusSp += BigInt(args.update.bonusSp.increment)
        if (args.update.earnedSp?.increment) row.earnedSp += BigInt(args.update.earnedSp.increment)
        if (args.update.lifetimeEarnedSp?.increment) row.lifetimeEarnedSp += BigInt(args.update.lifetimeEarnedSp.increment)
        if (args.update.depositFundedBonusSp?.increment) {
          row.depositFundedBonusSp = (row.depositFundedBonusSp ?? 0n) + BigInt(args.update.depositFundedBonusSp.increment)
        }
      }
      return row
    },
    updateMany: async (args: any): Promise<{ count: number }> => {
      const row = this.accounts.find((a) => a.userId === args?.where?.userId)
      if (!row) return { count: 0 }
      const minBonus = args.where.bonusSp?.gte
      if (minBonus !== undefined && row.bonusSp < minBonus) return { count: 0 }
      const minEarned = args.where.earnedSp?.gte
      if (minEarned !== undefined && row.earnedSp < minEarned) return { count: 0 }
      const minDeposit = args.where.depositFundedBonusSp?.gte
      if (minDeposit !== undefined && (row.depositFundedBonusSp ?? 0n) < minDeposit) return { count: 0 }
      if (args.data.bonusSp?.decrement) row.bonusSp -= BigInt(args.data.bonusSp.decrement)
      if (args.data.earnedSp?.decrement) row.earnedSp -= BigInt(args.data.earnedSp.decrement)
      if (args.data.depositFundedBonusSp?.decrement) {
        row.depositFundedBonusSp = (row.depositFundedBonusSp ?? 0n) - BigInt(args.data.depositFundedBonusSp.decrement)
      }
      return { count: 1 }
    },
  }

  spLedgerEntry = {
    create: async (args: any) => {
      const d = args.data
      if (d.sourceId != null && this.ledger.some((l) => l.userId === d.userId && l.sourceType === d.sourceType && l.sourceId === d.sourceId && l.bucket === d.bucket)) {
        const err = new Error('unique violation') as Error & { code?: string }
        err.code = 'P2002'
        throw err
      }
      const row = { id: this.seq++, userId: d.userId, bucket: d.bucket, amountSp: d.amountSp, sourceType: d.sourceType, sourceId: d.sourceId ?? null }
      this.ledger.push(row)
      return row
    },
  }

  $transaction = async <T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T> => fn(this)
}

const withRewards = async (fn: () => Promise<void>): Promise<void> => {
  const saved = process.env.REFERRAL_REWARDS_ENABLED
  process.env.REFERRAL_REWARDS_ENABLED = 'true'
  invalidateSiteSettingsCache()
  try {
    await fn()
  } finally {
    if (saved === undefined) delete process.env.REFERRAL_REWARDS_ENABLED
    else process.env.REFERRAL_REWARDS_ENABLED = saved
    invalidateSiteSettingsCache()
  }
}

const asClient = (f: FakePrisma): PrismaClient => f as unknown as PrismaClient

function seedReferral(f: FakePrisma, status: RefStatus = 'PENDING'): Attr {
  const row: Attr = {
    id: 1,
    referrerId: 1,
    referredUserId: 2,
    code: 'alice',
    status,
    eligible: status === 'QUALIFIED',
    createdAt: new Date('2026-01-03T00:00:00Z'),
    qualifiedAt: status === 'QUALIFIED' ? new Date('2026-01-04T00:00:00Z') : null,
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    signupIpHash: null,
  }
  f.attributions.push(row)
  return row
}

function expectCode(code: ReferralErrorCode) {
  return (error: unknown) => {
    assert.ok(error instanceof ReferralError, `expected ReferralError, got ${String(error)}`)
    assert.equal((error as ReferralError).code, code)
    return true
  }
}

test.beforeEach(() => invalidateSiteSettingsCache())

test('reviewReferral requires confirmation', async () => {
  const f = new FakePrisma()
  seedReferral(f)
  await assert.rejects(
    () => reviewReferral(asClient(f), 9, 1, 'QUALIFY', undefined, false),
    expectCode('confirmation_required'),
  )
})

test('QUALIFY creates one registration-bonus reward (pending, rewards disabled) and audits', async () => {
  const f = new FakePrisma()
  seedReferral(f)
  await reviewReferral(asClient(f), 9, 1, 'QUALIFY', 'looks good', true)

  assert.equal(f.attributions[0].status, 'QUALIFIED')
  assert.equal(f.rewards.length, 1)
  assert.equal(f.rewards[0].kind, 'REGISTRATION_BONUS')
  assert.equal(f.rewards[0].status, 'PENDING')
  assert.equal(f.rewards[0].amountSp, 10n)
  assert.equal(f.audits.at(-1)?.action, 'referral.qualify')

  await assert.rejects(
    () => reviewReferral(asClient(f), 9, 1, 'QUALIFY', undefined, true),
    expectCode('invalid_state'),
  )
  assert.equal(f.rewards.length, 1)
})

test('concurrent QUALIFY persists exactly one reward', async () => {
  const f = new FakePrisma()
  seedReferral(f)
  const results = await Promise.allSettled([
    reviewReferral(asClient(f), 9, 1, 'QUALIFY', undefined, true),
    reviewReferral(asClient(f), 9, 1, 'QUALIFY', undefined, true),
  ])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(f.rewards.length, 1)
})

test('REVOKE reverses pending rewards', async () => {
  const f = new FakePrisma()
  seedReferral(f, 'QUALIFIED')
  f.rewards.push({ id: 5, referralId: 1, kind: 'REGISTRATION_BONUS', status: 'PENDING', amountSp: 10n, currency: 'BONUS_SP', purchaseRef: '', paidAt: null, reversedAt: null, reason: null })
  await reviewReferral(asClient(f), 9, 1, 'REVOKE', 'abuse', true)
  assert.equal(f.attributions[0].status, 'REVOKED')
  assert.equal(f.rewards[0].status, 'REVERSED')
})

test('purchase events are ignored for non-referred users', async () => {
  const f = new FakePrisma()
  const result = await recordReferralPurchaseEvent(asClient(f), {
    purchaseRef: 'p1',
    referredUserId: 999,
    valueSp: 10000n,
    depositFundedSp: 10000n,
    status: 'SETTLED',
    occurredAt: new Date(),
  })
  assert.equal(result.ignored, true)
  assert.equal(result.reason, 'not_referred')
})

test('a settled purchase records a 10% commission reward (pending, rewards disabled)', async () => {
  const f = new FakePrisma()
  seedReferral(f, 'QUALIFIED')
  const result = await recordReferralPurchaseEvent(asClient(f), {
    purchaseRef: 'pay_1',
    referredUserId: 2,
    valueSp: 10000n,
    depositFundedSp: 10000n,
    status: 'SETTLED',
    occurredAt: new Date('2026-01-05T00:00:00Z'),
  })
  assert.equal(result.ignored, false)
  assert.equal(result.commissionSp, '1000')
  assert.equal(f.rewards.length, 1)
  assert.equal(f.rewards[0].kind, 'PURCHASE_COMMISSION')
  assert.equal(f.rewards[0].status, 'PENDING')
  assert.equal(f.rewards[0].amountSp, 1000n)
})

test('duplicate payment events do not double-record a commission', async () => {
  const f = new FakePrisma()
  seedReferral(f, 'QUALIFIED')
  const input = { purchaseRef: 'pay_2', referredUserId: 2, valueSp: 5000n, depositFundedSp: 5000n, status: 'SETTLED' as const, occurredAt: new Date() }
  await recordReferralPurchaseEvent(asClient(f), input)
  const again = await recordReferralPurchaseEvent(asClient(f), input)
  assert.equal(again.ignored, true)
  assert.equal(again.reason, 'duplicate')
  assert.equal(f.rewards.length, 1)
  assert.equal(f.events.length, 1)
})

test('refunds and chargebacks reverse a recorded commission', async () => {
  const f = new FakePrisma()
  seedReferral(f, 'QUALIFIED')
  await recordReferralPurchaseEvent(asClient(f), { purchaseRef: 'pay_3', referredUserId: 2, valueSp: 20000n, depositFundedSp: 20000n, status: 'SETTLED', occurredAt: new Date() })
  assert.equal(f.rewards[0].status, 'PENDING')

  await recordReferralPurchaseEvent(asClient(f), { purchaseRef: 'pay_3', referredUserId: 2, valueSp: 20000n, depositFundedSp: 20000n, status: 'REFUNDED', occurredAt: new Date() })
  assert.equal(f.rewards[0].status, 'REVERSED')
  assert.equal(f.rewards.length, 1)
})

test('failed payments never earn a commission', async () => {
  const f = new FakePrisma()
  seedReferral(f, 'QUALIFIED')
  const result = await recordReferralPurchaseEvent(asClient(f), {
    purchaseRef: 'pay_4',
    referredUserId: 2,
    valueSp: 10000n,
    depositFundedSp: 10000n,
    status: 'FAILED',
    occurredAt: new Date(),
  })
  assert.equal(result.ignored, true)
  assert.equal(result.reason, 'non_earning')
  assert.equal(f.rewards.length, 0)
})

test('a rejected referral is never resurrected by a purchase', async () => {
  const f = new FakePrisma()
  seedReferral(f, 'REJECTED')
  const result = await recordReferralPurchaseEvent(asClient(f), {
    purchaseRef: 'pay_5',
    referredUserId: 2,
    valueSp: 10000n,
    depositFundedSp: 10000n,
    status: 'SETTLED',
    occurredAt: new Date(),
  })
  assert.equal(result.ignored, true)
  assert.equal(result.reason, 'not_qualified')
  assert.equal(f.attributions[0].status, 'REJECTED')
  assert.equal(f.rewards.length, 0)
})

test('commission is computed on the deposit-funded portion only', async () => {
  const f = new FakePrisma()
  seedReferral(f, 'QUALIFIED')
  // 10,000 SP purchase, but only 4,000 SP came from confirmed deposits.
  const result = await recordReferralPurchaseEvent(asClient(f), {
    purchaseRef: 'pay_mix',
    referredUserId: 2,
    valueSp: 10000n,
    depositFundedSp: 4000n,
    status: 'SETTLED',
    occurredAt: new Date(),
  })
  assert.equal(result.commissionSp, '400')
  assert.equal(f.rewards[0].kind, 'PURCHASE_COMMISSION')
  assert.equal(f.rewards[0].amountSp, 400n)
})

test('a fully non-deposit (promotional) purchase earns no commission', async () => {
  const f = new FakePrisma()
  seedReferral(f, 'QUALIFIED')
  const result = await recordReferralPurchaseEvent(asClient(f), {
    purchaseRef: 'pay_free',
    referredUserId: 2,
    valueSp: 10000n,
    depositFundedSp: 0n,
    status: 'SETTLED',
    occurredAt: new Date(),
  })
  assert.equal(result.commissionSp, '0')
  assert.equal(f.rewards.filter((r) => r.kind === 'PURCHASE_COMMISSION').length, 0)
})

test('the FIRST eligible settled purchase auto-qualifies the referral (once)', async () => {
  await withRewards(async () => {
    const f = new FakePrisma()
    seedReferral(f, 'PENDING')
    const first = await recordReferralPurchaseEvent(asClient(f), {
      purchaseRef: 'pay_q1',
      referredUserId: 2,
      valueSp: 10000n,
      depositFundedSp: 10000n,
      status: 'SETTLED',
      occurredAt: new Date(),
    })
    assert.equal(first.qualifiedNow, true)
    assert.equal(f.attributions[0].status, 'QUALIFIED')
    const bonus = f.rewards.find((r) => r.kind === 'REGISTRATION_BONUS')!
    assert.equal(bonus.status, 'PAID')
    assert.equal(bonus.amountSp, 10n)
    assert.equal(f.accounts.find((a) => a.userId === 1)!.bonusSp, 10n + 1000n)
    assert.equal(f.ledger.filter((l) => l.sourceType === 'REFERRAL_REWARD').length, 2)

    await recordReferralPurchaseEvent(asClient(f), {
      purchaseRef: 'pay_q2',
      referredUserId: 2,
      valueSp: 5000n,
      depositFundedSp: 5000n,
      status: 'SETTLED',
      occurredAt: new Date(),
    })
    assert.equal(f.rewards.filter((r) => r.kind === 'REGISTRATION_BONUS').length, 1)
  })
})

test('repeated eligible purchases earn recurring commission', async () => {
  await withRewards(async () => {
    const f = new FakePrisma()
    seedReferral(f, 'QUALIFIED')
    await recordReferralPurchaseEvent(asClient(f), { purchaseRef: 'r1', referredUserId: 2, valueSp: 10000n, depositFundedSp: 10000n, status: 'SETTLED', occurredAt: new Date() })
    await recordReferralPurchaseEvent(asClient(f), { purchaseRef: 'r2', referredUserId: 2, valueSp: 20000n, depositFundedSp: 20000n, status: 'SETTLED', occurredAt: new Date() })
    const commissions = f.rewards.filter((r) => r.kind === 'PURCHASE_COMMISSION')
    assert.equal(commissions.length, 2)
    assert.equal(f.accounts.find((a) => a.userId === 1)!.bonusSp, 3000n)
  })
})

test('enabling rewards credits the registration bonus exactly once', async () => {
  await withRewards(async () => {
    const f = new FakePrisma()
    seedReferral(f)
    await reviewReferral(asClient(f), 9, 1, 'QUALIFY', undefined, true)

    assert.equal(f.rewards[0].status, 'PAID')
    assert.equal(f.accounts.find((a) => a.userId === 1)!.bonusSp, 10n)
    assert.equal(f.ledger.filter((l) => l.sourceType === 'REFERRAL_REWARD').length, 1)

    await assert.rejects(
      () => reviewReferral(asClient(f), 9, 1, 'QUALIFY', undefined, true),
      expectCode('invalid_state'),
    )
    assert.equal(f.accounts.find((a) => a.userId === 1)!.bonusSp, 10n)
    assert.equal(f.ledger.filter((l) => l.sourceType === 'REFERRAL_REWARD').length, 1)
  })
})

test('enabling rewards credits a purchase commission exactly once and is replay-safe', async () => {
  await withRewards(async () => {
    const f = new FakePrisma()
    seedReferral(f, 'QUALIFIED')
    const input = { purchaseRef: 'pay_on', referredUserId: 2, valueSp: 10000n, depositFundedSp: 10000n, status: 'SETTLED' as const, occurredAt: new Date() }
    const first = await recordReferralPurchaseEvent(asClient(f), input)
    assert.equal(first.commissionSp, '1000')
    assert.equal(f.rewards[0].status, 'PAID')
    assert.equal(f.accounts.find((a) => a.userId === 1)!.bonusSp, 1000n)
    assert.equal(f.ledger.filter((l) => l.sourceType === 'REFERRAL_REWARD').length, 1)

    const replay = await recordReferralPurchaseEvent(asClient(f), input)
    assert.equal(replay.reason, 'duplicate')
    assert.equal(f.accounts.find((a) => a.userId === 1)!.bonusSp, 1000n)
    assert.equal(f.ledger.filter((l) => l.sourceType === 'REFERRAL_REWARD').length, 1)
  })
})

test('a refund after payout reverses the commission and claws back Bonus-only', async () => {
  await withRewards(async () => {
    const f = new FakePrisma()
    seedReferral(f, 'QUALIFIED')
    f.accounts.push({ userId: 1, earnedSp: 5000n, bonusSp: 1000n, lifetimeEarnedSp: 5000n, depositFundedBonusSp: 1000n, version: 0 })
    await recordReferralPurchaseEvent(asClient(f), { purchaseRef: 'pay_rf', referredUserId: 2, valueSp: 10000n, depositFundedSp: 10000n, status: 'SETTLED', occurredAt: new Date() })
    const commission = f.rewards.find((r) => r.kind === 'PURCHASE_COMMISSION')!
    assert.equal(commission.status, 'PAID')
    assert.equal(f.accounts[0].bonusSp, 2000n)

    await recordReferralPurchaseEvent(asClient(f), { purchaseRef: 'pay_rf', referredUserId: 2, valueSp: 10000n, depositFundedSp: 10000n, status: 'REFUNDED', occurredAt: new Date() })
    assert.equal(commission.status, 'REVERSED')
    assert.equal(commission.heldSp, 0n)
    assert.equal(f.accounts[0].bonusSp, 1000n)
    assert.equal(f.accounts[0].earnedSp, 5000n)
    assert.equal(f.ledger.filter((l) => l.sourceType === 'REFERRAL_REVERSAL').length, 1)

    // Reversing again is idempotent (no second clawback).
    await recordReferralPurchaseEvent(asClient(f), { purchaseRef: 'pay_rf', referredUserId: 2, valueSp: 10000n, depositFundedSp: 10000n, status: 'REFUNDED', occurredAt: new Date() })
    assert.equal(f.ledger.filter((l) => l.sourceType === 'REFERRAL_REVERSAL').length, 1)
  })
})

test('spent-bonus reversal holds the shortfall and never deducts Earned SP', async () => {
  await withRewards(async () => {
    const f = new FakePrisma()
    seedReferral(f, 'QUALIFIED')
    await recordReferralPurchaseEvent(asClient(f), { purchaseRef: 'pay_h', referredUserId: 2, valueSp: 10000n, depositFundedSp: 10000n, status: 'SETTLED', occurredAt: new Date() })
    const commission = f.rewards.find((r) => r.kind === 'PURCHASE_COMMISSION')!
    assert.equal(commission.status, 'PAID')
    // The referrer already spent the commission; only 400 Bonus SP remains.
    f.accounts[0].bonusSp = 400n
    f.accounts[0].depositFundedBonusSp = 0n
    const earnedBefore = f.accounts[0].earnedSp

    await recordReferralPurchaseEvent(asClient(f), { purchaseRef: 'pay_h', referredUserId: 2, valueSp: 10000n, depositFundedSp: 10000n, status: 'REFUNDED', occurredAt: new Date() })
    assert.equal(commission.status, 'REVERSED')
    assert.equal(commission.heldSp, 600n)
    assert.equal(f.accounts[0].bonusSp, 0n)
    assert.equal(f.accounts[0].earnedSp, earnedBefore)
  })
})

test('refunding the qualifying purchase invalidates qualification and its reward', async () => {
  await withRewards(async () => {
    const f = new FakePrisma()
    seedReferral(f, 'PENDING')
    await recordReferralPurchaseEvent(asClient(f), { purchaseRef: 'pay_q', referredUserId: 2, valueSp: 10000n, depositFundedSp: 10000n, status: 'SETTLED', occurredAt: new Date() })
    assert.equal(f.attributions[0].status, 'QUALIFIED')
    const bonus = f.rewards.find((r) => r.kind === 'REGISTRATION_BONUS')!
    assert.equal(bonus.status, 'PAID')

    await recordReferralPurchaseEvent(asClient(f), { purchaseRef: 'pay_q', referredUserId: 2, valueSp: 10000n, depositFundedSp: 10000n, status: 'REFUNDED', occurredAt: new Date() })
    assert.equal(bonus.status, 'REVERSED')
    assert.equal(f.attributions[0].status, 'PENDING')
    assert.equal(f.attributions[0].qualifiedAt, null)
  })
})

test('player summary exposes code, link, totals and pending rewards', async () => {
  const f = new FakePrisma()
  seedReferral(f, 'QUALIFIED')
  f.rewards.push({ id: 5, referralId: 1, kind: 'REGISTRATION_BONUS', status: 'PENDING', amountSp: 10n, currency: 'BONUS_SP', purchaseRef: '', paidAt: null, reversedAt: null, reason: null })

  const summary = await getPlayerReferralSummary(asClient(f), 1)
  assert.equal(summary.code, 'alice')
  assert.equal(summary.link, '/?ref=alice')
  assert.equal(summary.total, 1)
  assert.equal(summary.qualified, 1)
  assert.equal(summary.pendingRewardsSp, '10')
  assert.equal(summary.rewardsEnabled, false)
  assert.equal(summary.registrationBonusSp, '10')
  assert.equal(summary.commissionPercent, '10')
  assert.equal(summary.history[0].referredUsername, 'bob')
})

test('spendSp consumes deposit-funded Bonus SP first (deterministic provenance)', async () => {
  const f = new FakePrisma()
  f.accounts.push({ userId: 1, earnedSp: 5000n, bonusSp: 10000n, lifetimeEarnedSp: 5000n, depositFundedBonusSp: 6000n, version: 0 })
  const res = await spendSp(asClient(f), { userId: 1, amountSp: 8000n, sourceType: 'CEO_PURCHASE' })
  assert.equal(res.bonusDebit, 8000n)
  assert.equal(res.earnedDebit, 0n)
  assert.equal(res.depositFundedDebit, 6000n)
  assert.equal(f.accounts[0].bonusSp, 2000n)
  assert.equal(f.accounts[0].depositFundedBonusSp, 0n)
})

test('mixed funding: Earned SP and non-deposit Bonus SP are not commissionable', async () => {
  const f = new FakePrisma()
  f.accounts.push({ userId: 1, earnedSp: 5000n, bonusSp: 6000n, lifetimeEarnedSp: 5000n, depositFundedBonusSp: 6000n, version: 0 })
  const res = await spendSp(asClient(f), { userId: 1, amountSp: 10000n, sourceType: 'CEO_PURCHASE' })
  assert.equal(res.bonusDebit, 6000n)
  assert.equal(res.earnedDebit, 4000n)
  assert.equal(res.depositFundedDebit, 6000n)
  assert.equal(f.accounts[0].earnedSp, 1000n)
})

test('clawbackBonusSp never touches Earned SP and recovers deposit-funded last', async () => {
  const f = new FakePrisma()
  f.accounts.push({ userId: 1, earnedSp: 7000n, bonusSp: 500n, lifetimeEarnedSp: 7000n, depositFundedBonusSp: 500n, version: 0 })
  const res = await clawbackBonusSp(asClient(f), { userId: 1, amountSp: 1000n, sourceId: 99n })
  assert.equal(res.recovered, 500n)
  assert.equal(res.held, 500n)
  assert.equal(f.accounts[0].earnedSp, 7000n)
  assert.equal(f.accounts[0].bonusSp, 0n)
  assert.equal(f.accounts[0].depositFundedBonusSp, 0n)
  assert.equal(f.ledger.filter((l) => l.sourceType === 'REFERRAL_REVERSAL').length, 1)
})
