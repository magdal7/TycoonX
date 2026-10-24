import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import {
  WithdrawalError,
  createWithdrawalRequest,
  executeWithdrawalPayout,
  isUncertainPayoutError,
  processPayoutWebhook,
  reconcileWithdrawalPayout,
  resolveUncertainPayoutSubmission,
  reviewWithdrawal,
  setWithdrawalWallet,
  walletHoldMs,
} from './withdrawals'
import { OxapayError, type OxapayConfig, type OxapayFetch, type OxapayFetchResponse } from './oxapay'
import { minPayoutUsdt } from '../lib/payments'

// New-request guard defaults to requiring payout operations to be available;
// individual tests that exercise the disabled path delete this explicitly.
process.env.PAYOUTS_ENABLED = 'true'

interface WithdrawalRow {
  id: number
  userId: number
  grossSp: bigint
  feeUsdt: string
  netUsdt: string
  address: string
  network: string
  status: string
  note: string | null
  reviewedBy: number | null
  reviewedAt: Date | null
  payoutTrackId?: string | null
  paidAt?: Date | null
  createdAt: Date
  updatedAt: Date
}
interface IntentRow {
  id: number
  userId: number
  provider: string
  externalId: string
  amountUsdt: unknown
  status: string
  purpose: string
  payAddress: string | null
  metadata: unknown
  confirmedAt: Date | null
}
interface EventRow {
  id: number
  provider: string
  eventId: string
  paymentIntentId: number | null
  status: string
  payload: unknown
  processedAt: Date | null
}
interface SpAcct { userId: number; earnedSp: bigint; bonusSp: bigint; lifetimeEarnedSp: bigint; version: number }

function uniqueViolation(): never {
  const err = new Error('unique violation') as Error & { code?: string }
  err.code = 'P2002'
  throw err
}

interface UserRow {
  id: number
  withdrawalWallet: string | null
  withdrawalWalletChangedAt: Date | null
}

class FakePrisma {
  withdrawals: WithdrawalRow[] = []
  intents: IntentRow[] = []
  events: EventRow[] = []
  accounts: SpAcct[] = []
  users: UserRow[] = []
  ledger: Array<{ id: number; userId: number; bucket: string; amountSp: bigint; sourceType: string; sourceId: bigint | null }> = []
  audits: Array<Record<string, unknown>> = []
  seq = 1

  user = {
    findUnique: async (args: any): Promise<UserRow | null> =>
      this.users.find((u) => u.id === args?.where?.id) ?? null,
    update: async (args: any): Promise<UserRow> => {
      const row = this.users.find((u) => u.id === args?.where?.id)!
      Object.assign(row, args.data)
      return row
    },
  }

  private matchesIntent(i: IntentRow, w: any): boolean {
    if (w.id !== undefined && i.id !== w.id) return false
    if (w.externalId !== undefined && i.externalId !== w.externalId) return false
    if (w.purpose !== undefined && i.purpose !== w.purpose) return false
    const path = w.metadata?.path
    if (path) {
      const value = (i.metadata as Record<string, unknown> | null)?.[path[0]]
      if (value !== w.metadata.equals) return false
    }
    return true
  }

  paymentIntent = {
    create: async (args: any): Promise<IntentRow> => {
      const d = args.data
      if (this.intents.some((i) => i.externalId === d.externalId)) uniqueViolation()
      const row: IntentRow = {
        id: this.seq++,
        userId: d.userId,
        provider: d.provider,
        externalId: d.externalId,
        amountUsdt: d.amountUsdt,
        status: d.status ?? 'CREATED',
        purpose: d.purpose ?? 'deposit',
        payAddress: d.payAddress ?? null,
        metadata: d.metadata ?? null,
        confirmedAt: null,
      }
      this.intents.push(row)
      return row
    },
    findUnique: async (args: any): Promise<IntentRow | null> =>
      this.intents.find((i) => this.matchesIntent(i, args?.where ?? {})) ?? null,
    findFirst: async (args: any): Promise<IntentRow | null> =>
      this.intents.find((i) => this.matchesIntent(i, args?.where ?? {})) ?? null,
    update: async (args: any): Promise<IntentRow> => {
      const row = this.intents.find((i) => i.id === args?.where?.id)!
      Object.assign(row, args.data)
      return row
    },
    delete: async (args: any): Promise<IntentRow> => {
      const idx = this.intents.findIndex((i) => i.id === args?.where?.id)
      const [row] = this.intents.splice(idx, 1)
      return row
    },
  }

