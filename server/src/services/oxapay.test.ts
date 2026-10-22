import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createInvoice,
  createPayout,
  getAcceptedCurrencies,
  getPaymentInfo,
  getPayoutInfo,
  getSupportedCurrencies,
  loadOxapayConfig,
  OxapayError,
  type OxapayConfig,
  type OxapayFetch,
  type OxapayFetchResponse,
} from './oxapay'

interface RecordedCall {
  url: string
  init: { method: string; headers: Record<string, string>; body?: string; signal?: unknown }
}

function jsonResponse(body: unknown, status = 200): OxapayFetchResponse {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return { ok: status >= 200 && status < 300, status, text: async () => text }
}

function makeFetch(
  handler: (url: string, init: RecordedCall['init']) => OxapayFetchResponse | Promise<OxapayFetchResponse>,
): { fetch: OxapayFetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const fetch: OxapayFetch = async (url, init) => {
    calls.push({ url, init })
    return handler(url, init)
  }
  return { fetch, calls }
}

function makeConfig(fetch: OxapayFetch, overrides: Partial<OxapayConfig> = {}): OxapayConfig {
  return {
    merchantApiKey: 'merchant-key',
    payoutApiKey: 'payout-key',
    baseUrl: 'https://api.oxapay.com/v1',
    sandbox: true,
    timeoutMs: 1000,
    fetch,
    ...overrides,
  }
}

function parseBody(call: RecordedCall): Record<string, unknown> {
  assert.ok(call.init.body, 'expected a request body')
  return JSON.parse(call.init.body) as Record<string, unknown>
}

test('loadOxapayConfig reads env, defaults and sandbox flag', () => {
  const cfg = loadOxapayConfig(
    {
      OXAPAY_MERCHANT_API_KEY: 'm',
      OXAPAY_PAYOUT_API_KEY: 'p',
      OXAPAY_SANDBOX: 'true',
      OXAPAY_TIMEOUT_MS: '2500',
    },
    { fetch: makeFetch(() => jsonResponse({})) .fetch },
  )
  assert.equal(cfg.merchantApiKey, 'm')
  assert.equal(cfg.payoutApiKey, 'p')
  assert.equal(cfg.sandbox, true)
  assert.equal(cfg.timeoutMs, 2500)
  assert.equal(cfg.baseUrl, 'https://api.oxapay.com/v1')
})

test('loadOxapayConfig leaves keys undefined and sandbox false by default', () => {
  const cfg = loadOxapayConfig({}, { fetch: makeFetch(() => jsonResponse({})).fetch })
  assert.equal(cfg.merchantApiKey, undefined)
  assert.equal(cfg.payoutApiKey, undefined)
  assert.equal(cfg.sandbox, false)
})

test('createInvoice posts the documented fields and maps the response', async () => {
  const { fetch, calls } = makeFetch(() =>
    jsonResponse({
      status: 200,
      data: { track_id: 'track-1', payment_url: 'https://pay.oxapay/track-1', expired_at: 1700000000, date: 1699999000 },
    }),
  )
  const result = await createInvoice(makeConfig(fetch), {
    amountUsdt: '10.00',
    orderId: 'ORD-1',
    callbackUrl: 'https://api.tycoonx.top/cb',
    returnUrl: 'https://tycoonx.top/wallet',
    description: 'Deposit',
    lifetimeMinutes: 60,
  })

  assert.equal(result.trackId, 'track-1')
  assert.equal(result.paymentUrl, 'https://pay.oxapay/track-1')
  assert.equal(result.expiredAt, 1700000000)
  assert.equal(result.createdAt, 1699999000)

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.oxapay.com/v1/payment/invoice')
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.headers.merchant_api_key, 'merchant-key')
  const body = parseBody(calls[0])
  assert.equal(body.amount, 10)
  assert.equal(typeof body.amount, 'number')
  assert.equal(body.sandbox, true)
  assert.equal(body.order_id, 'ORD-1')
  assert.equal(body.callback_url, 'https://api.tycoonx.top/cb')
  assert.equal(body.return_url, 'https://tycoonx.top/wallet')
  assert.equal(body.description, 'Deposit')
  assert.equal(body.lifetime, 60)
})

