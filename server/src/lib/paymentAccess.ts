import { isPaymentsEnabled, isPayoutsEnabled } from './payments'
import { isReferralRewardsEnabled } from './referralRules'

/**
 * Server-authoritative runtime availability for the three independent financial
 * gates, safe to expose publicly (booleans only, never secrets). Public surfaces
 * use this instead of hardcoding a financial state.
 */
export interface PublicCapabilities {
  deposits: boolean
  payouts: boolean
  referralRewards: boolean
}

export function runtimeCapabilities(
  env: Record<string, string | undefined> = process.env,
): PublicCapabilities {
  return {
    deposits: isPaymentsEnabled(env),
    payouts: isPayoutsEnabled(env),
    referralRewards: isReferralRewardsEnabled(env),
  }
}

/**
 * Deposit access control (owner-approved architecture).
 *
 * Financial gating is layered: `PAYMENTS_ENABLED` must be on, and the deposit
 * access mode decides who may create invoices:
 *   - 'disabled'        : no invoices (default; fail-closed)
 *   - 'admin_allowlist' : only ADMIN users whose immutable User ID is listed
 *   - 'all'             : any authenticated eligible user
 *
 * The allowlist is keyed on the immutable numeric User ID (never a username)
 * and additionally requires the ADMIN role. Existing PaymentIntent obligations
 * are settled by the webhook/credit path, which is gated by `PAYMENTS_ENABLED`
 * only, so disabling the test allowlist never strands a previously created
 * invoice.
 */
export type DepositAccessMode = 'disabled' | 'admin_allowlist' | 'all'

export function depositAccessMode(
  env: Record<string, string | undefined> = process.env,
): DepositAccessMode {
  const raw = (env.DEPOSIT_ACCESS_MODE ?? '').trim().toLowerCase()
  if (raw === 'all') return 'all'
  if (raw === 'admin_allowlist') return 'admin_allowlist'
  return 'disabled'
}

/** Parses `DEPOSIT_ADMIN_ALLOWLIST` (comma-separated immutable User IDs). */
export function depositAdminAllowlist(
  env: Record<string, string | undefined> = process.env,
): Set<number> {
  return new Set(
    (env.DEPOSIT_ADMIN_ALLOWLIST ?? '')
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0),
  )
}

/** True only when the authenticated user may create a deposit invoice. */
export function canCreateDeposit(
  user: { id: number; role: string },
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!isPaymentsEnabled(env)) return false
  const mode = depositAccessMode(env)
  if (mode === 'all') return true
  if (mode === 'admin_allowlist') {
    return user.role === 'ADMIN' && depositAdminAllowlist(env).has(user.id)
  }
  return false
}
