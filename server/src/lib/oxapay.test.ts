import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDepositDiagnostic,
  canonicalizeStatus,
  compareDecimal,
  computeHmacSha512,
  decimalEquals,
  evaluateDepositSettlement,
  isDecimalAtLeast,
  isPaymentSettled,
  isPayoutConfirmed,
  isPayoutFailed,
  normalizePaymentStatus,
  normalizePayoutStatus,
  synthesizeWebhookEventId,
  toDecimalString,
  verifyHmacSha512,
} from './oxapay'

const BODY = '{"track_id":"151811887","status":"Paid","amount":10}'
const SECRET = 'test-secret-key'
// Independently generated HMAC-SHA512(body, SECRET) hex vector.
const SIGNATURE =
  'd94667155269d59429ce3685ec874bfd88d14cbf7d743988b9cb903057bd36c12959ef5759213ab1d6e50c8a792c2b2ad605bd1aaf4b29d6965fe4fde4a4064b'

test('computeHmacSha512 matches a known vector', () => {
  assert.equal(computeHmacSha512(BODY, SECRET), SIGNATURE)
})

test('verifyHmacSha512 accepts a valid signature (case-insensitive hex)', () => {
  assert.equal(verifyHmacSha512(BODY, SIGNATURE, SECRET), true)
  assert.equal(verifyHmacSha512(BODY, SIGNATURE.toUpperCase(), SECRET), true)
})

test('verifyHmacSha512 rejects tampered bodies, wrong keys and malformed signatures', () => {
  assert.equal(verifyHmacSha512(`${BODY} `, SIGNATURE, SECRET), false)
  assert.equal(verifyHmacSha512(BODY, SIGNATURE, 'other-key'), false)
  assert.equal(verifyHmacSha512(BODY, undefined, SECRET), false)
  assert.equal(verifyHmacSha512(BODY, null, SECRET), false)
  assert.equal(verifyHmacSha512(BODY, '', SECRET), false)
  assert.equal(verifyHmacSha512(BODY, 'not-hex!!', SECRET), false)
  assert.equal(verifyHmacSha512(BODY, SIGNATURE.slice(0, -1), SECRET), false)
  assert.equal(verifyHmacSha512(BODY, SIGNATURE.slice(0, 20), SECRET), false)
})

test('verifyHmacSha512 accepts a raw Buffer body', () => {
  assert.equal(verifyHmacSha512(Buffer.from(BODY, 'utf8'), SIGNATURE, SECRET), true)
})

test('canonicalizeStatus normalizes casing, spaces and dashes', () => {
  assert.equal(canonicalizeStatus('  Manual Accept '), 'manual_accept')
  assert.equal(canonicalizeStatus('MANUAL-ACCEPT'), 'manual_accept')
})

test('payment statuses normalize case-insensitively and reject unknown values', () => {
  assert.equal(normalizePaymentStatus('Paid'), 'paid')
  assert.equal(normalizePaymentStatus('PAID'), 'paid')
  assert.equal(normalizePaymentStatus('paying'), 'paying')
  assert.equal(normalizePaymentStatus('Manual Accept'), 'manual_accept')
  assert.equal(normalizePaymentStatus('underpaid'), 'underpaid')
  assert.equal(normalizePaymentStatus('refunding'), 'refunding')
  assert.equal(normalizePaymentStatus('expired'), 'expired')
  assert.equal(normalizePaymentStatus('bogus'), null)
  assert.equal(normalizePaymentStatus(42), null)
})

test('payout statuses normalize case-insensitively, alias cancelled, reject unknown', () => {
  assert.equal(normalizePayoutStatus('Confirming'), 'confirming')
  assert.equal(normalizePayoutStatus('CONFIRMED'), 'confirmed')
  assert.equal(normalizePayoutStatus('Cancelled'), 'canceled')
  assert.equal(normalizePayoutStatus('canceled'), 'canceled')
  assert.equal(normalizePayoutStatus('Failed'), 'failed')
  assert.equal(normalizePayoutStatus('processing'), 'processing')
  assert.equal(normalizePayoutStatus('nope'), null)
  assert.equal(normalizePayoutStatus(null), null)
})

test('settlement helpers treat only documented terminal states as such', () => {
  assert.equal(isPaymentSettled('Paid'), true)
  assert.equal(isPaymentSettled('Paying'), false)
  assert.equal(isPaymentSettled('manual_accept'), false)
  assert.equal(isPayoutConfirmed('Confirmed'), true)
  assert.equal(isPayoutConfirmed('confirming'), false)
  assert.equal(isPayoutFailed('Canceled'), true)
  assert.equal(isPayoutFailed('rejected'), true)
  assert.equal(isPayoutFailed('Failed'), true)
  assert.equal(isPayoutFailed('confirmed'), false)
})

