import { createHmac, timingSafeEqual } from 'node:crypto'
import { isSupportedDepositPair, normalizeAsset, normalizeNetwork } from './oxapayAssets'

/**
 * OxaPay provider primitives (pure, no I/O).
 *
 * Provider status values, callback event IDs, HMAC-SHA512 callback verification
 * and exact decimal amount comparison. Nothing here enables payments or payouts;
 * the gates in `lib/payments` remain authoritative.
 *
 * Verified against OxaPay v1 docs:
 *  - payment statuses: new, waiting, paying, paid, manual_accept, underpaid,
 *    refunding, refunded, expired
 *  - payout statuses: processing, pending, confirming, confirmed, canceled,
 *    rejected (callbacks also use "Failed")
 *  - callback HMAC: HMAC-SHA512 over the exact raw body, secret = the relevant
 *    API key (merchant for invoice callbacks, payout for payout callbacks),
 *    signature sent in the `HMAC` HTTP header as hex.
 */

export type NormalizedPaymentStatus =
  | 'new'
  | 'waiting'
  | 'paying'
  | 'paid'
  | 'manual_accept'
  | 'underpaid'
  | 'refunding'
  | 'refunded'
  | 'expired'

export type NormalizedPayoutStatus =
  | 'processing'
  | 'pending'
  | 'confirming'
  | 'confirmed'
  | 'canceled'
  | 'rejected'
  | 'failed'

const PAYMENT_STATUSES: readonly NormalizedPaymentStatus[] = [
  'new',
  'waiting',
  'paying',
  'paid',
  'manual_accept',
  'underpaid',
  'refunding',
  'refunded',
  'expired',
]

const PAYOUT_STATUSES: readonly NormalizedPayoutStatus[] = [
  'processing',
  'pending',
  'confirming',
  'confirmed',
  'canceled',
  'rejected',
  'failed',
]

const PAYMENT_STATUS_SET = new Set<string>(PAYMENT_STATUSES)
const PAYOUT_STATUS_SET = new Set<string>(PAYOUT_STATUSES)

/**
 * Only `paid` is treated as a settled deposit. `manual_accept` is intentionally
 * excluded pending an explicit owner rule; do not broaden this without approval.
 */
export const SETTLED_PAYMENT_STATUSES: readonly NormalizedPaymentStatus[] = ['paid']

export const CONFIRMED_PAYOUT_STATUSES: readonly NormalizedPayoutStatus[] = ['confirmed']

export const FAILED_PAYOUT_STATUSES: readonly NormalizedPayoutStatus[] = ['canceled', 'rejected', 'failed']

