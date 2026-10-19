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
 * Resolves a referral code (a permanent username) to an existing referrer,
 * case-insensitively. Returns null when the code is unknown. Kept private to
 * the server to avoid exposing an account-enumeration surface.
 */
async function resolveReferrer(
  prisma: PrismaClient,
  code: string,
): Promise<{ id: number } | null> {
  return prisma.user.findFirst({
    where: { username: { equals: code, mode: 'insensitive' } },
    select: { id: true },
  })
}

/**
 * Attributes a newly registered user to a referrer. No rewards are granted
 * here (Economy V2 grants referral milestones only via later, manual phases).
 *
 * The "code" is the referrer's permanent username, resolved case-insensitively
 * (usernames are immutable and unique). No dedicated referral-code column exists.
 *
 * Self-referrals are rejected: a new account cannot attribute itself, including
 * when the submitted code equals the username being registered (which has no
 * matching row yet at the normal `referrer.id === referredUserId` check).
 */
export async function attributeReferral(
  prisma: PrismaClient,
  input: {
    referredUserId: number
    referredUsername?: string
    code: string | null | undefined
    signupIpHash?: string | null
    signupUserAgentHash?: string | null
  },
): Promise<ReferralResult> {
  const code = input.code?.trim()
  if (!code) return { attributed: false, reason: 'no_code' }

  if (
    input.referredUsername &&
    code.toLowerCase() === input.referredUsername.toLowerCase()
  ) {
    return { attributed: false, reason: 'self_referral' }
  }

  const referrer = await resolveReferrer(prisma, code)
  if (!referrer) return { attributed: false, reason: 'referrer_not_found' }
  if (referrer.id === input.referredUserId) {
    return { attributed: false, reason: 'self_referral' }
  }

  try {
    // Permanent attribution; qualification is reviewed separately (default PENDING).
    const row = await prisma.referralAttribution.create({
      data: {
        referrerId: referrer.id,
        referredUserId: input.referredUserId,
        code,
        status: 'PENDING',
        signupIpHash: input.signupIpHash ?? null,
        signupUserAgentHash: input.signupUserAgentHash ?? null,
      },
      select: { id: true },
    })
    return { attributed: true, reason: 'attributed', referralId: row.id }
  } catch (error) {
    if (isUniqueViolation(error)) return { attributed: false, reason: 'already_attributed' }
    throw error
  }
}