test('synthesizeWebhookEventId is stable and includes the transaction hash', () => {
  assert.equal(
    synthesizeWebhookEventId({ trackId: '151811887', status: 'Paid', txHash: '0xABC' }),
    '151811887:paid:0xabc',
  )
  assert.equal(
    synthesizeWebhookEventId({ trackId: '151811887', status: 'paid', txHash: '0xabc' }),
    '151811887:paid:0xabc',
  )
  assert.equal(synthesizeWebhookEventId({ trackId: '151811887', status: 'Paid' }), '151811887:paid:')
  assert.notEqual(
    synthesizeWebhookEventId({ trackId: '151811887', status: 'Paid', txHash: 'a' }),
    synthesizeWebhookEventId({ trackId: '151811887', status: 'Paid', txHash: 'b' }),
  )
  assert.notEqual(
    synthesizeWebhookEventId({ trackId: '151811887', status: 'Paying' }),
    synthesizeWebhookEventId({ trackId: '151811887', status: 'Paid' }),
  )
})

test('synthesizeWebhookEventId requires a track id', () => {
  assert.throws(() => synthesizeWebhookEventId({ trackId: '', status: 'Paid' }))
  assert.throws(() => synthesizeWebhookEventId({ trackId: '   ', status: 'Paid' }))
})

test('toDecimalString canonicalizes without floating-point math', () => {
  assert.equal(toDecimalString('0001.100'), '1.1')
  assert.equal(toDecimalString('0.000'), '0')
  assert.equal(toDecimalString('-0.00'), '0')
  assert.equal(toDecimalString('10.'), '10')
  assert.equal(toDecimalString(10n), '10')
  assert.equal(toDecimalString('3.6839'), '3.6839')
  assert.throws(() => toDecimalString('1.2.3'))
  assert.throws(() => toDecimalString('abc'))
})

test('compareDecimal compares exactly, ignoring formatting differences', () => {
  assert.equal(compareDecimal('1.10', '1.1'), 0)
  assert.equal(compareDecimal('01.100', '1.1'), 0)
  assert.equal(compareDecimal('0.30', '0.3'), 0)
  assert.equal(compareDecimal('10', '9.999999'), 1)
  assert.equal(compareDecimal('9.999999', '10'), -1)
  assert.equal(compareDecimal('0.001', '0'), 1)
  assert.equal(compareDecimal('0', '0.000'), 0)
  assert.equal(compareDecimal('-1', '0'), -1)
  assert.equal(compareDecimal('-2', '-1.5'), -1)
  assert.equal(compareDecimal('100', '100.000001'), -1)
})

test('decimalEquals and isDecimalAtLeast behave consistently', () => {
  assert.equal(decimalEquals('5.00', '5'), true)
  assert.equal(decimalEquals('5.00', '5.01'), false)
  assert.equal(isDecimalAtLeast('10.00', '9.99'), true)
  assert.equal(isDecimalAtLeast('9.99', '10'), false)
  assert.equal(isDecimalAtLeast('10', '10'), true)
})

const USDT_BEP20 = { asset: 'USDT', network: 'BEP20' }

test('deposit settlement requires a paid status, matching amount, and an allowlisted pair', () => {
  const intent = { amountUsdt: '10.00' }
  assert.deepEqual(evaluateDepositSettlement({ status: 'Paid', amount: 10, ...USDT_BEP20 }, intent), { settle: true })
  assert.deepEqual(evaluateDepositSettlement({ status: 'paid', amount: '10.000', ...USDT_BEP20 }, intent), {
    settle: true,
  })
  assert.deepEqual(evaluateDepositSettlement({ status: 'Paid', amount: '10.01', ...USDT_BEP20 }, intent), {
    settle: false,
    reason: 'amount_mismatch',
  })
  assert.deepEqual(evaluateDepositSettlement({ status: 'Paid', amount: '9.99', ...USDT_BEP20 }, intent), {
    settle: false,
    reason: 'amount_mismatch',
  })
})

test('deposit settlement never treats uncertain statuses as settled', () => {
  const intent = { amountUsdt: '10.00' }
  for (const status of ['Paying', 'manual_accept', 'underpaid', 'new', 'waiting', 'expired', 'refunding', 'refunded', 'bogus']) {
    assert.deepEqual(evaluateDepositSettlement({ status, amount: 10, ...USDT_BEP20 }, intent), {
      settle: false,
      reason: 'non_confirming',
    })
  }
})

