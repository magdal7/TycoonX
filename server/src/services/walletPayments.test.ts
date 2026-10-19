import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { PaymentError, confirmDepositIntent, createDepositIntent, processWebhook } from './payments'
import { PurchaseError, deliverPurchase, markPurchasePaid, createPurchase } from './purchases'
import { getWalletSummary } from './wallet'

interface IntentRow {
  id: number
  userId: number
  provider: string
  externalId: string
  amountUsdt: string
  creditedSp: bigint | null
  status: string
  purpose: string
  createdAt: Date
  confirmedAt: Date | null
}
interface EventRow { id: number; provider: string; eventId: string; paymentIntentId: number | null; status: string; payload: unknown; receivedAt: Date; processedAt: Date | null }
interface PurchaseRow { id: number; userId: number; ceoId: number; priceUsdSnap: string; status: string; paymentIntentId: number | null; ownedCeoId: number | null; idempotencyKey: string; createdAt: Date; paidAt: Date | null; deliveredAt: Date | null }
interface SpAcct { userId: number; earnedSp: bigint; bonusSp: bigint; lifetimeEarnedSp: bigint; version: number }
interface LedgerRow { id: number; userId: number; bucket: string; amountSp: bigint; sourceType: string; sourceId: bigint | null }

function uniqueViolation(): never {
  const err = new Error('unique violation') as Error & { code?: string }
  err.code = 'P2002'
  throw err
}

