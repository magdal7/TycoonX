import type { Prisma, PrismaClient } from '@prisma/client'
import { isUniqueViolation } from '../lib/idempotency'
import {
  isReferralRewardsEnabled,
  commissionSp,
  isNonEarningPurchaseStatus,
  isReversalPurchaseStatus,
  type ReferralStatusName,
  type ReferralPurchaseStatusName,
  type ReferralRewardStatusName,
} from '../lib/referralRules'
import { creditSp } from './spLedger'
import { getSiteSettings } from './siteSettings'

export type ReferralErrorCode =
  | 'not_found'
  | 'invalid_state'
  | 'confirmation_required'

export class ReferralError extends Error {
  constructor(public code: ReferralErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'ReferralError'
  }
}

/** Abuse heuristic: this many attributions for one referrer from the same IP hash is suspicious. */
export const SUSPICIOUS_SHARED_IP_THRESHOLD = 3

async function referralConfig(db: PrismaClient) {
  const settings = await getSiteSettings(db)
  return { ...settings.referral, rewardsEnabled: isReferralRewardsEnabled() }
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

export async function getPlayerReferralSummary(db: PrismaClient, userId: number) {
  const [user, attributions, rewards, config] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { username: true } }),
    db.referralAttribution.findMany({
      where: { referrerId: userId },
      orderBy: { id: 'desc' },
      take: 200,
      include: {
        referredUser: { select: { username: true, createdAt: true } },
        rewards: { select: { kind: true, status: true, amountSp: true, currency: true } },
      },
    }),
    db.referralReward.findMany({
      where: { referral: { referrerId: userId } },
      select: { kind: true, status: true, amountSp: true, currency: true },
    }),
    referralConfig(db),
  ])

  const total = attributions.length
  const qualified = attributions.filter((a) => a.status === 'QUALIFIED').length
  const sumBy = (status: ReferralRewardStatusName) =>
    rewards.filter((r) => r.status === status).reduce((acc, r) => acc + r.amountSp, 0n)
  const pendingRewardsSp = sumBy('PENDING')
  const paidRewardsSp = sumBy('PAID')

  return {
    code: user?.username ?? null,
    link: user ? `/?ref=${encodeURIComponent(user.username)}` : null,
    total,
    qualified,
    pendingRewardsSp: pendingRewardsSp.toString(),
    paidRewardsSp: paidRewardsSp.toString(),
    rewardsEnabled: config.rewardsEnabled,
    registrationBonusSp: String(config.registrationBonusSp),
    commissionPercent: String(config.commissionBps / 100),
    commissionCurrency: config.commissionCurrency,
    qualification: config.qualification,
    history: attributions.map((a) => ({
      id: a.id,
      referredUsername: a.referredUser.username,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
      qualifiedAt: a.qualifiedAt ? a.qualifiedAt.toISOString() : null,
      rewards: a.rewards.map((r) => ({
        kind: r.kind,
        status: r.status,
        amountSp: r.amountSp.toString(),
        currency: r.currency,
      })),
    })),
  }
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AdminReferralFilter {
  status?: ReferralStatusName
  q?: string
}

