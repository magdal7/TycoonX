/**
 * Referral reward rules (Master Spec §8 / owner-confirmed §0).
 *
 * Owner-confirmed amounts: 10 Bonus SP per qualified direct referral; 10% Bonus SP
 * commission on eligible settled direct-referral purchases. Payouts remain DISABLED
 * until the owner approves explicit qualification criteria and anti-abuse rules, so
 * `REFERRAL_REWARDS_ENABLED` is false and these helpers are inert.
 */
import type { Prisma } from '@prisma/client'

export const REFERRAL_REGISTRATION_BONUS_SP = 10n
export const REFERRAL_COMMISSION_BPS = 1000 // 10.00%
export const REFERRAL_REWARDS_ENABLED = false

export type ReferralRewardResult =
  | { awarded: true; bonusSpSpent: string }
  | { awarded: false; reason: 'disabled' | 'not_qualified' }

/** Registration bonus (once per qualified referral). Inert until enabled. */
export async function rewardQualifiedRegistration(
  _tx: Prisma.TransactionClient,
  _input: { referrerId: number; referredUserId: number },
): Promise<ReferralRewardResult> {
  if (!REFERRAL_REWARDS_ENABLED) return { awarded: false, reason: 'disabled' }
  return { awarded: false, reason: 'not_qualified' }
}

/** Purchase commission (10% of settled eligible purchase value, in SP). Inert until enabled. */
export async function rewardPurchaseCommission(
  _tx: Prisma.TransactionClient,
  _input: { referrerId: number; referredUserId: number; purchaseValueSp: bigint; sourceId: bigint },
): Promise<ReferralRewardResult> {
  if (!REFERRAL_REWARDS_ENABLED) return { awarded: false, reason: 'disabled' }
  return { awarded: false, reason: 'not_qualified' }
}

/** Computes the commission in SP for a settled purchase value (pure, testable). */
export function commissionSp(purchaseValueSp: bigint): bigint {
  return (purchaseValueSp * BigInt(REFERRAL_COMMISSION_BPS)) / 10000n
}