test('createInvoice fails closed without a merchant key and never calls fetch', async () => {
  const { fetch, calls } = makeFetch(() => jsonResponse({ status: 200, data: {} }))
  await assert.rejects(
    () => createInvoice(makeConfig(fetch, { merchantApiKey: undefined }), { amountUsdt: '1' }),
    (error: unknown) => error instanceof OxapayError && error.code === 'not_configured',
  )
  assert.equal(calls.length, 0)
})

test('createInvoice rejects malformed or non-positive amounts', async () => {
  const { fetch, calls } = makeFetch(() => jsonResponse({ status: 200, data: {} }))
  const cfg = makeConfig(fetch)
  await assert.rejects(
    () => createInvoice(cfg, { amountUsdt: '1.2.3' }),
    (error: unknown) => error instanceof OxapayError && error.code === 'invalid_amount',
  )
  await assert.rejects(
    () => createInvoice(cfg, { amountUsdt: '0' }),
    (error: unknown) => error instanceof OxapayError && error.code === 'invalid_amount',
  )
  assert.equal(calls.length, 0)
})

test('createInvoice rejects an incomplete provider response', async () => {
  const { fetch } = makeFetch(() => jsonResponse({ status: 200, data: { track_id: 'x' } }))
  await assert.rejects(
    () => createInvoice(makeConfig(fetch), { amountUsdt: '5' }),
    (error: unknown) => error instanceof OxapayError && error.code === 'invalid_response',
  )
})

test('provider error envelopes surface as provider_error without leaking secrets', async () => {
  const { fetch } = makeFetch(() =>
    jsonResponse(
      {
        status: 400,
        message: 'request rejected for merchant-key',
        error: { type: 'bad_request', key: 'amount', message: 'echo merchant-key' },
      },
      400,
    ),
  )
  await assert.rejects(
    () => createInvoice(makeConfig(fetch), { amountUsdt: '5' }),
    (error: unknown) => {
      assert.ok(error instanceof OxapayError)
      assert.equal(error.code, 'provider_error')
      assert.equal(error.status, 400)
      assert.match(error.message, /type=bad_request/)
      assert.match(error.message, /key=amount/)
      assert.doesNotMatch(error.message, /merchant-key/)
      return true
    },
  )
})

test('non-JSON provider bodies surface as invalid_response', async () => {
  const { fetch } = makeFetch(() => ({ ok: true, status: 200, text: async () => '<html>oops</html>' }))
  await assert.rejects(
    () => createInvoice(makeConfig(fetch), { amountUsdt: '5' }),
    (error: unknown) => error instanceof OxapayError && error.code === 'invalid_response',
  )
})

test('network failures surface as network_error', async () => {
  const { fetch } = makeFetch(() => {
    throw new Error('socket hang up')
  })
  await assert.rejects(
    () => createInvoice(makeConfig(fetch), { amountUsdt: '5' }),
    (error: unknown) => error instanceof OxapayError && error.code === 'network_error',
  )
})

test('a hung provider request times out safely', async () => {
  const { fetch } = makeFetch(() => new Promise<OxapayFetchResponse>(() => {}))
  await assert.rejects(
    () => createInvoice(makeConfig(fetch, { timeoutMs: 20 }), { amountUsdt: '5' }),
    (error: unknown) => error instanceof OxapayError && error.code === 'timeout',
  )
})