test('deposit settlement fails closed when the amount is missing or malformed', () => {
  const intent = { amountUsdt: '10.00' }
  assert.deepEqual(evaluateDepositSettlement({ status: 'Paid', ...USDT_BEP20 }, intent), {
    settle: false,
    reason: 'amount_missing',
  })
  assert.deepEqual(evaluateDepositSettlement({ status: 'Paid', amount: '', ...USDT_BEP20 }, intent), {
    settle: false,
    reason: 'amount_missing',
  })
  assert.deepEqual(evaluateDepositSettlement({ status: 'Paid', amount: 'nope', ...USDT_BEP20 }, intent), {
    settle: false,
    reason: 'amount_mismatch',
  })
})

test('deposit settlement rejects unsupported assets, networks and pairs', () => {
  const intent = { amountUsdt: '10.00' }
  assert.deepEqual(evaluateDepositSettlement({ status: 'Paid', amount: 10, network: 'BSC' }, intent), {
    settle: false,
    reason: 'unsupported_asset',
  })
  assert.deepEqual(evaluateDepositSettlement({ status: 'Paid', amount: 10, asset: 'USDT' }, intent), {
    settle: false,
    reason: 'unsupported_network',
  })
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'Paid', amount: 10, asset: 'BTC', network: 'Ethereum' }, intent),
    { settle: false, reason: 'unsupported_pair' },
  )
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'Paid', amount: 10, asset: 'USDC', network: 'Dogecoin' }, intent),
    { settle: false, reason: 'unsupported_pair' },
  )
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'Paid', amount: 10, asset: 'DOGE', network: 'Solana' }, intent),
    { settle: false, reason: 'unsupported_pair' },
  )
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'Paid', amount: 10, asset: 'XRP', network: 'XRP' }, intent),
    { settle: false, reason: 'unsupported_network' },
  )
})

test('deposit settlement accepts verified live codes, names and legacy aliases', () => {
  const intent = { amountUsdt: '10.00' }
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'Paid', amount: 10, asset: 'usdt', network: 'Binance Smart Chain' }, intent),
    { settle: true },
  )
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'Paid', amount: 10, asset: 'USDT', network: 'BEP20' }, intent),
    { settle: true },
  )
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'Paid', amount: 10, asset: 'BTC', network: 'Bitcoin network' }, intent),
    { settle: true },
  )
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'Paid', amount: 10, asset: 'SOL', network: 'Solana' }, intent),
    { settle: true },
  )
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'Paid', amount: 10, asset: 'XRP', network: 'xrpl' }, intent),
    { settle: true },
  )
})

test('deposit settlement enforces order and asset/network expectations when configured', () => {
  const base = { amountUsdt: '10.00', orderId: 'dep_1', asset: 'USDT', network: 'TRC20' }
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'Paid', amount: 10, orderId: 'dep_1', asset: 'USDT', network: 'TRC20' }, base),
    { settle: true },
  )
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'Paid', amount: 10, orderId: 'other', asset: 'USDT', network: 'TRC20' }, base),
    { settle: false, reason: 'order_mismatch' },
  )
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'Paid', amount: 10, orderId: 'dep_1', asset: 'USDC', network: 'ERC20' }, base),
    { settle: false, reason: 'asset_mismatch' },
  )
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'Paid', amount: 10, orderId: 'dep_1', asset: 'USDT', network: 'BEP20' }, base),
    { settle: false, reason: 'network_mismatch' },
  )
})

test('deposit settlement skips unconfigured order/asset/network expectations', () => {
  const intent = { amountUsdt: '10.00' }
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'Paid', amount: 10, orderId: 'anything', asset: 'USDT', network: 'Polygon' }, intent),
    { settle: true },
  )
})

test('deposit diagnostic emits only non-sensitive fields', () => {
  const d = buildDepositDiagnostic({
    outcome: 'settled',
    status: 'Paid',
    asset: 'USDT',
    network: 'BSC',
    invoiceAmountUsdt: '1.00',
    creditedSp: 1000n,
    paymentIntentId: 5,
  })
  assert.deepEqual(Object.keys(d).sort(), [
    'asset',
    'creditedSp',
    'invoiceAmountUsdt',
    'network',
    'outcome',
    'paymentIntentId',
    'status',
  ])
  assert.equal(d.creditedSp, '1000')
  assert.equal(d.invoiceAmountUsdt, '1.00')

  const ignored = buildDepositDiagnostic({ outcome: 'amount_mismatch' })
  assert.equal(ignored.creditedSp, null)
  assert.equal(ignored.paymentIntentId, null)
})
