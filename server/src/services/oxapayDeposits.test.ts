import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import {
  buildReconciliationInput,
  confirmDepositIntent,
  createDepositIntent,
  createDepositInvoice,
  PaymentError,
  processWebhook,
  reconcileDepositIntent,
} from './payments'
import { OxapayError, type OxapayConfig, type OxapayFetch, type OxapayFetchResponse } from './oxapay'
import { computeHmacSha512, evaluateDepositSettlement, verifyHmacSha512 } from '../lib/oxapay'
import { oxapayCallbackSchema } from '../validation/game'

process.env.PAYMENTS_ENABLED = 'true'

function uniqueViolation(): never {
  const err = new Error('unique violation') as Error & { code?: string }
  err.code = 'P2002'
  throw err
}

interface IntentRow {
  id: number
  userId: number
  provider: string
  externalId: string
  amountUsdt: string
  creditedSp: bigint | null
  status: string
  purpose: string
  payUrl: string | null
  metadata: unknown
  createdAt: Date
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
interface SpAcct {
  userId: number
  earnedSp: bigint
  bonusSp: bigint
  lifetimeEarnedSp: bigint
  version: number
}
interface LedgerRow {
  id: number
  userId: number
  bucket: string
  amountSp: bigint
  sourceType: string
  sourceId: bigint | null
}

class FakePrisma {
  intents: IntentRow[] = []
  events: EventRow[] = []
  accounts: SpAcct[] = []
  ledger: LedgerRow[] = []
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
        amountUsdt: typeof d.amountUsdt === 'string' ? d.amountUsdt : String(d.amountUsdt),
        creditedSp: d.creditedSp ?? null,
        status: d.status ?? 'CREATED',
        purpose: d.purpose ?? 'deposit',
        payUrl: d.payUrl ?? null,
        metadata: d.metadata ?? null,
        createdAt: new Date(),
        confirmedAt: null,
      }
      this.intents.push(row)
      return row
    },
    findUnique: async (args: any): Promise<IntentRow | null> => {
      const w = args?.where ?? {}
      return (
        this.intents.find(
          (i) =>
            (w.id !== undefined && i.id === w.id) ||
            (w.externalId !== undefined && i.externalId === w.externalId),
        ) ?? null
      )
    },
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
    findUnique: async (args: any): Promise<SpAcct | null> =>
      this.accounts.find((a) => a.userId === args?.where?.userId) ?? null,
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
        if (args.update.version?.increment) row.version += args.update.version.increment
      }
      return row
    },
    updateMany: async (): Promise<{ count: number }> => ({ count: 1 }),
    findUniqueOrThrow: async (args: any): Promise<SpAcct> =>
      this.accounts.find((a) => a.userId === args?.where?.userId)!,
  }

  spLedgerEntry = {
    create: async (args: any): Promise<LedgerRow> => {
      const d = args.data
      if (
        d.sourceId !== null &&
        d.sourceId !== undefined &&
        this.ledger.some(
          (l) =>
            l.userId === d.userId &&
            l.sourceType === d.sourceType &&
            l.sourceId === d.sourceId &&
            l.bucket === d.bucket,
        )
      ) {
        uniqueViolation()
      }
      const row: LedgerRow = {
        id: this.seq++,
        userId: d.userId,
        bucket: d.bucket,
        amountSp: d.amountSp,
        sourceType: d.sourceType,
        sourceId: d.sourceId ?? null,
      }
      this.ledger.push(row)
      return row
    },
    findMany: async (args: any): Promise<LedgerRow[]> => this.ledger.filter((l) => l.userId === args?.where?.userId),
  }

  $transaction = async <T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T> => fn(this)
}

const asClient = (f: FakePrisma): PrismaClient => f as unknown as PrismaClient

function jsonResponse(body: unknown, status = 200): OxapayFetchResponse {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return { ok: status >= 200 && status < 300, status, text: async () => text }
}

function makeConfig(
  handler: (url: string, init: any) => OxapayFetchResponse | Promise<OxapayFetchResponse>,
  overrides: Partial<OxapayConfig> = {},
): { config: OxapayConfig; calls: Array<{ url: string; init: any }> } {
  const calls: Array<{ url: string; init: any }> = []
  const fetch: OxapayFetch = async (url, init) => {
    calls.push({ url, init })
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
      ...overrides,
    },
    calls,
  }
}