test('getPaymentInfo normalizes status and maps transactions', async () => {
  const { fetch, calls } = makeFetch(() =>
    jsonResponse({
      status: 200,
      data: {
        track_id: 'track-2',
        status: 'Paid',
        amount: 10,
        currency: 'USDT',
        order_id: 'ORD-2',
        expired_at: 1700000000,
        date: 1699999000,
        txs: [
          {
            tx_hash: '0xabc',
            amount: 10,
            currency: 'USDT',
            network: 'BNB Smart Chain',
            address: '0xdef',
            status: 'confirmed',
            confirmations: 12,
            date: 1699999500,
          },
        ],
      },
    }),
  )
  const info = await getPaymentInfo(makeConfig(fetch), 'track-2')
  assert.equal(info.status, 'paid')
  assert.equal(info.rawStatus, 'Paid')
  assert.equal(info.amount, '10')
  assert.equal(info.orderId, 'ORD-2')
  assert.equal(info.transactions.length, 1)
  assert.equal(info.transactions[0].txHash, '0xabc')
  assert.equal(info.transactions[0].confirmations, 12)
  assert.equal(calls[0].url, 'https://api.oxapay.com/v1/payment/track-2')
  assert.equal(calls[0].init.method, 'GET')
  assert.equal(calls[0].init.headers.merchant_api_key, 'merchant-key')
})

test('getPaymentInfo requires a track id and rejects unknown statuses as null', async () => {
  const { fetch } = makeFetch(() => jsonResponse({ status: 200, data: { status: 'weird' } }))
  await assert.rejects(
    () => getPaymentInfo(makeConfig(fetch), ''),
    (error: unknown) => error instanceof OxapayError && error.code === 'invalid_input',
  )
  const info = await getPaymentInfo(makeConfig(fetch), 'track-3')
  assert.equal(info.status, null)
})

test('createPayout uses the payout key and maps the response', async () => {
  const { fetch, calls } = makeFetch(() =>
    jsonResponse({ status: 200, data: { track_id: 'pay-1', status: 'Pending' } }),
  )
  const result = await createPayout(makeConfig(fetch), {
    address: '0x0000000000000000000000000000000000000001',
    currency: 'USDT',
    amount: '2.70',
    network: 'BEP20',
    description: 'Withdrawal #1',
  })
  assert.equal(result.trackId, 'pay-1')
  assert.equal(result.status, 'pending')
  assert.equal(calls[0].url, 'https://api.oxapay.com/v1/payout')
  assert.equal(calls[0].init.headers.payout_api_key, 'payout-key')
  const body = parseBody(calls[0])
  assert.equal(body.address, '0x0000000000000000000000000000000000000001')
  assert.equal(body.currency, 'USDT')
  assert.equal(body.amount, 2.7)
  assert.equal(body.network, 'BEP20')
  assert.equal(body.description, 'Withdrawal #1')
})

test('createPayout fails closed without a payout key and validates inputs', async () => {
  const { fetch, calls } = makeFetch(() => jsonResponse({ status: 200, data: { track_id: 'x' } }))
  await assert.rejects(
    () =>
      createPayout(makeConfig(fetch, { payoutApiKey: undefined }), {
        address: '0x1',
        currency: 'USDT',
        amount: '1',
      }),
    (error: unknown) => error instanceof OxapayError && error.code === 'not_configured',
  )
  await assert.rejects(
    () => createPayout(makeConfig(fetch), { address: '', currency: 'USDT', amount: '1' }),
    (error: unknown) => error instanceof OxapayError && error.code === 'invalid_input',
  )
  assert.equal(calls.length, 0)
})

test('getPayoutInfo maps the payout status and details', async () => {
  const { fetch, calls } = makeFetch(() =>
    jsonResponse({
      status: 200,
      data: {
        track_id: 'pay-2',
        status: 'Confirmed',
        address: '0x2',
        currency: 'USDT',
        network: 'BEP20',
        amount: 2.7,
        fee: 0.3,
        tx_hash: '0xdead',
        date: 1699999000,
      },
    }),
  )
  const info = await getPayoutInfo(makeConfig(fetch), 'pay-2')
  assert.equal(info.status, 'confirmed')
  assert.equal(info.rawStatus, 'Confirmed')
  assert.equal(info.amount, '2.7')
  assert.equal(info.fee, '0.3')
  assert.equal(info.txHash, '0xdead')
  assert.equal(calls[0].init.headers.payout_api_key, 'payout-key')
})

