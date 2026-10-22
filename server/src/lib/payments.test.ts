import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PAYMENTS_ENABLED,
  isValidUsdtAmount,
  nextIntentStatus,
  nextPurchaseStatus,
  spToUsdtString,
  usdtToSp,
} from './payments'

test('payments are enabled (deposits activated)', () => {
  assert.equal(PAYMENTS_ENABLED, true)
})

test('usdt amounts are validated', () => {
  assert.equal(isValidUsdtAmount('0.99'), true)
  assert.equal(isValidUsdtAmount('1000'), true)
  assert.equal(isValidUsdtAmount('1.234567'), true)
  assert.equal(isValidUsdtAmount(''), false)
  assert.equal(isValidUsdtAmount('-1'), false)
  assert.equal(isValidUsdtAmount('1.2345678'), false)
  assert.equal(isValidUsdtAmount('abc'), false)
})

test('USDT converts to integer SP exactly (1 USDT = 1,000 SP)', () => {
  assert.equal(usdtToSp('0.99'), 990n)
  assert.equal(usdtToSp('1'), 1000n)
  assert.equal(usdtToSp('999.99'), 999990n)
  assert.equal(usdtToSp('0.001'), 1n)
  assert.equal(usdtToSp('12.3456'), 12345n) // extra decimals truncated to thousandths
  assert.throws(() => usdtToSp('nope'))
})

test('SP formats back to USDT strings', () => {
  assert.equal(spToUsdtString(990n, 2), '0.99')
  assert.equal(spToUsdtString(12340n, 2), '12.34')
  assert.equal(spToUsdtString(0n, 2), '0.00')
  assert.equal(spToUsdtString(-500n, 2), '-0.50')
})

test('payment intent transitions are constrained', () => {
  assert.equal(nextIntentStatus('CREATED', 'confirm'), 'CONFIRMED')
  assert.equal(nextIntentStatus('PENDING', 'confirm'), 'CONFIRMED')
  assert.equal(nextIntentStatus('CONFIRMED', 'confirm'), null)
  assert.equal(nextIntentStatus('CONFIRMED', 'fail'), null)
  assert.equal(nextIntentStatus('CREATED', 'cancel'), 'CANCELLED')
  assert.equal(nextIntentStatus('PENDING', 'cancel'), null)
})

test('purchase transitions are constrained', () => {
  assert.equal(nextPurchaseStatus('PENDING', 'pay'), 'PAID')
  assert.equal(nextPurchaseStatus('PAID', 'deliver'), 'DELIVERED')
  assert.equal(nextPurchaseStatus('PENDING', 'deliver'), null)
  assert.equal(nextPurchaseStatus('DELIVERED', 'refund'), 'REFUNDED')
  assert.equal(nextPurchaseStatus('FAILED', 'pay'), null)
})
