import type { PrismaClient } from '@prisma/client'
import { isUniqueViolation } from '../lib/idempotency'

export type ReferralReason =
  | 'attributed'
  | 'no_code'
  | 'referrer_not_found'
  | 'self_referral'
  | 'already_attributed'

export interface ReferralResult {
  attributed: boolean
  reason: ReferralReason
  referralId?: number
}

/**
 * Attributes a newly registered user to a referrer. No rewards are granted
 * here (Economy V2 grants referral milestones only via later, manual phases).
 *
 * The "code" is currently matched against the referrer's unique username, since
 * no dedicated referral-code column exists. If a dedicated code field is
 * introduced later, only the resolver below changes.
 */
export async function attributeReferral(
  prisma: PrismaClient,
  input: { referredUserId: number; code: string | null | undefined },
): Promise<ReferralResult> {
  const code = input.code?.trim()
  if (!code) return { attributed: false, reason: 'no_code' }

  const referrer = await prisma.user.findUnique({
    where: { username: code },
    select: { id: true },
  })
  if (!referrer) return { attributed: false, reason: 'referrer_not_found' }
  if (referrer.id === input.referredUserId) {
    return { attributed: false, reason: 'self_referral' }
  }

  try {
    const row = await prisma.referralAttribution.create({
      data: { referrerId: referrer.id, referredUserId: input.referredUserId, code },
      select: { id: true },
    })
    return { attributed: true, reason: 'attributed', referralId: row.id }
  } catch (error) {
    if (isUniqueViolation(error)) return { attributed: false, reason: 'already_attributed' }
    throw error
  }
}
