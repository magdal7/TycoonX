export type ReferralStatusName = 'PENDING' | 'QUALIFIED' | 'REJECTED' | 'REVOKED'
export type ReferralRewardKindName = 'REGISTRATION_BONUS' | 'PURCHASE_COMMISSION'
export type ReferralRewardStatusName = 'PENDING' | 'PAID' | 'REVERSED'
export type ReferralPurchaseStatusName =
  | 'PENDING'
  | 'SETTLED'
  | 'FAILED'
  | 'REFUNDED'
  | 'CHARGEBACK'
  | 'DUPLICATE'

/** Owner-confirmed amounts (Master Spec §0/§8). Not configurable downward here. */
export const REFERRAL_REGISTRATION_BONUS_SP = 10n
export const REFERRAL_COMMISSION_BPS = 1000 // 10.00%

/**
 * Master activation gate. Independent of payments/payouts. Server-side
 * environment switch read on every call. Fail-closed: only the exact value
 * "true" enables referral reward crediting. Rewards stay DISABLED until the
 * owner approves the unresolved economic details (commission currency,
 * qualification, refunds). Stored configuration can never enable them alone.
 */
export function isReferralRewardsEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.REFERRAL_REWARDS_ENABLED === 'true'
}

/** Module-load snapshot of the rewards gate, for display. Enforcement uses `isReferralRewardsEnabled()`. */
export const REFERRAL_REWARDS_ENABLED = isReferralRewardsEnabled()

export interface ReferralQualificationConfig {
  minLevel: number
  requireEmailVerification: boolean
  minCyclesCollected: number
}

export interface ReferralQualificationEvidence {
  selfReferral: boolean
  alreadyAttributed: boolean
  referredLevel: number
  referredCyclesCollected: number
  emailVerified: boolean
}

export interface QualificationResult {
  qualified: boolean
  reasons: string[]
}

/** Pure evaluation of the configurable (but currently disabled) qualification rules. */
export function evaluateQualification(
  config: ReferralQualificationConfig,
  evidence: ReferralQualificationEvidence,
): QualificationResult {
  const reasons: string[] = []
  if (evidence.selfReferral) reasons.push('self_referral')
  if (evidence.alreadyAttributed) reasons.push('already_attributed')
  if (evidence.referredLevel < config.minLevel) reasons.push('below_min_level')
  if (evidence.referredCyclesCollected < config.minCyclesCollected) reasons.push('below_min_cycles')
  if (config.requireEmailVerification && !evidence.emailVerified) reasons.push('email_unverified')
  return { qualified: reasons.length === 0, reasons }
}

/** Commission for a settled purchase value, in the configured currency units. */
export function commissionSp(valueSp: bigint, bps: number = REFERRAL_COMMISSION_BPS): bigint {
  if (valueSp <= 0n || bps <= 0) return 0n
  return (valueSp * BigInt(bps)) / 10000n
}

/** Purchase statuses that must never generate (or must reverse) a commission. */
export function isNonEarningPurchaseStatus(status: ReferralPurchaseStatusName): boolean {
  return status === 'FAILED' || status === 'REFUNDED' || status === 'CHARGEBACK' || status === 'DUPLICATE'
}

/** Purchase statuses that reverse an already-recorded commission. */
export function isReversalPurchaseStatus(status: ReferralPurchaseStatusName): boolean {
  return status === 'REFUNDED' || status === 'CHARGEBACK'
}