function seedIntent(f: FakePrisma, overrides: Partial<IntentRow> = {}): IntentRow {
  const row: IntentRow = {
    id: 1,
    userId: 1,
    provider: 'OXAPAY',
    externalId: 'track-1',
    amountUsdt: '10.00',
    creditedSp: 10000n,
    status: 'CREATED',
    purpose: 'deposit',
    payUrl: 'https://pay/track-1',
    metadata: { orderId: 'dep_1' },
    createdAt: new Date(),
    confirmedAt: null,
    ...overrides,
  }
  f.intents.push(row)
  return row
}

test('createDepositInvoice persists the provider track id, order ref and pay url', async () => {
  const { config, calls } = makeConfig(() =>
    jsonResponse({
      status: 200,
      data: { track_id: 'track-1', payment_url: 'https://pay/track-1', expired_at: 1700000000 },
    }),
  )
  const f = new FakePrisma()
  const view = await createDepositInvoice(asClient(f), config, 7, '10.00')

  assert.equal(view.externalId, 'track-1')
  assert.equal(view.payUrl, 'https://pay/track-1')
  assert.equal(view.amountUsdt, '10.00')
  assert.equal(view.creditedSp, '10000')
  assert.equal(f.intents.length, 1)
  const meta = f.intents[0].metadata as Record<string, unknown>
  assert.match(String(meta.orderId), /^dep_/)

  assert.equal(calls.length, 1)
  assert.equal(calls[0].init.headers.merchant_api_key, 'merchant-key')
  const body = JSON.parse(calls[0].init.body)
  assert.equal(body.amount, 10)
  assert.match(String(body.order_id), /^dep_/)
  assert.equal(body.sandbox, true)
  assert.equal(body.fee_paid_by_payer, 1)
})

test('createDepositInvoice propagates provider failures and writes nothing', async () => {
  const { config } = makeConfig(() => jsonResponse({ status: 400, error: { type: 'bad_request', key: 'amount' } }, 400))
  const f = new FakePrisma()
  await assert.rejects(
    () => createDepositInvoice(asClient(f), config, 7, '10.00'),
    (error: unknown) => error instanceof OxapayError && error.code === 'provider_error',
  )
  assert.equal(f.intents.length, 0)
})

test('createDepositIntent creates an invoice and persists the intent when enabled', async () => {
  const { config, calls } = makeConfig(() => jsonResponse({ status: 200, data: { track_id: 't', payment_url: 'u' } }))
  const f = new FakePrisma()
  const view = await createDepositIntent(asClient(f), 7, '10.00', config)
  assert.equal(view.externalId, 't')
  assert.equal(f.intents.length, 1)
  assert.equal(calls.length, 1)
})

test('processWebhook ignores an unknown track id and never credits', async () => {
  const f = new FakePrisma()
  const result = await processWebhook(asClient(f), {
    eventId: 'evt-1',
    externalId: 'track-x',
    status: 'Paid',
    amountUsdt: '10.00',
  })
  assert.equal(result.ignored, true)
  assert.equal(result.reason, 'intent_not_found')
  assert.equal(f.events.length, 1)
  assert.equal(f.events[0].status, 'IGNORED')
  assert.equal(f.ledger.length, 0)
  assert.equal(f.accounts.length, 0)
})

test('processWebhook deduplicates replayed events', async () => {
  const f = new FakePrisma()
  await processWebhook(asClient(f), { eventId: 'evt-dup', externalId: 'track-x', status: 'Paid', amountUsdt: '10.00' })
  const again = await processWebhook(asClient(f), {
    eventId: 'evt-dup',
    externalId: 'track-x',
    status: 'Paid',
    amountUsdt: '10.00',
  })
  assert.equal(again.reason, 'duplicate')
  assert.equal(f.events.length, 1)
})