test('getSupportedCurrencies parses the live currencies shape (public, no key)', async () => {
  const { fetch, calls } = makeFetch(() =>
    jsonResponse({
      status: 200,
      data: {
        USDT: {
          symbol: 'USDT',
          name: 'Tether',
          status: true,
          networks: {
            Ethereum: { network: 'Ethereum', name: 'Ethereum Network', deposit_min: '0.01' },
            BSC: { network: 'BSC', name: 'Binance Smart Chain', deposit_min: '0.01' },
          },
        },
        BUSD: { symbol: 'BUSD', name: 'Binance USD', status: false, networks: {} },
      },
    }),
  )
  // No merchant key required for the public endpoint.
  const currencies = await getSupportedCurrencies(makeConfig(fetch, { merchantApiKey: undefined }))

  assert.equal(currencies.length, 2)
  const usdt = currencies.find((c) => c.symbol === 'USDT')!
  assert.equal(usdt.status, true)
  assert.deepEqual(
    usdt.networks.map((n) => `${n.network}:${n.name}`),
    ['Ethereum:Ethereum Network', 'BSC:Binance Smart Chain'],
  )
  assert.equal(usdt.networks[0].depositMin, '0.01')

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.oxapay.com/v1/common/currencies')
  assert.equal(calls[0].init.method, 'GET')
  assert.equal(calls[0].init.headers.merchant_api_key, undefined)
})

test('getSupportedCurrencies tolerates the legacy networkList shape', async () => {
  const { fetch } = makeFetch(() =>
    jsonResponse({
      status: 200,
      data: { USDT: { symbol: 'USDT', status: true, networkList: { TRC20: { network: 'TRC20', name: 'Tron (TRC20)' } } } },
    }),
  )
  const currencies = await getSupportedCurrencies(makeConfig(fetch))
  assert.equal(currencies[0].networks[0].network, 'TRC20')
})

test('getAcceptedCurrencies requires the merchant key and returns the symbol list', async () => {
  const { fetch, calls } = makeFetch(() =>
    jsonResponse({ status: 200, data: { list: ['BTC', 'USDT', 'POL'] } }),
  )
  const accepted = await getAcceptedCurrencies(makeConfig(fetch))
  assert.deepEqual(accepted, ['BTC', 'USDT', 'POL'])
  assert.equal(calls[0].url, 'https://api.oxapay.com/v1/payment/accepted-currencies')
  assert.equal(calls[0].init.headers.merchant_api_key, 'merchant-key')
})

test('getAcceptedCurrencies fails closed without a merchant key and never calls fetch', async () => {
  const { fetch, calls } = makeFetch(() => jsonResponse({ status: 200, data: { list: [] } }))
  await assert.rejects(
    () => getAcceptedCurrencies(makeConfig(fetch, { merchantApiKey: undefined })),
    (error: unknown) => error instanceof OxapayError && error.code === 'not_configured',
  )
  assert.equal(calls.length, 0)
})

test('a v1 success envelope with an empty error object is not treated as a failure', async () => {
  const { fetch } = makeFetch(() =>
    jsonResponse({ status: 200, error: {}, data: { track_id: 't1', payment_url: 'https://pay/t1' } }),
  )
  const result = await createInvoice(makeConfig(fetch), { amountUsdt: '1' })
  assert.equal(result.trackId, 't1')
})

test('createInvoice sends fee_paid_by_payer only when explicitly set', async () => {
  const withFee = makeFetch(() =>
    jsonResponse({ status: 200, data: { track_id: 't1', payment_url: 'https://pay/t1' } }),
  )
  await createInvoice(makeConfig(withFee.fetch), { amountUsdt: '5', feePaidByPayer: true })
  assert.equal(parseBody(withFee.calls[0]).fee_paid_by_payer, 1)

  const withoutFee = makeFetch(() =>
    jsonResponse({ status: 200, data: { track_id: 't2', payment_url: 'https://pay/t2' } }),
  )
  await createInvoice(makeConfig(withoutFee.fetch), { amountUsdt: '5' })
  assert.equal('fee_paid_by_payer' in parseBody(withoutFee.calls[0]), false)
})
