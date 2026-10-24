export type PaymentIntentStatusName =
  | 'CREATED'
  | 'PENDING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'

export type PurchaseStatusName = 'PENDING' | 'PAID' | 'DELIVERED' | 'FAILED' | 'REFUNDED'

/**
 * Master payments gate. Server-side environment switch read on every call so
 * the decision is never stale. Fail-closed: only the exact value "true"
 * enables deposits, CEO purchases and webhook settlement. Settlement rules
 * remain fail-closed. Payouts/rewards stay disabled independently below.
 */
export function isPaymentsEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.PAYMENTS_ENABLED === 'true'
}

/** Module-load snapshot of the gate, for display. Enforcement uses `isPaymentsEnabled()`. */
export const PAYMENTS_ENABLED = isPaymentsEnabled()

/**
 * Master payouts gate. Independent of deposits. Server-side environment switch
 * read on every call. Fail-closed: only the exact value "true" enables real
 * withdrawal payout execution.
 */
export function isPayoutsEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.PAYOUTS_ENABLED === 'true'
}

/** Module-load snapshot of the payout gate, for display. Enforcement uses `isPayoutsEnabled()`. */
export const PAYOUTS_ENABLED = isPayoutsEnabled()

/** Owner-confirmed accounting conversion (Master Spec §0): 1 USDT = 1,000 SP. */
export const USDT_TO_SP = 1000n

const USDT_RE = /^\d+(\.\d{1,6})?$/

/** Validates a non-negative USDT amount with at most 6 decimals. */
export function isValidUsdtAmount(amount: string): boolean {
  const trimmed = amount?.trim()
  return Boolean(trimmed) && USDT_RE.test(trimmed)
}

/**
 * Provider-verified minimum deposit amount in USDT (`OXAPAY_MIN_DEPOSIT_USDT`).
 * Defaults to "0" (no enforcement) until the owner sets the value verified
 * against the live OxaPay merchant configuration. Invalid values fail to "0".
 */
export function minDepositUsdt(env: Record<string, string | undefined> = process.env): string {
  const raw = (env.OXAPAY_MIN_DEPOSIT_USDT ?? '').trim()
  return USDT_RE.test(raw) ? raw : '0'
}

/**
 * Provider-verified minimum payout amount in USDT (`OXAPAY_MIN_PAYOUT_USDT`).
 * Defaults to "0.01" — the live OxaPay USDT/BSC `withdraw_min`. A withdrawal's
 * net amount must be at least this value for the provider to accept the payout.
 */
export function minPayoutUsdt(env: Record<string, string | undefined> = process.env): string {
  const raw = (env.OXAPAY_MIN_PAYOUT_USDT ?? '').trim()
  return USDT_RE.test(raw) ? raw : '0.01'
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