export async function listAdminReferrals(db: PrismaClient, filter: AdminReferralFilter = {}) {
  const q = filter.q?.trim()
  const rows = await db.referralAttribution.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(q
        ? {
            OR: [
              { referrer: { username: { contains: q, mode: 'insensitive' } } },
              { referredUser: { username: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    orderBy: { id: 'desc' },
    take: 200,
    include: {
      referrer: { select: { username: true } },
      referredUser: { select: { username: true } },
      rewards: { select: { kind: true, status: true, amountSp: true } },
      _count: { select: { purchases: true } },
    },
  })

  // Shared-IP abuse flag: more than one attribution from the same IP hash under a referrer.
  const byReferrerIp = new Map<string, number>()
  for (const r of rows) {
    if (!r.signupIpHash) continue
    const key = `${r.referrerId}:${r.signupIpHash}`
    byReferrerIp.set(key, (byReferrerIp.get(key) ?? 0) + 1)
  }

  return rows.map((r) => {
    const sharedCount = r.signupIpHash ? byReferrerIp.get(`${r.referrerId}:${r.signupIpHash}`) ?? 1 : 0
    return {
      id: r.id,
      referrerId: r.referrerId,
      referrerUsername: r.referrer.username,
      referredUsername: r.referredUser.username,
      code: r.code,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      qualifiedAt: r.qualifiedAt ? r.qualifiedAt.toISOString() : null,
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      reviewNote: r.reviewNote,
      hasSignupFingerprint: Boolean(r.signupIpHash),
      suspiciousSharedIp: sharedCount >= SUSPICIOUS_SHARED_IP_THRESHOLD,
      purchaseEvents: r._count.purchases,
      rewards: r.rewards.map((rw) => ({
        kind: rw.kind,
        status: rw.status,
        amountSp: rw.amountSp.toString(),
      })),
    }
  })
}

/**
 * Admin qualification review. QUALIFY creates the 10 Bonus SP reward record
 * (exactly-once, idempotent); REJECT/REVOKE update state. Rewards are only
 * credited to the ledger when `REFERRAL_REWARDS_ENABLED` is true.
 */
export async function reviewReferral(
  db: PrismaClient,
  adminId: number,
  referralId: number,
  decision: 'QUALIFY' | 'REJECT' | 'REVOKE',
  note: string | undefined,
  confirm: boolean,
) {
  if (!confirm) throw new ReferralError('confirmation_required')
  const config = await referralConfig(db)

  return db.$transaction(async (tx) => {
    const referral = await tx.referralAttribution.findUnique({ where: { id: referralId } })
    if (!referral) throw new ReferralError('not_found')

    const now = new Date()
    const target: ReferralStatusName = decision === 'QUALIFY' ? 'QUALIFIED' : decision === 'REJECT' ? 'REJECTED' : 'REVOKED'
    if (referral.status === target) throw new ReferralError('invalid_state')
    if (decision === 'QUALIFY' && referral.status === 'REVOKED') throw new ReferralError('invalid_state')
    if (decision === 'REJECT' && referral.status === 'QUALIFIED') throw new ReferralError('invalid_state')

    const guard = await tx.referralAttribution.updateMany({
      where: { id: referralId, status: referral.status },
      data: {
        status: target,
        qualifiedAt: target === 'QUALIFIED' ? now : referral.qualifiedAt,
        eligible: target === 'QUALIFIED',
        reviewedBy: adminId,
        reviewedAt: now,
        reviewNote: note ?? null,
      },
    })
    if (guard.count !== 1) throw new ReferralError('invalid_state')

    if (decision === 'QUALIFY') {
      const amount = BigInt(config.registrationBonusSp)
      const reward = await tx.referralReward.upsert({
        where: { referralId_kind_purchaseRef: { referralId, kind: 'REGISTRATION_BONUS', purchaseRef: '' } },
        create: { referralId, kind: 'REGISTRATION_BONUS', amountSp: amount, currency: config.commissionCurrency },
        update: {},
      })
      if (config.rewardsEnabled && reward.status === 'PENDING') {
        await creditSp(tx, {
          userId: referral.referrerId,
          bucket: 'BONUS',
          amountSp: amount,
          sourceType: 'REFERRAL_REWARD',
          sourceId: BigInt(reward.id),
          metadata: { referralId },
        })
        await tx.referralReward.update({ where: { id: reward.id }, data: { status: 'PAID', paidAt: now } })
      }
    }

    if (decision === 'REVOKE') {
      await tx.referralReward.updateMany({
        where: { referralId, status: 'PENDING' },
        data: { status: 'REVERSED', reversedAt: now, reason: 'referral_revoked' },
      })
    }

    await tx.adminAuditLog.create({
      data: {
        actorId: adminId,
        action: `referral.${decision.toLowerCase()}`,
        targetType: 'ReferralAttribution',
        targetId: String(referralId),
        metadata: { note: note ?? null, to: target },
      },
    })

    return tx.referralAttribution.findUniqueOrThrow({ where: { id: referralId } })
  })
}

export async function listAdminReferralRewards(
  db: PrismaClient,
  filter: { status?: ReferralRewardStatusName; kind?: 'REGISTRATION_BONUS' | 'PURCHASE_COMMISSION' } = {},
) {
  const rows = await db.referralReward.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.kind ? { kind: filter.kind } : {}),
    },
    orderBy: { id: 'desc' },
    take: 200,
    include: {
      referral: {
        select: {
          code: true,
          referrer: { select: { username: true } },
          referredUser: { select: { username: true } },
        },
      },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    referralId: r.referralId,
    referrerUsername: r.referral.referrer.username,
    referredUsername: r.referral.referredUser.username,
    kind: r.kind,
    status: r.status,
    amountSp: r.amountSp.toString(),
    currency: r.currency,
    purchaseRef: r.purchaseRef || null,
    createdAt: r.createdAt.toISOString(),
    paidAt: r.paidAt ? r.paidAt.toISOString() : null,
    reversedAt: r.reversedAt ? r.reversedAt.toISOString() : null,
  }))
}