class FakePrisma {
  intents: IntentRow[] = []
  events: EventRow[] = []
  purchases: PurchaseRow[] = []
  owned: Array<{ id: number; userId: number; templateId: number }> = []
  accounts: SpAcct[] = []
  ledger: LedgerRow[] = []
  ceos: Array<{ id: number; name: string; priceUsd: string; isActive: boolean; isForSale: boolean; maxOwned: number }> = [
    { id: 2, name: 'CEO 2', priceUsd: '0.99', isActive: true, isForSale: true, maxOwned: 1 },
  ]
  private seq = 1

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
        creditedSp: d.creditedSp ?? null,
        status: d.status ?? 'CREATED',
        purpose: d.purpose ?? 'deposit',
        createdAt: new Date(),
        confirmedAt: null,
      }
      this.intents.push(row)
      return row
    },
    findUnique: async (args: any): Promise<IntentRow | null> =>
      this.intents.find((i) => i.id === args?.where?.id || i.externalId === args?.where?.externalId) ?? null,
    findUniqueOrThrow: async (args: any): Promise<IntentRow> => {
      const row = this.intents.find((i) => i.id === args?.where?.id)
      if (!row) throw new Error('not found')
      return row
    },
    updateMany: async (args: any): Promise<{ count: number }> => {
      const w = args.where
      const rows = this.intents.filter((i) => i.id === w.id && (w.status === undefined || i.status === w.status))
      for (const r of rows) Object.assign(r, args.data)
      return { count: rows.length }
    },
    findMany: async (args: any): Promise<any[]> => {
      const w = args?.where ?? {}
      return this.intents.filter((i) => (w.userId === undefined || i.userId === w.userId) && (w.purpose === undefined || i.purpose === w.purpose))
    },
    aggregate: async (args: any): Promise<any> => {
      const w = args?.where ?? {}
      const rows = this.intents.filter((i) => (w.userId === undefined || i.userId === w.userId) && (w.purpose === undefined || i.purpose === w.purpose) && (w.status === undefined || i.status === w.status))
      return { _sum: { amountUsdt: rows.length ? { toString: () => rows.reduce((a, r) => a + Number(r.amountUsdt), 0).toFixed(2) } : null } }
    },
  }

  paymentWebhookEvent = {
    create: async (args: any): Promise<{ id: number }> => {
      const d = args.data
      if (this.events.some((e) => e.provider === d.provider && e.eventId === d.eventId)) uniqueViolation()
      const row: EventRow = { id: this.seq++, provider: d.provider, eventId: d.eventId, paymentIntentId: null, status: d.status, payload: d.payload, receivedAt: new Date(), processedAt: null }
      this.events.push(row)
      return { id: row.id }
    },
    update: async (args: any): Promise<EventRow> => {
      const row = this.events.find((e) => e.id === args?.where?.id)!
      Object.assign(row, args.data)
      return row
    },
  }

  cEO = {
    findUnique: async (args: any): Promise<any> => this.ceos.find((c) => c.id === args?.where?.id) ?? null,
  }

  ownedCeo = {
    count: async (args: any): Promise<number> => this.owned.filter((o) => o.userId === args?.where?.userId && o.templateId === args?.where?.templateId).length,
    create: async (args: any): Promise<{ id: number }> => {
      const d = args.data
      const row = { id: this.seq++, userId: d.userId, templateId: d.templateId }
      this.owned.push(row)
      return { id: row.id }
    },
  }

  ceoPurchase = {
    create: async (args: any): Promise<PurchaseRow> => {
      const d = args.data
      if (this.purchases.some((p) => p.idempotencyKey === d.idempotencyKey)) uniqueViolation()
      const row: PurchaseRow = { id: this.seq++, userId: d.userId, ceoId: d.ceoId, priceUsdSnap: d.priceUsdSnap, status: d.status ?? 'PENDING', paymentIntentId: null, ownedCeoId: null, idempotencyKey: d.idempotencyKey, createdAt: new Date(), paidAt: null, deliveredAt: null }
      this.purchases.push(row)
      return row
    },
    update: async (args: any): Promise<PurchaseRow> => {
      const row = this.purchases.find((p) => p.id === args?.where?.id)!
      Object.assign(row, args.data)
      return row
    },
    updateMany: async (args: any): Promise<{ count: number }> => {
      const w = args.where
      const rows = this.purchases.filter((p) => p.id === w.id && (w.status === undefined || p.status === w.status))
      for (const r of rows) Object.assign(r, args.data)
      return { count: rows.length }
    },
    findUnique: async (args: any): Promise<any> => {
      const row = this.purchases.find((p) => p.id === args?.where?.id || p.idempotencyKey === args?.where?.idempotencyKey)
      if (!row) return null
      if (args?.include?.ceo) return { ...row, ceo: this.ceos.find((c) => c.id === row.ceoId) }
      return row
    },
    findUniqueOrThrow: async (args: any): Promise<PurchaseRow> => {
      const row = this.purchases.find((p) => p.id === args?.where?.id)
      if (!row) throw new Error('not found')
      return row
    },
    findMany: async (args: any): Promise<any[]> => {
      const w = args?.where ?? {}
      let rows = this.purchases.filter((p) => (w.userId === undefined || p.userId === w.userId) && (w.status === undefined || p.status === w.status))
      if (args?.include?.ceo) rows = rows.map((p) => ({ ...p, ceo: { name: this.ceos.find((c) => c.id === p.ceoId)?.name ?? 'CEO' } })) as any
      return rows
    },
  }

  spAccount = {
    findUnique: async (args: any): Promise<SpAcct | null> => this.accounts.find((a) => a.userId === args?.where?.userId) ?? null,
    upsert: async (args: any): Promise<SpAcct> => {
      const userId = args.where.userId
      let row = this.accounts.find((a) => a.userId === userId)
      if (!row) {
        row = { userId, earnedSp: args.create.earnedSp ?? 0n, bonusSp: args.create.bonusSp ?? 0n, lifetimeEarnedSp: args.create.lifetimeEarnedSp ?? 0n, version: 0 }
        this.accounts.push(row)
      } else {
        if (args.update.bonusSp?.increment) row.bonusSp += BigInt(args.update.bonusSp.increment)
        if (args.update.earnedSp?.increment) row.earnedSp += BigInt(args.update.earnedSp.increment)
        if (args.update.lifetimeEarnedSp?.increment) row.lifetimeEarnedSp += BigInt(args.update.lifetimeEarnedSp.increment)
        if (args.update.version?.increment) row.version += args.update.version.increment
      }
      return row
    },
    updateMany: async (): Promise<{ count: number }> => ({ count: 1 }),
    findUniqueOrThrow: async (args: any): Promise<SpAcct> => this.accounts.find((a) => a.userId === args?.where?.userId)!,
  }

  spLedgerEntry = {
    create: async (args: any): Promise<LedgerRow> => {
      const d = args.data
      if (d.sourceId !== null && d.sourceId !== undefined && this.ledger.some((l) => l.userId === d.userId && l.sourceType === d.sourceType && l.sourceId === d.sourceId && l.bucket === d.bucket)) uniqueViolation()
      const row: LedgerRow = { id: this.seq++, userId: d.userId, bucket: d.bucket, amountSp: d.amountSp, sourceType: d.sourceType, sourceId: d.sourceId ?? null }
      this.ledger.push(row)
      return row
    },
    findMany: async (args: any): Promise<any[]> => this.ledger.filter((l) => l.userId === args?.where?.userId),
  }

  withdrawalRequest = {
    aggregate: async (args: any): Promise<any> => {
      const key = Object.keys(args?._sum ?? {})[0]
      return { _sum: { [key]: null } }
    },
    findMany: async (): Promise<any[]> => [],
  }

  $executeRaw = async (): Promise<number> => 1
  $transaction = async <T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T> => fn(this)
}

