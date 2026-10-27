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
 * Confirmed OxaPay USDT/BEP20 payout provider fee in USDT
 * (`OXAPAY_PAYOUT_PROVIDER_FEE_USDT`, default "0.25"). This is the provider's
 * advertised withdraw_fee; it is tracked separately from the player-facing flat
 * fee and is deducted at most once — see `payoutFeeSemantics` and Master Spec §9.
 */
export function payoutProviderFeeUsdt(env: Record<string, string | undefined> = process.env): string {
  const raw = (env.OXAPAY_PAYOUT_PROVIDER_FEE_USDT ?? '').trim()
  return USDT_RE.test(raw) ? raw : '0.25'
}

export type PayoutFeeSemantics = 'unknown' | 'payer' | 'merchant'

/**
 * Owner-verified payout fee semantics. The owner confirmed the real payout
 * behavior: a 1.00 USDT gross withdrawal at a 0.25 USDT player fee delivers
 * exactly 0.75 USDT to the recipient. OxaPay therefore bills its 0.25 USDT
 * BEP20 payout fee from the merchant balance and forwards the full requested
 * amount to the recipient (the "merchant" side), rather than deducting it from
 * the payout amount. Encoding this as the default means a code deploy cannot
 * disable payouts for lack of a new environment variable; an explicit
 * `OXAPAY_PAYOUT_FEE_SEMANTICS` still overrides it.
 */
export const DEFAULT_PAYOUT_FEE_SEMANTICS: PayoutFeeSemantics = 'merchant'

/**
 * Which side the provider deducts its payout fee from. Missing/blank config
 * resolves to the owner-verified default (`merchant`); an explicit "payer" or
 * "merchant" is honored; any other value fails closed to `'unknown'`, which
 * keeps real payout execution blocked (see `isPayoutFeeSemanticsConfirmed`).
 * ("payer" = deducted from the payout amount, "merchant" = billed separately.)
 */
export function payoutFeeSemantics(env: Record<string, string | undefined> = process.env): PayoutFeeSemantics {
  const raw = (env.OXAPAY_PAYOUT_FEE_SEMANTICS ?? '').trim().toLowerCase()
  if (raw === '') return DEFAULT_PAYOUT_FEE_SEMANTICS
  if (raw === 'payer' || raw === 'merchant') return raw
  return 'unknown'
}

export function isPayoutFeeSemanticsConfirmed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return payoutFeeSemantics(env) !== 'unknown'
}

const USDT_SCALE = 6
const USDT_SCALE_FACTOR = 10n ** BigInt(USDT_SCALE)

function usdtToScaled(amount: string): bigint {
  const trimmed = amount.trim()
  if (!USDT_RE.test(trimmed)) throw new Error('invalid usdt amount')
  const [intPart, frac = ''] = trimmed.split('.')
  return BigInt(intPart) * USDT_SCALE_FACTOR + BigInt((frac + '000000').slice(0, USDT_SCALE))
}

function scaledToUsdt(value: bigint): string {
  const whole = value / USDT_SCALE_FACTOR
  const frac = (value % USDT_SCALE_FACTOR).toString().padStart(USDT_SCALE, '0').replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : whole.toString()
}

/**
 * The `amount` submitted to the OxaPay payout API so the recipient receives
 * exactly the player net (`netUsdt`) while the provider fee is deducted at most
 * once:
 *  - `merchant`: the provider bills its fee from the merchant balance and pays
 *    the requested amount in full, so the net is submitted unchanged.
 *  - `payer`: the provider deducts its fee from the requested amount, so the
 *    provider fee is added; the recipient still receives exactly the net.
 * Fails closed (throws) when the semantics are unconfirmed (`unknown`).
 */
export function payoutSubmitAmountUsdt(
  netUsdt: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const semantics = payoutFeeSemantics(env)
  if (semantics === 'unknown') throw new Error('payout fee semantics unconfirmed')
  if (semantics === 'merchant') return netUsdt
  return scaledToUsdt(usdtToScaled(netUsdt) + usdtToScaled(payoutProviderFeeUsdt(env)))
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
