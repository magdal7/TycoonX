export type PaymentIntentStatusName =
  | 'CREATED'
  | 'PENDING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'

export type PurchaseStatusName = 'PENDING' | 'PAID' | 'DELIVERED' | 'FAILED' | 'REFUNDED'

/**
 * Master payments flag. Deposits are ACTIVATED: authenticated users may create
 * OxaPay invoices and spend the resulting Bonus SP on CEO purchases. The
 * settlement rules remain fail-closed. This constant is authoritative.
 */
export const PAYMENTS_ENABLED = true

/**
 * Master payouts flag. Withdrawal payout execution stays disabled independently
 * of deposits. This constant is authoritative.
 */
export const PAYOUTS_ENABLED = false

/** Owner-confirmed accounting conversion (Master Spec §0): 1 USDT = 1,000 SP. */
export const USDT_TO_SP = 1000n

const USDT_RE = /^\d+(\.\d{1,6})?$/

/** Validates a non-negative USDT amount with at most 6 decimals. */
export function isValidUsdtAmount(amount: string): boolean {
  const trimmed = amount?.trim()
  return Boolean(trimmed) && USDT_RE.test(trimmed)
}

/**
 * Converts a USDT decimal string to integer SP exactly (no floating point).
 * 1 USDT = 1,000 SP, so 0.001 USDT = 1 SP; extra decimals beyond 3 are truncated.
 */
export function usdtToSp(amount: string): bigint {
  const trimmed = amount.trim()
  if (!USDT_RE.test(trimmed)) throw new Error('invalid usdt amount')
  const [intPart, frac = ''] = trimmed.split('.')
  const thousandths = BigInt((frac + '000').slice(0, 3))
  return BigInt(intPart) * USDT_TO_SP + thousandths
}

/** Formats integer SP as a USDT string with the given number of decimals. */
export function spToUsdtString(sp: bigint, decimals = 2): string {
  const negative = sp < 0n
  const abs = negative ? -sp : sp
  const whole = abs / USDT_TO_SP
  const frac = (abs % USDT_TO_SP).toString().padStart(3, '0').slice(0, decimals).padEnd(decimals, '0')
  return `${negative ? '-' : ''}${whole}${decimals > 0 ? `.${frac}` : ''}`
}

export type PaymentIntentAction = 'confirm' | 'fail' | 'expire' | 'cancel'

/** Legal payment-intent transitions; returns the target status or null. */
export function nextIntentStatus(
  from: PaymentIntentStatusName,
  action: PaymentIntentAction,
): PaymentIntentStatusName | null {
  switch (action) {
    case 'confirm':
      return from === 'CREATED' || from === 'PENDING' ? 'CONFIRMED' : null
    case 'fail':
      return from === 'CREATED' || from === 'PENDING' ? 'FAILED' : null
    case 'expire':
      return from === 'CREATED' || from === 'PENDING' ? 'EXPIRED' : null
    case 'cancel':
      return from === 'CREATED' ? 'CANCELLED' : null
    default:
      return null
  }
}

export type PurchaseAction = 'pay' | 'deliver' | 'fail' | 'refund'

/** Legal purchase transitions; returns the target status or null. */
export function nextPurchaseStatus(from: PurchaseStatusName, action: PurchaseAction): PurchaseStatusName | null {
  switch (action) {
    case 'pay':
      return from === 'PENDING' ? 'PAID' : null
    case 'deliver':
      return from === 'PAID' ? 'DELIVERED' : null
    case 'fail':
      return from === 'PENDING' || from === 'PAID' ? 'FAILED' : null
    case 'refund':
      return from === 'PAID' || from === 'DELIVERED' ? 'REFUNDED' : null
    default:
      return null
  }
}