/** Canonicalizes a provider status token: trim, lowercase, spaces/dashes -> underscore. */
export function canonicalizeStatus(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

/** Normalizes a documented payment status case-insensitively; returns null if unknown. */
export function normalizePaymentStatus(raw: unknown): NormalizedPaymentStatus | null {
  if (typeof raw !== 'string') return null
  const canonical = canonicalizeStatus(raw)
  return PAYMENT_STATUS_SET.has(canonical) ? (canonical as NormalizedPaymentStatus) : null
}

/** Normalizes a documented payout status case-insensitively; returns null if unknown. */
export function normalizePayoutStatus(raw: unknown): NormalizedPayoutStatus | null {
  if (typeof raw !== 'string') return null
  const canonical = canonicalizeStatus(raw)
  const aliased = canonical === 'cancelled' ? 'canceled' : canonical
  return PAYOUT_STATUS_SET.has(aliased) ? (aliased as NormalizedPayoutStatus) : null
}

export function isPaymentSettled(raw: unknown): boolean {
  const status = normalizePaymentStatus(raw)
  return status !== null && SETTLED_PAYMENT_STATUSES.includes(status)
}

export function isPayoutConfirmed(raw: unknown): boolean {
  const status = normalizePayoutStatus(raw)
  return status !== null && CONFIRMED_PAYOUT_STATUSES.includes(status)
}

export function isPayoutFailed(raw: unknown): boolean {
  const status = normalizePayoutStatus(raw)
  return status !== null && FAILED_PAYOUT_STATUSES.includes(status)
}

export interface WebhookEventIdentity {
  trackId: string
  status: string
  txHash?: string | null
}

/**
 * Builds a stable, deterministic webhook event ID from the provider track ID,
 * status and (when present) the transaction hash. Replayed deliveries of the
 * same provider transition therefore collapse to one event ID.
 */
export function synthesizeWebhookEventId(input: WebhookEventIdentity): string {
  const trackId = typeof input.trackId === 'string' ? input.trackId.trim() : ''
  if (!trackId) throw new Error('trackId is required to synthesize a webhook event id')
  const status = typeof input.status === 'string' ? canonicalizeStatus(input.status) : ''
  const txHash = typeof input.txHash === 'string' ? input.txHash.trim().toLowerCase() : ''
  return `${trackId}:${status}:${txHash}`
}

/** HMAC-SHA512 (hex) over the exact raw body using the shared API key. */
export function computeHmacSha512(rawBody: string | Buffer, secret: string): string {
  return createHmac('sha512', secret).update(rawBody).digest('hex')
}

const HEX_RE = /^[0-9a-fA-F]+$/

/**
 * Constant-time verification of an OxaPay callback signature.
 * Length is checked before `timingSafeEqual` (which throws on unequal lengths).
 * Non-hex, empty or malformed signatures fail closed.
 */
export function verifyHmacSha512(
  rawBody: string | Buffer,
  signature: string | null | undefined,
  secret: string,
): boolean {
  if (typeof signature !== 'string') return false
  const provided = signature.trim()
  if (!provided || provided.length % 2 !== 0 || !HEX_RE.test(provided)) return false

  const expected = createHmac('sha512', secret).update(rawBody).digest()
  const received = Buffer.from(provided, 'hex')
  if (received.length !== expected.length) return false
  return timingSafeEqual(expected, received)
}

interface ParsedDecimal {
  neg: boolean
  int: string
  frac: string
}

const DECIMAL_RE = /^[0-9]*\.?[0-9]*$/

function parseDecimal(input: string): ParsedDecimal {
  let s = input.trim()
  if (s === '') throw new Error('invalid decimal')
  let neg = false
  if (s[0] === '+') s = s.slice(1)
  else if (s[0] === '-') {
    neg = true
    s = s.slice(1)
  }
  if (s === '' || !DECIMAL_RE.test(s)) throw new Error('invalid decimal')
  const parts = s.split('.')
  if (parts.length > 2) throw new Error('invalid decimal')
  const rawInt = parts[0] ?? ''
  const rawFrac = parts[1] ?? ''
  if (rawInt === '' && rawFrac === '') throw new Error('invalid decimal')
  const int = rawInt.replace(/^0+/, '') || '0'
  return { neg, int, frac: rawFrac }
}

/**
 * Converts a decimal string/number/bigint to a canonical decimal string
 * (no leading zeros, no trailing fractional zeros, no trailing dot). Never uses
 * floating-point arithmetic for string inputs. Number inputs use the shortest
 * round-trip representation and reject exponential notation.
 */
export function toDecimalString(value: string | number | bigint): string {
  let s: string
  if (typeof value === 'bigint') {
    s = value.toString()
  } else if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('invalid decimal')
    s = String(value)
    if (/[eE]/.test(s)) throw new Error('invalid decimal')
  } else {
    s = value.trim()
  }
  const parsed = parseDecimal(s)
  const frac = parsed.frac.replace(/0+$/, '')
  const isZero = parsed.int === '0' && frac === ''
  if (isZero) return '0'
  const body = frac ? `${parsed.int}.${frac}` : parsed.int
  return parsed.neg ? `-${body}` : body
}

function compareMagnitude(a: ParsedDecimal, b: ParsedDecimal): -1 | 0 | 1 {
  if (a.int.length !== b.int.length) return a.int.length > b.int.length ? 1 : -1
  if (a.int !== b.int) return a.int > b.int ? 1 : -1
  const width = Math.max(a.frac.length, b.frac.length)
  const af = a.frac.padEnd(width, '0')
  const bf = b.frac.padEnd(width, '0')
  if (af === bf) return 0
  return af > bf ? 1 : -1
}

/**
 * Exact decimal comparison (`-1`, `0`, `1`) with no floating-point math.
 * Accepts strings (preferred), numbers or bigints; strings are compared exactly.
 */
export function compareDecimal(a: string | number | bigint, b: string | number | bigint): -1 | 0 | 1 {
  const x = parseDecimal(toDecimalString(a))
  const y = parseDecimal(toDecimalString(b))
  const xZero = x.int === '0' && x.frac === ''
  const yZero = y.int === '0' && y.frac === ''
  if (xZero && yZero) return 0
  if (xZero) return y.neg ? 1 : -1
  if (yZero) return x.neg ? -1 : 1
  if (x.neg !== y.neg) return x.neg ? -1 : 1
  const magnitude = compareMagnitude(x, y)
  return x.neg ? ((-magnitude) as -1 | 0 | 1) : magnitude
}

export function decimalEquals(a: string | number | bigint, b: string | number | bigint): boolean {
  return compareDecimal(a, b) === 0
}

/** True when `actual` >= `expected` (e.g. not underpaid). */
export function isDecimalAtLeast(
  actual: string | number | bigint,
  expected: string | number | bigint,
): boolean {
  return compareDecimal(actual, expected) >= 0
}