test('processWebhook re-evaluates a previously IGNORED event and credits exactly once', async () => {
  // Reproduces the real incident: a paid callback first failed closed because the
  // asset was read from the invoice-level currency ("USD"). Once fixed, the same
  // provider transition must settle without double-crediting.
  const f = new FakePrisma()
  seedIntent(f, {
    externalId: 'track-redo',
    amountUsdt: '1',
    creditedSp: 1000n,
    metadata: { orderId: 'dep_1', asset: 'USDT', network: 'BSC' },
  })
  const eventId = 'track-redo:paid:0xabc'

  const ignored = await processWebhook(asClient(f), {
    eventId,
    externalId: 'track-redo',
    status: 'Paid',
    amountUsdt: '1',
    orderId: 'dep_1',
    asset: 'USD',
    network: 'Binance Smart Chain',
  })
  assert.equal(ignored.ignored, true)
  assert.equal(ignored.reason, 'unsupported_pair')
  assert.equal(f.events[0].status, 'IGNORED')
  assert.equal(f.ledger.length, 0)

  const settled = await processWebhook(asClient(f), {
    eventId,
    externalId: 'track-redo',
    status: 'Paid',
    amountUsdt: '1',
    orderId: 'dep_1',
    asset: 'USDT',
    network: 'Binance Smart Chain',
  })
  assert.equal(settled.confirmed, true)
  assert.equal(f.events.length, 1)
  assert.equal(f.events[0].status, 'PROCESSED')
  assert.equal(f.accounts.find((a) => a.userId === 1)!.bonusSp, 1000n)
  assert.equal(f.accounts.find((a) => a.userId === 1)!.earnedSp, 0n)
  assert.equal(f.ledger.filter((l) => l.sourceType === 'DEPOSIT_CREDIT').length, 1)

  // A third delivery is now a strict duplicate and cannot credit again.
  const replay = await processWebhook(asClient(f), {
    eventId,
    externalId: 'track-redo',
    status: 'Paid',
    amountUsdt: '1',
    orderId: 'dep_1',
    asset: 'USDT',
    network: 'Binance Smart Chain',
  })
  assert.equal(replay.reason, 'duplicate')
  assert.equal(f.ledger.filter((l) => l.sourceType === 'DEPOSIT_CREDIT').length, 1)
})

test('confirmDepositIntent credits Bonus SP exactly once under concurrent callbacks', async () => {
  const f = new FakePrisma()
  seedIntent(f, { status: 'PENDING' })

  const results = await Promise.allSettled([
    confirmDepositIntent(asClient(f), 1),
    confirmDepositIntent(asClient(f), 1),
  ])

  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(f.accounts.find((a) => a.userId === 1)!.bonusSp, 10000n)
  assert.equal(f.accounts.find((a) => a.userId === 1)!.earnedSp, 0n)
  assert.equal(f.ledger.filter((l) => l.sourceType === 'DEPOSIT_CREDIT').length, 1)
})

test('reconcileDepositIntent queries the provider and fails closed without an amount', async () => {
  const { config, calls } = makeConfig(() => jsonResponse({ status: 200, data: { track_id: 'track-1', status: 'Paid' } }))
  const f = new FakePrisma()
  seedIntent(f)
  const result = await reconcileDepositIntent(asClient(f), config, 1)
  assert.equal(result.ignored, true)
  assert.equal(result.reason, 'amount_missing')
  assert.equal(calls.length, 1)
  assert.equal(f.ledger.length, 0)
})

test('callback verification pipeline accepts valid HMAC and rejects tampered or malformed bodies', () => {
  const secret = 'merchant-key'
  function handle(raw: string, signature: string) {
    if (!verifyHmacSha512(Buffer.from(raw, 'utf8'), signature, secret)) return { status: 401 as const }
    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      return { status: 400 as const }
    }
    const parsed = oxapayCallbackSchema.safeParse(json)
    if (!parsed.success) return { status: 400 as const }
    return { status: 200 as const, data: parsed.data }
  }

  const payload = JSON.stringify({
    track_id: '151811887',
    status: 'Paid',
    amount: 10,
    order_id: 'dep_1',
    currency: 'USDT',
    txs: [{ tx_hash: '0xabc', status: 'confirmed', currency: 'USDT', network: 'BEP20' }],
  })
  const signature = computeHmacSha512(Buffer.from(payload, 'utf8'), secret)

  const ok = handle(payload, signature)
  assert.equal(ok.status, 200)
  assert.equal(handle(payload, signature.toUpperCase()).status, 200)
  assert.equal(handle(payload, 'deadbeef').status, 401)
  assert.equal(handle(`${payload} `, signature).status, 401)
  assert.equal(handle('{not json', computeHmacSha512('{not json', secret)).status, 400)
  assert.equal(
    handle(JSON.stringify({ status: 'Paid' }), computeHmacSha512(JSON.stringify({ status: 'Paid' }), secret)).status,
    400,
  )
})