const asClient = (f: FakePrisma): PrismaClient => f as unknown as PrismaClient

function expectPayment(code: string) {
  return (error: unknown) => {
    assert.ok(error instanceof PaymentError, `expected PaymentError, got ${String(error)}`)
    assert.equal((error as PaymentError).code, code)
    return true
  }
}
function expectPurchase(code: string) {
  return (error: unknown) => {
    assert.ok(error instanceof PurchaseError, `expected PurchaseError, got ${String(error)}`)
    assert.equal((error as PurchaseError).code, code)
    return true
  }
}

test('deposit creation is disabled', async () => {
  const f = new FakePrisma()
  await assert.rejects(() => createDepositIntent(asClient(f), 1, '10'), expectPayment('payments_disabled'))
  assert.equal(f.intents.length, 0)
})

test('webhook processing is inert while payments are disabled (records + ignores)', async () => {
  const f = new FakePrisma()
  const result = await processWebhook(asClient(f), { eventId: 'evt_1', externalId: 'inv_x', status: 'paid' })
  assert.equal(result.ignored, true)
  assert.equal(result.reason, 'payments_disabled')
  assert.equal(f.events.length, 1)
  assert.equal(f.events[0].status, 'IGNORED')
  assert.equal(f.ledger.length, 0)
})

test('duplicate webhook events are deduplicated', async () => {
  const f = new FakePrisma()
  await processWebhook(asClient(f), { eventId: 'evt_dup', externalId: 'inv_x', status: 'paid' })
  const again = await processWebhook(asClient(f), { eventId: 'evt_dup', externalId: 'inv_x', status: 'paid' })
  assert.equal(again.ignored, true)
  assert.equal(again.reason, 'duplicate')
  assert.equal(f.events.length, 1)
})

test('confirmDepositIntent credits Bonus SP exactly once', async () => {
  const f = new FakePrisma()
  f.intents.push({ id: 7, userId: 1, provider: 'OXAPAY', externalId: 'inv_7', amountUsdt: '10.00', creditedSp: 10000n, status: 'PENDING', purpose: 'deposit', createdAt: new Date(), confirmedAt: null })

  const confirmed = await confirmDepositIntent(asClient(f), 7)
  assert.equal(confirmed.status, 'CONFIRMED')
  assert.equal(f.accounts.find((a) => a.userId === 1)!.bonusSp, 10000n)
  assert.equal(f.ledger.filter((l) => l.sourceType === 'DEPOSIT_CREDIT').length, 1)

  await assert.rejects(() => confirmDepositIntent(asClient(f), 7), expectPayment('invalid_state'))
  assert.equal(f.accounts.find((a) => a.userId === 1)!.bonusSp, 10000n)
  assert.equal(f.ledger.filter((l) => l.sourceType === 'DEPOSIT_CREDIT').length, 1)
})