export type DepositSettlementReason =
  | 'non_confirming'
  | 'amount_missing'
  | 'amount_mismatch'
  | 'order_mismatch'
  | 'unsupported_asset'
  | 'unsupported_network'
  | 'unsupported_pair'
  | 'asset_mismatch'
  | 'network_mismatch'

export type DepositSettlementDecision = { settle: true } | { settle: false; reason: DepositSettlementReason }

export interface DepositCallbackEvidence {
  status: string
  amount?: string | number | null
  /** Provider-reported crypto asset symbol (e.g. USDT). */
  asset?: string | null
  /** Provider-reported network code or name (e.g. BEP20 / "BNB Smart Chain"). */
  network?: string | null
  orderId?: string | null
}

export interface DepositIntentExpectation {
  amountUsdt: string
  orderId?: string | null
  /** Optional expected asset; enforced when set. */
  asset?: string | null
  /** Optional expected network (code or documented name); enforced when set. */
  network?: string | null
}

/**
 * Pure deposit settlement rule. Settles only when:
 *  - the normalized provider status is exactly `paid` (manual_accept, underpaid,
 *    paying, expired, refunded, etc. are never settled);
 *  - the provider-reported invoice amount is present and exactly equals the
 *    intent amount (exact decimal comparison, no floating point);
 *  - when an order id expectation exists and the callback carries one, they match;
 *  - the reported asset and network are present, individually known, and form a
 *    verified allowlisted pair (unsupported/unverified pairs fail closed);
 *  - when an asset/network expectation is configured, it matches.
 *
 * The final settled/net amount and fee rule are owner decisions (Master Spec §9);
 * this helper performs only the documented invoice-amount, identifier and
 * allowlist consistency checks and never invents a net/fee rule.
 */
export function evaluateDepositSettlement(
  callback: DepositCallbackEvidence,
  intent: DepositIntentExpectation,
): DepositSettlementDecision {
  if (!isPaymentSettled(callback.status)) return { settle: false, reason: 'non_confirming' }

  if (callback.amount === undefined || callback.amount === null || callback.amount === '') {
    return { settle: false, reason: 'amount_missing' }
  }

  let reported: string
  let expected: string
  try {
    reported = toDecimalString(callback.amount)
    expected = toDecimalString(intent.amountUsdt)
  } catch {
    return { settle: false, reason: 'amount_mismatch' }
  }
  if (!decimalEquals(reported, expected)) return { settle: false, reason: 'amount_mismatch' }

  const expectedOrder = typeof intent.orderId === 'string' ? intent.orderId.trim() : ''
  const callbackOrder = typeof callback.orderId === 'string' ? callback.orderId.trim() : ''
  if (expectedOrder && callbackOrder && expectedOrder !== callbackOrder) {
    return { settle: false, reason: 'order_mismatch' }
  }

  const reportedAsset = normalizeAsset(callback.asset)
  if (!reportedAsset) return { settle: false, reason: 'unsupported_asset' }
  const reportedNetwork = normalizeNetwork(callback.network)
  if (!reportedNetwork) return { settle: false, reason: 'unsupported_network' }
  if (!isSupportedDepositPair(reportedAsset, reportedNetwork)) {
    return { settle: false, reason: 'unsupported_pair' }
  }

  const expectedAsset = normalizeAsset(intent.asset)
  if (expectedAsset && expectedAsset !== reportedAsset) return { settle: false, reason: 'asset_mismatch' }

  const expectedNetwork = normalizeNetwork(intent.network)
  if (intent.network && expectedNetwork && expectedNetwork !== reportedNetwork) {
    return { settle: false, reason: 'network_mismatch' }
  }

  return { settle: true }
}

export interface DepositDiagnostic {
  outcome: string
  status?: string | null
  asset?: string | null
  network?: string | null
  invoiceAmountUsdt?: string | null
  creditedSp?: bigint | null
  paymentIntentId?: number | null
}

/**
 * Builds a compact, non-sensitive settlement diagnostic for structured logging.
 * Deliberately excludes raw payloads, signatures, API keys, wallet addresses and
 * any personal data.
 */
export function buildDepositDiagnostic(input: DepositDiagnostic): Record<string, string | number | null> {
  return {
    outcome: input.outcome,
    status: input.status ?? null,
    asset: input.asset ?? null,
    network: input.network ?? null,
    invoiceAmountUsdt: input.invoiceAmountUsdt ?? null,
    creditedSp:
      input.creditedSp !== null && input.creditedSp !== undefined ? input.creditedSp.toString() : null,
    paymentIntentId: input.paymentIntentId ?? null,
  }
}