// ---------------------------------------------------------------------------
// Purchase events (inert until payments + rewards are approved)
// ---------------------------------------------------------------------------

export interface RecordPurchaseEventInput {
  purchaseRef: string
  referredUserId: number
  valueSp: bigint
  status: ReferralPurchaseStatusName
  occurredAt: Date
  metadata?: Prisma.InputJsonValue
}

export interface RecordPurchaseEventResult {
  ignored: boolean
  reason?: 'not_referred' | 'not_qualified' | 'non_earning' | 'duplicate'
  eventId?: number
  commissionSp?: string
}

/**
 * Records an eligible paid CEO purchase event and maintains the recurring 10%
 * commission record. Idempotent on `purchaseRef`; refunds/chargebacks/failed
 * payments reverse the commission. This function is the internal hook the future
 * payment integration will call — it never activates payments and only credits
 * the ledger when `REFERRAL_REWARDS_ENABLED` is true.
 */
export async function recordReferralPurchaseEvent(
  db: PrismaClient,
  input: RecordPurchaseEventInput,
): Promise<RecordPurchaseEventResult> {
  const referral = await db.referralAttribution.findUnique({ where: { referredUserId: input.referredUserId } })
  if (!referral) return { ignored: true, reason: 'not_referred' }

  const config = await referralConfig(db)

  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.referralPurchaseEvent.findUnique({ where: { purchaseRef: input.purchaseRef } })
      if (existing && existing.status === input.status) {
        // Same event replayed: idempotent no-op (duplicate detection).
        return { ignored: true, reason: 'duplicate', eventId: existing.id }
      }

      const event = existing
        ? await tx.referralPurchaseEvent.update({
            where: { purchaseRef: input.purchaseRef },
            data: {
              status: input.status,
              valueSp: input.valueSp,
              occurredAt: input.occurredAt,
              metadata: input.metadata,
            },
          })
        : await tx.referralPurchaseEvent.create({
            data: {
              referralId: referral.id,
              referredUserId: input.referredUserId,
              purchaseRef: input.purchaseRef,
              valueSp: input.valueSp,
              status: input.status,
              occurredAt: input.occurredAt,
              metadata: input.metadata,
            },
          })

      // Refunds/chargebacks reverse any commission recorded for this purchase.
      if (isReversalPurchaseStatus(input.status)) {
        await tx.referralReward.updateMany({
          where: {
            referralId: referral.id,
            kind: 'PURCHASE_COMMISSION',
            purchaseRef: input.purchaseRef,
            status: { not: 'REVERSED' },
          },
          data: { status: 'REVERSED', reversedAt: new Date(), reason: input.status.toLowerCase() },
        })
        return { ignored: false, eventId: event.id }
      }

      if (isNonEarningPurchaseStatus(input.status) || referral.status !== 'QUALIFIED') {
        return {
          ignored: true,
          reason: referral.status !== 'QUALIFIED' ? 'not_qualified' : 'non_earning',
          eventId: event.id,
        }
      }

      const amount = commissionSp(input.valueSp, config.commissionBps)
      const reward = await tx.referralReward.upsert({
        where: {
          referralId_kind_purchaseRef: {
            referralId: referral.id,
            kind: 'PURCHASE_COMMISSION',
            purchaseRef: input.purchaseRef,
          },
        },
        create: {
          referralId: referral.id,
          kind: 'PURCHASE_COMMISSION',
          amountSp: amount,
          currency: config.commissionCurrency,
          purchaseRef: input.purchaseRef,
        },
        update: {},
      })

      if (config.rewardsEnabled && reward.status === 'PENDING' && amount > 0n) {
        await creditSp(tx, {
          userId: referral.referrerId,
          bucket: 'BONUS',
          amountSp: amount,
          sourceType: 'REFERRAL_REWARD',
          sourceId: BigInt(reward.id),
          metadata: { referralId: referral.id, purchaseRef: input.purchaseRef },
        })
        await tx.referralReward.update({ where: { id: reward.id }, data: { status: 'PAID', paidAt: new Date() } })
      }

      return { ignored: false, eventId: event.id, commissionSp: amount.toString() }
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await db.referralPurchaseEvent.findUnique({ where: { purchaseRef: input.purchaseRef } })
      return { ignored: true, reason: 'duplicate', ...(existing ? { eventId: existing.id } : {}) }
    }
    throw error
  }
}