function routedConfig(opts: {
  accepted?: string[]
  invoice?: { track_id: string; payment_url: string; expired_at?: number }
}) {
  const accepted = opts.accepted ?? ['USDT', 'BTC', 'USDC']
  const invoice = opts.invoice ?? { track_id: 'track-1', payment_url: 'https://pay/track-1', expired_at: 1700000000 }
  return makeConfig((url) => {
    if (url.endsWith('/payment/accepted-currencies')) return jsonResponse({ status: 200, data: { list: accepted } })
    if (url.endsWith('/payment/invoice')) return jsonResponse({ status: 200, data: invoice })
    return jsonResponse({ status: 404, error: { type: 'not_found' } }, 404)
  })
}

test('createDepositInvoice validates the selected pair and records canonical expectations', async () => {
  const { config, calls } = routedConfig({ accepted: ['USDT', 'BTC'] })
  const f = new FakePrisma()
  const view = await createDepositInvoice(asClient(f), config, 7, '10.00', { asset: 'usdt', network: 'BEP20' })

  assert.equal(view.expectedAsset, 'USDT')
  assert.equal(view.expectedNetwork, 'BSC')
  assert.equal(f.intents.length, 1)
  const meta = f.intents[0].metadata as Record<string, unknown>
  assert.equal(meta.asset, 'USDT')
  assert.equal(meta.network, 'BSC')
  assert.equal(calls.length, 2)
  assert.ok(calls[0].url.endsWith('/payment/accepted-currencies'))
  assert.ok(calls[1].url.endsWith('/payment/invoice'))
})

test('createDepositInvoice rejects an unsupported pair before any provider call', async () => {
  const { config, calls } = routedConfig({})
  const f = new FakePrisma()
  await assert.rejects(
    () => createDepositInvoice(asClient(f), config, 7, '10.00', { asset: 'BTC', network: 'Ethereum' }),
    (error: unknown) => error instanceof PaymentError && error.code === 'unsupported_pair',
  )
  assert.equal(calls.length, 0)
  assert.equal(f.intents.length, 0)
})

test('createDepositInvoice rejects an asset the merchant has not accepted', async () => {
  const { config, calls } = routedConfig({ accepted: ['BTC'] })
  const f = new FakePrisma()
  await assert.rejects(
    () => createDepositInvoice(asClient(f), config, 7, '10.00', { asset: 'USDT', network: 'BSC' }),
    (error: unknown) => error instanceof PaymentError && error.code === 'asset_not_accepted',
  )
  assert.equal(calls.length, 1)
  assert.ok(calls[0].url.endsWith('/payment/accepted-currencies'))
  assert.equal(f.intents.length, 0)
})

test('full deposit flow (simulated enabled): create -> verify -> credit Bonus SP exactly once', async () => {
  const { config } = routedConfig({
    accepted: ['USDT'],
    invoice: { track_id: 'track-1', payment_url: 'https://pay/track-1' },
  })
  const f = new FakePrisma()
  const view = await createDepositInvoice(asClient(f), config, 7, '10.00', { asset: 'USDT', network: 'BSC' })
  const intent = f.intents[0]
  const meta = intent.metadata as Record<string, unknown>

  // processWebhook builds exactly this evidence from the verified callback.
  const decision = evaluateDepositSettlement(
    { status: 'Paid', amount: 10, asset: 'USDT', network: 'BSC', orderId: String(meta.orderId) },
    {
      amountUsdt: intent.amountUsdt,
      orderId: String(meta.orderId),
      asset: String(meta.asset),
      network: String(meta.network),
    },
  )
  assert.deepEqual(decision, { settle: true })

  await confirmDepositIntent(asClient(f), intent.id)
  assert.equal(view.expectedAsset, 'USDT')
  assert.equal(f.accounts.find((a) => a.userId === 7)!.bonusSp, 10000n)
  assert.equal(f.accounts.find((a) => a.userId === 7)!.earnedSp, 0n)
  assert.equal(f.ledger.filter((l) => l.sourceType === 'DEPOSIT_CREDIT').length, 1)
})

