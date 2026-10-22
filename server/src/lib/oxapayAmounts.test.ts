import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareDecimal, evaluateDepositSettlement, toDecimalString } from './oxapay'

/**
 * OxaPay deposit amount/fee semantics, from the official docs.
 *
 * - Invoice amount: top-level `amount` — Payment Information defines it as
 *   "The total amount of the invoice in the specified currency"
 *   (https://docs.oxapay.com/api-reference/payment/payment-information.md).
 * - `fee_paid_by_payer`: 1 = payer covers the fee, 0 = merchant covers the fee
 *   (https://docs.oxapay.com/api-reference/payment/generate-invoice.md).
 * - Webhook-only sample fields `value`, `sent_value`, `txs[].sent_amount`,
 *   `txs[].received_amount`, `rate`, `auto_convert_amount` appear in the IPN
 *   sample but are NOT described in the API schema
 *   (https://docs.oxapay.com/webhook.md). They are therefore informational.
 *
 * The exact field that equals the amount credited to the merchant balance (and
 * thus the SP base) is NOT documented. The current settlement rule credits the
 * verified invoice amount (documented safe default) and fails closed otherwise;
 * the net/gross rule remains an owner decision (Master Spec §9).
 */

// Official OxaPay "Paid IPN" sample (https://docs.oxapay.com/webhook.md).
const PAID_IPN = {
  track_id: '151811887',
  status: 'Paid',
  type: 'invoice',
  amount: 10,
  value: 3.6839,
  sent_value: 3.6839,
  currency: 'POL',
  order_id: 'ORD-12345',
  fee_paid_by_payer: 0,
  under_paid_coverage: 0,
  txs: [
    {
      status: 'confirmed',
      tx_hash: 'x',
      sent_amount: 10,
      received_amount: 9.85,
      value: 3.6839,
      sent_value: 3.6839,
      currency: 'POL',
      network: 'Polygon Network',
      rate: 0.36839,
      confirmations: 250,
      auto_convert_amount: 3.62864,
      auto_convert_currency: 'USDT',
    },
  ],
}

test('documented Paid IPN distinguishes invoice, sent, received and auto-converted amounts', () => {
  const tx = PAID_IPN.txs[0]

  // Invoice amount in the invoice currency (USD here, since no `currency` was set).
  assert.equal(toDecimalString(PAID_IPN.amount), '10')

  // Webhook-only sample fields: sent vs received differ, implying a fee (10 - 9.85).
  assert.equal(toDecimalString(tx.sent_amount), '10')
  assert.equal(toDecimalString(tx.received_amount), '9.85')
  assert.equal(compareDecimal(tx.sent_amount, tx.received_amount), 1)

  // Auto-converted received amount (settlement currency), also webhook-only.
  assert.equal(toDecimalString(tx.auto_convert_amount), '3.62864')
  assert.equal(tx.auto_convert_currency, 'USDT')

  // fee_paid_by_payer 0 => the merchant pays the fee (generate-invoice docs).
  assert.equal(PAID_IPN.fee_paid_by_payer, 0)
})

test('settlement credits only the exact invoice amount, never net or fee-reduced fields', () => {
  // No asset/network expectation so the amount logic is isolated.
  const intent = { amountUsdt: '10.00' }
  const pair = { asset: 'USDT', network: 'BEP20' }

  // The documented invoice amount matches the intent -> settle.
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'Paid', amount: PAID_IPN.amount, ...pair }, intent),
    { settle: true },
  )

  // A fee-reduced received amount (txs[].received_amount = 9.85) is NOT credited.
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'Paid', amount: PAID_IPN.txs[0].received_amount, ...pair }, intent),
    { settle: false, reason: 'amount_mismatch' },
  )

  // The auto-converted USDT amount (3.62864) is NOT credited either.
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'Paid', amount: PAID_IPN.txs[0].auto_convert_amount, ...pair }, intent),
    { settle: false, reason: 'amount_mismatch' },
  )

  // The crypto value/sent_value (3.6839 POL) is NOT the invoice amount.
  assert.deepEqual(
    evaluateDepositSettlement({ status: 'Paid', amount: PAID_IPN.value, ...pair }, intent),
    { settle: false, reason: 'amount_mismatch' },
  )
})

test('settlement fails closed when the invoice amount is absent from the callback', () => {
  const intent = { amountUsdt: '10.00' }
  assert.deepEqual(evaluateDepositSettlement({ status: 'Paid', asset: 'USDT', network: 'BEP20' }, intent), {
    settle: false,
    reason: 'amount_missing',
  })
})