test('concurrent deposit confirmations credit once', async () => {
  const f = new FakePrisma()
  f.intents.push({ id: 8, userId: 1, provider: 'OXAPAY', externalId: 'inv_8', amountUsdt: '5.00', creditedSp: 5000n, status: 'PENDING', purpose: 'deposit', createdAt: new Date(), confirmedAt: null })
  const results = await Promise.allSettled([confirmDepositIntent(asClient(f), 8), confirmDepositIntent(asClient(f), 8)])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(f.accounts.find((a) => a.userId === 1)!.bonusSp, 5000n)
  assert.equal(f.ledger.filter((l) => l.sourceType === 'DEPOSIT_CREDIT').length, 1)
})

test('CEO purchase creation is disabled', async () => {
  const f = new FakePrisma()
  await assert.rejects(() => createPurchase(asClient(f), 1, 2, 'idem_key_123'), expectPurchase('payments_disabled'))
  assert.equal(f.purchases.length, 0)
})

test('markPurchasePaid transitions PENDING -> PAID guarded', async () => {
  const f = new FakePrisma()
  f.purchases.push({ id: 3, userId: 1, ceoId: 2, priceUsdSnap: '0.99', status: 'PENDING', paymentIntentId: null, ownedCeoId: null, idempotencyKey: 'k', createdAt: new Date(), paidAt: null, deliveredAt: null })
  await markPurchasePaid(asClient(f), 3)
  assert.equal(f.purchases[0].status, 'PAID')
  await assert.rejects(() => markPurchasePaid(asClient(f), 3), expectPurchase('invalid_state'))
})

test('deliverPurchase delivers ownership exactly once', async () => {
  const f = new FakePrisma()
  f.purchases.push({ id: 4, userId: 1, ceoId: 2, priceUsdSnap: '0.99', status: 'PAID', paymentIntentId: null, ownedCeoId: null, idempotencyKey: 'k4', createdAt: new Date(), paidAt: new Date(), deliveredAt: null })

  const first = await deliverPurchase(asClient(f), 4)
  assert.equal(first.alreadyDelivered, false)
  assert.equal(f.owned.length, 1)
  assert.equal(f.purchases[0].status, 'DELIVERED')
  assert.equal(f.purchases[0].ownedCeoId, f.owned[0].id)

  const second = await deliverPurchase(asClient(f), 4)
  assert.equal(second.alreadyDelivered, true)
  assert.equal(f.owned.length, 1)
})

test('deliverPurchase rejects a purchase that is not paid', async () => {
  const f = new FakePrisma()
  f.purchases.push({ id: 5, userId: 1, ceoId: 2, priceUsdSnap: '0.99', status: 'PENDING', paymentIntentId: null, ownedCeoId: null, idempotencyKey: 'k5', createdAt: new Date(), paidAt: null, deliveredAt: null })
  await assert.rejects(() => deliverPurchase(asClient(f), 5), expectPurchase('invalid_state'))
  assert.equal(f.owned.length, 0)
})

test('wallet summary reports SP, zero USDT and disabled payments', async () => {
  const f = new FakePrisma()
  f.accounts.push({ userId: 1, earnedSp: 1500n, bonusSp: 500n, lifetimeEarnedSp: 1500n, version: 0 })
  const summary = await getWalletSummary(asClient(f), 1)
  assert.equal(summary.sp.earnedSp, '1500')
  assert.equal(summary.sp.bonusSp, '500')
  assert.equal(summary.sp.totalSp, '2000')
  assert.equal(summary.usdt.balance, '0.00')
  assert.equal(summary.paymentsEnabled, false)
  assert.equal(summary.payoutsEnabled, false)
})