test('buildReconciliationInput maps a provider lookup into webhook input', () => {
  const input = buildReconciliationInput('track-9', {
    trackId: 'track-9',
    status: 'paid',
    rawStatus: 'Paid',
    amount: '10.00',
    currency: 'USDT',
    orderId: 'dep_9',
    expiredAt: null,
    createdAt: null,
    transactions: [{ txHash: '0xABC', currency: 'USDT', network: 'BSC', status: 'confirmed' }],
  })
  assert.equal(input.externalId, 'track-9')
  assert.equal(input.status, 'Paid')
  assert.equal(input.amountUsdt, '10.00')
  assert.equal(input.orderId, 'dep_9')
  assert.equal(input.asset, 'USDT')
  assert.equal(input.network, 'BSC')
  assert.equal(input.eventId, 'track-9:paid:0xabc')
})

test('concurrent identical webhook events are deduplicated and credit nothing', async () => {
  const f = new FakePrisma()
  const results = await Promise.allSettled([
    processWebhook(asClient(f), { eventId: 'evt-conc', externalId: 'track-x', status: 'Paid', amountUsdt: '10.00' }),
    processWebhook(asClient(f), { eventId: 'evt-conc', externalId: 'track-x', status: 'Paid', amountUsdt: '10.00' }),
  ])
  assert.equal(f.events.length, 1)
  assert.equal(f.ledger.length, 0)
  const reasons = results.map((r) => (r.status === 'fulfilled' ? r.value.reason : 'rejected'))
  assert.ok(reasons.includes('duplicate'))
  assert.ok(reasons.includes('intent_not_found'))
})

test('a 1 USDT deposit credits exactly 1,000 Bonus SP and leaves Earned SP unchanged', async () => {
  const { config } = routedConfig({
    accepted: ['USDT'],
    invoice: { track_id: 'track-1', payment_url: 'https://pay/track-1' },
  })
  const f = new FakePrisma()
  const view = await createDepositInvoice(asClient(f), config, 7, '1.00', { asset: 'USDT', network: 'BSC' })
  const intent = f.intents[0]
  const meta = intent.metadata as Record<string, unknown>

  const decision = evaluateDepositSettlement(
    { status: 'Paid', amount: 1, asset: 'USDT', network: 'BSC', orderId: String(meta.orderId) },
    {
      amountUsdt: intent.amountUsdt,
      orderId: String(meta.orderId),
      asset: String(meta.asset),
      network: String(meta.network),
    },
  )
  assert.deepEqual(decision, { settle: true })

  await confirmDepositIntent(asClient(f), intent.id)
  const acct = f.accounts.find((a) => a.userId === 7)!
  assert.equal(view.creditedSp, '1000')
  assert.equal(acct.bonusSp, 1000n)
  assert.equal(acct.earnedSp, 0n)
  assert.equal(acct.lifetimeEarnedSp, 0n)
  assert.equal(f.ledger.filter((l) => l.sourceType === 'DEPOSIT_CREDIT').length, 1)

  // Exactly-once: a duplicate confirmation cannot credit again.
  await assert.rejects(() => confirmDepositIntent(asClient(f), intent.id))
  assert.equal(acct.bonusSp, 1000n)
  assert.equal(f.ledger.filter((l) => l.sourceType === 'DEPOSIT_CREDIT').length, 1)
})

test('a partial (0.50) payment for a 1.00 invoice never settles', () => {
  const intent = { amountUsdt: '1.00' }
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'Paid', amount: '0.50', asset: 'USDT', network: 'BSC' }, intent),
    { settle: false, reason: 'amount_mismatch' },
  )
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'underpaid', amount: '0.50', asset: 'USDT', network: 'BSC' }, intent),
    { settle: false, reason: 'non_confirming' },
  )
})