  withdrawalRequest = {
    findUnique: async (args: any): Promise<WithdrawalRow | null> =>
      this.withdrawals.find((w) => w.id === args?.where?.id) ?? null,
    findFirst: async (args: any): Promise<WithdrawalRow | null> => {
      const w = args?.where ?? {}
      let rows = this.withdrawals.filter((r) => {
        if (w.userId !== undefined && r.userId !== w.userId) return false
        if (typeof w.status === 'string' && r.status !== w.status) return false
        if (w.status?.in && !w.status.in.includes(r.status)) return false
        return true
      })
      if (args?.orderBy?.updatedAt === 'desc') rows = rows.slice().sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      return rows[0] ?? null
    },
    create: async (args: any): Promise<WithdrawalRow> => {
      const d = args.data
      const row: WithdrawalRow = {
        id: this.seq++,
        userId: d.userId,
        grossSp: d.grossSp,
        feeUsdt: String(d.feeUsdt),
        netUsdt: String(d.netUsdt),
        address: d.address,
        network: d.network,
        status: d.status ?? 'REQUESTED',
        note: null,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      this.withdrawals.push(row)
      return row
    },
    updateMany: async (args: any): Promise<{ count: number }> => {
      const w = args.where
      const rows = this.withdrawals.filter((r) => r.id === w.id && (w.status === undefined || r.status === w.status))
      for (const r of rows) Object.assign(r, args.data, { updatedAt: new Date() })
      return { count: rows.length }
    },
    findMany: async (args: any): Promise<WithdrawalRow[]> =>
      this.withdrawals.filter((r) => args?.where?.userId === undefined || r.userId === args.where.userId),
  }

  paymentWebhookEvent = {
    create: async (args: any): Promise<{ id: number }> => {
      const d = args.data
      if (this.events.some((e) => e.provider === d.provider && e.eventId === d.eventId)) uniqueViolation()
      const row: EventRow = {
        id: this.seq++,
        provider: d.provider,
        eventId: d.eventId,
        paymentIntentId: null,
        status: d.status,
        payload: d.payload,
        processedAt: null,
      }
      this.events.push(row)
      return { id: row.id }
    },
    findUnique: async (args: any): Promise<EventRow | null> => {
      const w = args?.where?.provider_eventId ?? {}
      return this.events.find((e) => e.provider === w.provider && e.eventId === w.eventId) ?? null
    },
    update: async (args: any): Promise<EventRow> => {
      const row = this.events.find((e) => e.id === args?.where?.id)!
      Object.assign(row, args.data)
      return row
    },
  }

  spAccount = {
    findUnique: async (args: any): Promise<SpAcct | null> => this.accounts.find((a) => a.userId === args?.where?.userId) ?? null,
    findUniqueOrThrow: async (args: any): Promise<SpAcct> => this.accounts.find((a) => a.userId === args?.where?.userId)!,
    upsert: async (args: any): Promise<SpAcct> => {
      const userId = args.where.userId
      let row = this.accounts.find((a) => a.userId === userId)
      if (!row) {
        row = {
          userId,
          earnedSp: args.create.earnedSp ?? 0n,
          bonusSp: args.create.bonusSp ?? 0n,
          lifetimeEarnedSp: args.create.lifetimeEarnedSp ?? 0n,
          version: 0,
        }
        this.accounts.push(row)
      } else {
        if (args.update.bonusSp?.increment) row.bonusSp += BigInt(args.update.bonusSp.increment)
        if (args.update.earnedSp?.increment) row.earnedSp += BigInt(args.update.earnedSp.increment)
        if (args.update.lifetimeEarnedSp?.increment) row.lifetimeEarnedSp += BigInt(args.update.lifetimeEarnedSp.increment)
      }
      return row
    },
    updateMany: async (args: any): Promise<{ count: number }> => {
      const row = this.accounts.find((a) => a.userId === args?.where?.userId)!
      const min = args.where.earnedSp?.gte
      if (min !== undefined && row.earnedSp < min) return { count: 0 }
      if (args.data.earnedSp?.decrement) row.earnedSp -= BigInt(args.data.earnedSp.decrement)
      return { count: 1 }
    },
  }

  spLedgerEntry = {
    create: async (args: any): Promise<{ id: number }> => {
      const d = args.data
      if (
        d.sourceId !== null &&
        d.sourceId !== undefined &&
        this.ledger.some((l) => l.userId === d.userId && l.sourceType === d.sourceType && l.sourceId === d.sourceId)
      ) {
        uniqueViolation()
      }
      const id = this.seq++
      this.ledger.push({ id, userId: d.userId, bucket: d.bucket, amountSp: d.amountSp, sourceType: d.sourceType, sourceId: d.sourceId ?? null })
      return { id }
    },
  }

  adminAuditLog = {
    create: async (args: any): Promise<{ id: number }> => {
      const id = this.seq++
      this.audits.push({ id, ...args.data })
      return { id }
    },
  }

  $transaction = async <T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T> => fn(this)
}

const asClient = (f: FakePrisma): PrismaClient => f as unknown as PrismaClient

function json(body: unknown, status = 200): OxapayFetchResponse {
  const text = JSON.stringify(body)
  return { ok: status >= 200 && status < 300, status, text: async () => text }
}

function payoutConfig(handler: (url: string, init: any) => OxapayFetchResponse): { config: OxapayConfig; calls: string[] } {
  const calls: string[] = []
  const fetch: OxapayFetch = async (url, init) => {
    calls.push(`${init.method} ${url}`)
    return handler(url, init)
  }
  return {
    config: {
      merchantApiKey: 'merchant-key',
      payoutApiKey: 'payout-key',
      baseUrl: 'https://api.oxapay.com/v1',
      sandbox: true,
      timeoutMs: 1000,
      fetch,
    },
    calls,
  }
}

function seedWithdrawal(f: FakePrisma, overrides: Partial<WithdrawalRow> = {}): WithdrawalRow {
  const row: WithdrawalRow = {
    id: 1,
    userId: 1,
    grossSp: 3000n,
    feeUsdt: '0.30',
    netUsdt: '2.70',
    address: '0x' + 'a'.repeat(40),
    network: 'BEP20',
    status: 'APPROVED',
    note: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
  f.withdrawals.push(row)
  return row
}

function seedPayoutIntent(f: FakePrisma, withdrawalId: number, externalId: string): IntentRow {
  const row: IntentRow = {
    id: f.seq++,
    userId: 1,
    provider: 'OXAPAY',
    externalId,
    amountUsdt: '2.70',
    status: 'PENDING',
    purpose: 'withdrawal',
    payAddress: '0x' + 'a'.repeat(40),
    metadata: { withdrawalRequestId: withdrawalId },
    confirmedAt: null,
  }
  f.intents.push(row)
  return row
}

const withPayouts = async (fn: () => Promise<void>): Promise<void> => {
  const saved = process.env.PAYOUTS_ENABLED
  process.env.PAYOUTS_ENABLED = 'true'
  try {
    await fn()
  } finally {
    if (saved === undefined) delete process.env.PAYOUTS_ENABLED
    else process.env.PAYOUTS_ENABLED = saved
  }
}

test('executeWithdrawalPayout is blocked while payouts are disabled', async () => {
  const saved = process.env.PAYOUTS_ENABLED
  delete process.env.PAYOUTS_ENABLED
  try {
    const f = new FakePrisma()
    seedWithdrawal(f)
    const { config, calls } = payoutConfig(() => json({ status: 200, data: { track_id: 'pay_1' } }))
    await assert.rejects(
      () => executeWithdrawalPayout(asClient(f), 1, config),
      (e: unknown) => e instanceof WithdrawalError && e.code === 'payouts_disabled',
    )
    assert.equal(calls.length, 0)
    assert.equal(f.intents.length, 0)
  } finally {
    if (saved === undefined) delete process.env.PAYOUTS_ENABLED
    else process.env.PAYOUTS_ENABLED = saved
  }
})

test('executeWithdrawalPayout submits once and is idempotent', async () => {
  await withPayouts(async () => {
    const f = new FakePrisma()
    seedWithdrawal(f)
    const { config, calls } = payoutConfig(() => json({ status: 200, data: { track_id: 'pay_1', status: 'Pending' } }))

    const first = await executeWithdrawalPayout(asClient(f), 1, config)
    assert.equal(first.trackId, 'pay_1')
    assert.equal(first.alreadySubmitted, false)
    assert.equal(f.intents.length, 1)
    assert.equal(f.intents[0].externalId, 'pay_1')

    const second = await executeWithdrawalPayout(asClient(f), 1, config)
    assert.equal(second.alreadySubmitted, true)
    assert.equal(second.trackId, 'pay_1')
    assert.equal(calls.length, 1)
    assert.equal(f.intents.length, 1)
  })
})

test('executeWithdrawalPayout rejects a request that is not approved', async () => {
  await withPayouts(async () => {
    const f = new FakePrisma()
    seedWithdrawal(f, { status: 'REQUESTED' })
    const { config, calls } = payoutConfig(() => json({ status: 200, data: { track_id: 'pay_1' } }))
    await assert.rejects(
      () => executeWithdrawalPayout(asClient(f), 1, config),
      (e: unknown) => e instanceof WithdrawalError && e.code === 'invalid_state',
    )
    assert.equal(calls.length, 0)
  })
})

test('a confirmed payout webhook marks the request PAID exactly once', async () => {
  await withPayouts(async () => {
    const f = new FakePrisma()
    seedWithdrawal(f, { status: 'APPROVED' })
    seedPayoutIntent(f, 1, 'pay_1')

    const first = await processPayoutWebhook(asClient(f), { eventId: 'evt_1', trackId: 'pay_1', status: 'Confirmed' })
    assert.equal(first.reason, 'settled')
    assert.equal(f.withdrawals[0].status, 'PAID')
    assert.equal(f.withdrawals[0].payoutTrackId, 'pay_1')
    assert.ok(f.withdrawals[0].paidAt instanceof Date)
    assert.equal(f.ledger.length, 0)

    const replay = await processPayoutWebhook(asClient(f), { eventId: 'evt_2', trackId: 'pay_1', status: 'Confirmed' })
    assert.equal(replay.reason, 'already_paid')
    assert.equal(f.withdrawals[0].status, 'PAID')
    assert.equal(f.ledger.length, 0)
  })
})

test('a duplicate payout webhook event is ignored', async () => {
  await withPayouts(async () => {
    const f = new FakePrisma()
    seedWithdrawal(f, { status: 'APPROVED' })
    seedPayoutIntent(f, 1, 'pay_1')
    await processPayoutWebhook(asClient(f), { eventId: 'evt_dup', trackId: 'pay_1', status: 'Confirmed' })
    const again = await processPayoutWebhook(asClient(f), { eventId: 'evt_dup', trackId: 'pay_1', status: 'Confirmed' })
    assert.equal(again.reason, 'duplicate')
    assert.equal(f.events.length, 1)
  })
})

test('a failed payout webhook releases the locked Earned SP and rejects the request', async () => {
  await withPayouts(async () => {
    const f = new FakePrisma()
    seedWithdrawal(f, { status: 'APPROVED' })
    seedPayoutIntent(f, 1, 'pay_1')
    f.accounts.push({ userId: 1, earnedSp: 0n, bonusSp: 0n, lifetimeEarnedSp: 3000n, version: 0 })

    const result = await processPayoutWebhook(asClient(f), { eventId: 'evt_fail', trackId: 'pay_1', status: 'Failed' })
    assert.equal(result.reason, 'reversed')
    assert.equal(f.withdrawals[0].status, 'REJECTED')
    assert.equal(f.accounts[0].earnedSp, 3000n)
    assert.equal(f.ledger.filter((l) => l.sourceType === 'WITHDRAWAL_RELEASE').length, 1)

    const replay = await processPayoutWebhook(asClient(f), { eventId: 'evt_fail_2', trackId: 'pay_1', status: 'Failed' })
    assert.equal(replay.reason, 'already_paid')
    assert.equal(f.ledger.filter((l) => l.sourceType === 'WITHDRAWAL_RELEASE').length, 1)
  })
})

test('payout webhooks are ignored while payouts are disabled', async () => {
  const saved = process.env.PAYOUTS_ENABLED
  delete process.env.PAYOUTS_ENABLED
  try {
    const f = new FakePrisma()
    seedWithdrawal(f, { status: 'APPROVED' })
    seedPayoutIntent(f, 1, 'pay_1')
    const result = await processPayoutWebhook(asClient(f), { eventId: 'evt_x', trackId: 'pay_1', status: 'Confirmed' })
    assert.equal(result.reason, 'payouts_disabled')
    assert.equal(f.withdrawals[0].status, 'APPROVED')
    assert.equal(f.ledger.length, 0)
  } finally {
    if (saved === undefined) delete process.env.PAYOUTS_ENABLED
    else process.env.PAYOUTS_ENABLED = saved
  }
})

test('reconcileWithdrawalPayout settles from the provider lookup', async () => {
  await withPayouts(async () => {
    const f = new FakePrisma()
    seedWithdrawal(f, { status: 'APPROVED' })
    seedPayoutIntent(f, 1, 'pay_1')
    const { config, calls } = payoutConfig(() => json({ status: 200, data: { track_id: 'pay_1', status: 'Confirmed' } }))

    const result = await reconcileWithdrawalPayout(asClient(f), 1, config)
    assert.equal(result.reason, 'settled')
    assert.equal(f.withdrawals[0].status, 'PAID')
    assert.equal(calls.length, 1)
    assert.match(calls[0], /GET .*\/payout\/pay_1/)
  })
})

test('createWithdrawalRequest enforces a 24h cooldown after a payout', async () => {
  const f = new FakePrisma()
  f.accounts.push({ userId: 1, earnedSp: 9000n, bonusSp: 0n, lifetimeEarnedSp: 9000n, version: 0 })
  f.users.push({ id: 1, withdrawalWallet: '0x' + 'b'.repeat(40), withdrawalWalletChangedAt: null })
  seedWithdrawal(f, { status: 'PAID', updatedAt: new Date() })

  await assert.rejects(
    () => createWithdrawalRequest(asClient(f), 1, { grossSp: 3000n, address: '0x' + 'b'.repeat(40) }),
    (e: unknown) => e instanceof WithdrawalError && e.code === 'cooldown',
  )

  f.withdrawals[0].updatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000)
  const created = await createWithdrawalRequest(asClient(f), 1, { grossSp: 3000n, address: '0x' + 'b'.repeat(40) })
  assert.equal(created.status, 'REQUESTED')
  assert.equal(created.netUsdt, '2.70')
  assert.equal(f.accounts[0].earnedSp, 6000n)
})

test('walletHoldMs is configurable and defaults to 24h', () => {
  assert.equal(walletHoldMs({}), 24 * 60 * 60 * 1000)
  assert.equal(walletHoldMs({ WITHDRAWAL_WALLET_HOLD_HOURS: '0' }), 0)
  assert.equal(walletHoldMs({ WITHDRAWAL_WALLET_HOLD_HOURS: '48' }), 48 * 60 * 60 * 1000)
  assert.equal(walletHoldMs({ WITHDRAWAL_WALLET_HOLD_HOURS: 'nope' }), 24 * 60 * 60 * 1000)
})

test('createWithdrawalRequest reports insufficient_sp (Earned only; Bonus excluded)', async () => {
  const f = new FakePrisma()
  f.accounts.push({ userId: 1, earnedSp: 3000n, bonusSp: 9000n, lifetimeEarnedSp: 3000n, version: 0 })
  f.users.push({ id: 1, withdrawalWallet: null, withdrawalWalletChangedAt: null })

  await assert.rejects(
    () => createWithdrawalRequest(asClient(f), 1, { grossSp: 6000n, address: '0x' + 'a'.repeat(40) }),
    (e: unknown) => e instanceof WithdrawalError && e.code === 'insufficient_sp',
  )
  // Bonus SP must never be touched by a withdrawal lock attempt.
  assert.equal(f.accounts[0].bonusSp, 9000n)
  assert.equal(f.accounts[0].earnedSp, 3000n)
})

test('setWithdrawalWallet saves the first wallet and starts the hold on a change', async () => {
  const f = new FakePrisma()
  f.users.push({ id: 1, withdrawalWallet: null, withdrawalWalletChangedAt: null })
  const addrA = '0x' + 'a'.repeat(40)

  const first = await setWithdrawalWallet(asClient(f), 1, addrA)
  assert.equal(first.address, addrA)

  const addrB = '0x' + 'c'.repeat(40)
  const changed = await setWithdrawalWallet(asClient(f), 1, addrB)
  assert.equal(changed.address, addrB)
  assert.equal(changed.holdActive, true)
  assert.ok(changed.holdUntil)
})

test('setWithdrawalWallet is blocked while a withdrawal is pending', async () => {
  const f = new FakePrisma()
  f.users.push({ id: 1, withdrawalWallet: '0x' + 'a'.repeat(40), withdrawalWalletChangedAt: null })
  seedWithdrawal(f, { status: 'APPROVED' })
  await assert.rejects(
    () => setWithdrawalWallet(asClient(f), 1, '0x' + 'c'.repeat(40)),
    (e: unknown) => e instanceof WithdrawalError && e.code === 'wallet_pending',
  )
})

test('createWithdrawalRequest saves the first wallet on the first request', async () => {
  const f = new FakePrisma()
  f.accounts.push({ userId: 1, earnedSp: 9000n, bonusSp: 0n, lifetimeEarnedSp: 9000n, version: 0 })
  f.users.push({ id: 1, withdrawalWallet: null, withdrawalWalletChangedAt: null })
  const addr = '0x' + 'd'.repeat(40)

  const created = await createWithdrawalRequest(asClient(f), 1, { grossSp: 3000n, address: addr })
  assert.equal(created.address, addr)
  assert.equal(f.users[0].withdrawalWallet, addr)
  assert.equal(f.accounts[0].earnedSp, 6000n)
})

test('createWithdrawalRequest rejects an address that differs from the saved wallet', async () => {
  const f = new FakePrisma()
  f.accounts.push({ userId: 1, earnedSp: 9000n, bonusSp: 0n, lifetimeEarnedSp: 9000n, version: 0 })
  f.users.push({ id: 1, withdrawalWallet: '0x' + 'd'.repeat(40), withdrawalWalletChangedAt: null })

  await assert.rejects(
    () => createWithdrawalRequest(asClient(f), 1, { grossSp: 3000n, address: '0x' + 'e'.repeat(40) }),
    (e: unknown) => e instanceof WithdrawalError && e.code === 'wallet_mismatch',
  )
})

test('createWithdrawalRequest is blocked during the wallet-change hold', async () => {
  const envelopeHold = process.env.WITHDRAWAL_WALLET_HOLD_HOURS
  process.env.WITHDRAWAL_WALLET_HOLD_HOURS = '24'
  try {
    const f = new FakePrisma()
    f.accounts.push({ userId: 1, earnedSp: 9000n, bonusSp: 0n, lifetimeEarnedSp: 9000n, version: 0 })
    const addr = '0x' + 'f'.repeat(40)
    f.users.push({ id: 1, withdrawalWallet: addr, withdrawalWalletChangedAt: new Date() })

    await assert.rejects(
      () => createWithdrawalRequest(asClient(f), 1, { grossSp: 3000n, address: addr }),
      (e: unknown) => e instanceof WithdrawalError && e.code === 'wallet_hold',
    )

    f.users[0].withdrawalWalletChangedAt = new Date(Date.now() - 25 * 60 * 60 * 1000)
    const created = await createWithdrawalRequest(asClient(f), 1, { grossSp: 3000n, address: addr })
    assert.equal(created.address, addr)
  } finally {
    if (envelopeHold === undefined) delete process.env.WITHDRAWAL_WALLET_HOLD_HOURS
    else process.env.WITHDRAWAL_WALLET_HOLD_HOURS = envelopeHold
  }
})

test('isUncertainPayoutError flags ambiguous outcomes and not definite rejections', () => {
  assert.equal(isUncertainPayoutError(new OxapayError('timeout')), true)
  assert.equal(isUncertainPayoutError(new OxapayError('network_error')), true)
  assert.equal(isUncertainPayoutError(new OxapayError('invalid_response', 'x', 502)), true)
  assert.equal(isUncertainPayoutError(new OxapayError('provider_error', 'x', 500)), true)
  // Definite rejections are safe to unwind and retry.
  assert.equal(isUncertainPayoutError(new OxapayError('provider_error', 'x', 400)), false)
  assert.equal(isUncertainPayoutError(new OxapayError('invalid_input')), false)
  // Anything unexpected is treated as uncertain (fail-safe: never blind-retry).
  assert.equal(isUncertainPayoutError(new Error('boom')), true)
})

function throwingConfig(): OxapayConfig {
  return {
    merchantApiKey: 'm',
    payoutApiKey: 'p',
    baseUrl: 'https://api.oxapay.com/v1',
    sandbox: true,
    timeoutMs: 1000,
    fetch: async () => {
      throw new Error('connection reset')
    },
  }
}

test('executeWithdrawalPayout keeps the anchor and reports payout_uncertain on an ambiguous error', async () => {
  await withPayouts(async () => {
    const f = new FakePrisma()
    seedWithdrawal(f)
    const config = throwingConfig()

    await assert.rejects(
      () => executeWithdrawalPayout(asClient(f), 1, config),
      (e: unknown) => e instanceof WithdrawalError && e.code === 'payout_uncertain',
    )
    // Anchor retained -> a blind retry cannot double-submit.
    assert.equal(f.intents.length, 1)
    assert.match(f.intents[0].externalId, /^wd_/)

    await assert.rejects(
      () => executeWithdrawalPayout(asClient(f), 1, config),
      (e: unknown) => e instanceof WithdrawalError && e.code === 'invalid_state',
    )
  })
})

test('executeWithdrawalPayout removes the anchor on a definite provider rejection', async () => {
  await withPayouts(async () => {
    const f = new FakePrisma()
    seedWithdrawal(f)
    const { config } = payoutConfig(() => json({ status: 400, error: { type: 'invalid', key: 'address' } }, 400))
    await assert.rejects(
      () => executeWithdrawalPayout(asClient(f), 1, config),
      (e: unknown) => e instanceof OxapayError && e.code === 'provider_error',
    )
    assert.equal(f.intents.length, 0)
  })
})

test('resolveUncertainPayoutSubmission clears or attaches the anchor after operator verification', async () => {
  await withPayouts(async () => {
    const f = new FakePrisma()
    seedWithdrawal(f, { status: 'APPROVED' })
    const config = throwingConfig()

    // Case 1: operator confirms no payout exists -> drop the anchor (retry allowed).
    await assert.rejects(() => executeWithdrawalPayout(asClient(f), 1, config))
    const cleared = await resolveUncertainPayoutSubmission(asClient(f), 7, 1, 'not_submitted')
    assert.equal(cleared.resolution, 'not_submitted')
    assert.equal(f.intents.length, 0)
    assert.equal(f.audits.filter((a) => (a.action as string).startsWith('withdrawal.payout_resolve')).length, 1)

    // Case 2: a payout does exist -> attach its track id for reconciliation.
    await assert.rejects(() => executeWithdrawalPayout(asClient(f), 1, config))
    const attached = await resolveUncertainPayoutSubmission(asClient(f), 7, 1, 'attach_track_id', 'pay_9')
    assert.equal(attached.trackId, 'pay_9')
    assert.equal(f.intents[0].externalId, 'pay_9')
    assert.equal(f.intents[0].status, 'PENDING')
  })
})

test('reviewWithdrawal refuses to reject once a payout has been submitted', async () => {
  const f = new FakePrisma()
  seedWithdrawal(f, { status: 'APPROVED' })
  seedPayoutIntent(f, 1, 'pay_1')
  await assert.rejects(
    () => reviewWithdrawal(asClient(f), 7, 1, 'REJECTED'),
    (e: unknown) => e instanceof WithdrawalError && e.code === 'invalid_state',
  )
  assert.equal(f.ledger.length, 0)
})

test('processPayoutWebhook re-evaluates a previously IGNORED event and settles once', async () => {
  const f = new FakePrisma()
  seedWithdrawal(f, { status: 'APPROVED' })
  seedPayoutIntent(f, 1, 'pay_1')

  const saved = process.env.PAYOUTS_ENABLED
  delete process.env.PAYOUTS_ENABLED
  try {
    const ignored = await processPayoutWebhook(asClient(f), { eventId: 'evt_recover', trackId: 'pay_1', status: 'Confirmed' })
    assert.equal(ignored.reason, 'payouts_disabled')
    assert.equal(f.events[0].status, 'IGNORED')

    process.env.PAYOUTS_ENABLED = 'true'
    const settled = await processPayoutWebhook(asClient(f), { eventId: 'evt_recover', trackId: 'pay_1', status: 'Confirmed' })
    assert.equal(settled.reason, 'settled')
    assert.equal(f.withdrawals[0].status, 'PAID')
    assert.equal(f.events.length, 1)
    assert.equal(f.events[0].status, 'PROCESSED')
  } finally {
    if (saved === undefined) delete process.env.PAYOUTS_ENABLED
    else process.env.PAYOUTS_ENABLED = saved
  }
})

test('createWithdrawalRequest is blocked while payout operations are unavailable', async () => {
  const saved = process.env.PAYOUTS_ENABLED
  delete process.env.PAYOUTS_ENABLED
  try {
    const f = new FakePrisma()
    f.accounts.push({ userId: 1, earnedSp: 9000n, bonusSp: 0n, lifetimeEarnedSp: 9000n, version: 0 })
    f.users.push({ id: 1, withdrawalWallet: null, withdrawalWalletChangedAt: null })
    await assert.rejects(
      () => createWithdrawalRequest(asClient(f), 1, { grossSp: 3000n, address: '0x' + 'a'.repeat(40) }),
      (e: unknown) => e instanceof WithdrawalError && e.code === 'withdrawals_unavailable',
    )
    // No request created, no SP locked, wallet untouched.
    assert.equal(f.withdrawals.length, 0)
    assert.equal(f.accounts[0].earnedSp, 9000n)
    assert.equal(f.ledger.length, 0)
    assert.equal(f.users[0].withdrawalWallet, null)
  } finally {
    if (saved === undefined) process.env.PAYOUTS_ENABLED = 'true'
    else process.env.PAYOUTS_ENABLED = saved
  }
})

test('createWithdrawalRequest enforces the provider payout minimum on the net amount', async () => {
  const saved = process.env.OXAPAY_MIN_PAYOUT_USDT
  process.env.OXAPAY_MIN_PAYOUT_USDT = '5'
  try {
    const f = new FakePrisma()
    f.accounts.push({ userId: 1, earnedSp: 9000n, bonusSp: 0n, lifetimeEarnedSp: 9000n, version: 0 })
    f.users.push({ id: 1, withdrawalWallet: null, withdrawalWalletChangedAt: null })
    await assert.rejects(
      () => createWithdrawalRequest(asClient(f), 1, { grossSp: 3000n, address: '0x' + 'a'.repeat(40) }),
      (e: unknown) => e instanceof WithdrawalError && e.code === 'below_payout_minimum',
    )
    assert.equal(f.accounts[0].earnedSp, 9000n)
  } finally {
    if (saved === undefined) delete process.env.OXAPAY_MIN_PAYOUT_USDT
    else process.env.OXAPAY_MIN_PAYOUT_USDT = saved
  }
})

test('minPayoutUsdt defaults to the verified 0.01 and rejects invalid values', () => {
  assert.equal(minPayoutUsdt({}), '0.01')
  assert.equal(minPayoutUsdt({ OXAPAY_MIN_PAYOUT_USDT: '' }), '0.01')
  assert.equal(minPayoutUsdt({ OXAPAY_MIN_PAYOUT_USDT: 'nope' }), '0.01')
  assert.equal(minPayoutUsdt({ OXAPAY_MIN_PAYOUT_USDT: '2.50' }), '2.50')
})
