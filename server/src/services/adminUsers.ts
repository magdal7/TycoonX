import type { PrismaClient } from '@prisma/client'
import { toProgressView } from './progress'
import { AdminError } from './adminErrors'

export interface UserSearchFilter {
  q?: string
  limit?: number
}

export async function searchUsers(db: PrismaClient, filter: UserSearchFilter = {}) {
  const q = filter.q?.trim()
  const users = await db.user.findMany({
    where: q
      ? {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { id: 'desc' },
    take: filter.limit ?? 25,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isSuspended: true,
      suspendedAt: true,
      suspensionReason: true,
      createdAt: true,
      spAccount: { select: { earnedSp: true, bonusSp: true, lifetimeEarnedSp: true } },
      progress: { select: { xp: true, level: true } },
      _count: { select: { ownedCeos: true } },
    },
  })
  return users.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    isSuspended: u.isSuspended,
    suspendedAt: u.suspendedAt ? u.suspendedAt.toISOString() : null,
    suspensionReason: u.suspensionReason,
    createdAt: u.createdAt.toISOString(),
    ownedCeos: u._count.ownedCeos,
    earnedSp: (u.spAccount?.earnedSp ?? 0n).toString(),
    bonusSp: (u.spAccount?.bonusSp ?? 0n).toString(),
    lifetimeEarnedSp: (u.spAccount?.lifetimeEarnedSp ?? 0n).toString(),
    xp: u.progress?.xp ?? 0,
    level: u.progress?.level ?? 1,
  }))
}

export async function getUserDetail(db: PrismaClient, userId: number) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isSuspended: true,
      suspendedAt: true,
      suspensionReason: true,
      createdAt: true,
      spAccount: true,
      progress: true,
      referralReceived: { select: { referrerId: true, code: true, eligible: true } },
    },
  })
  if (!user) throw new AdminError('not_found')

  const [owned, referralsMade, referralsQualified, ledger, withdrawals, cyclesTotal, cyclesClaimed, cyclesProducing] =
    await Promise.all([
      db.ownedCeo.findMany({
        where: { userId },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          status: true,
          equipment: true,
          lifetimeEarnedSp: true,
          archivedAt: true,
          acquiredAt: true,
          template: { select: { name: true, slug: true, lifetimeCapSp: true } },
        },
      }),
      db.referralAttribution.count({ where: { referrerId: userId } }),
      db.referralAttribution.count({ where: { referrerId: userId, eligible: true } }),
      db.spLedgerEntry.findMany({
        where: { userId },
        orderBy: { id: 'desc' },
        take: 50,
        select: { id: true, bucket: true, amountSp: true, sourceType: true, createdAt: true },
      }),
      db.withdrawalRequest.findMany({
        where: { userId },
        orderBy: { id: 'desc' },
        take: 25,
        select: {
          id: true,
          grossSp: true,
          feeUsdt: true,
          netUsdt: true,
          address: true,
          status: true,
          createdAt: true,
        },
      }),
      db.productionCycle.count({ where: { userId } }),
      db.productionCycle.count({ where: { userId, status: 'CLAIMED' } }),
      db.productionCycle.count({ where: { userId, status: 'PRODUCING' } }),
    ])

  const xp = user.progress?.xp ?? 0
  const progress = toProgressView(xp)
  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isSuspended: user.isSuspended,
      suspendedAt: user.suspendedAt ? user.suspendedAt.toISOString() : null,
      suspensionReason: user.suspensionReason,
      createdAt: user.createdAt.toISOString(),
    },
    balances: {
      earnedSp: (user.spAccount?.earnedSp ?? 0n).toString(),
      bonusSp: (user.spAccount?.bonusSp ?? 0n).toString(),
      lifetimeEarnedSp: (user.spAccount?.lifetimeEarnedSp ?? 0n).toString(),
    },
    progress: { xp, level: progress.level, rank: progress.rank },
    ownedCeos: owned.map((o) => ({
      id: o.id,
      templateName: o.template.name,
      templateSlug: o.template.slug,
      status: o.status,
      equipment: o.equipment,
      lifetimeEarnedSp: o.lifetimeEarnedSp.toString(),
      lifetimeCapSp: o.template.lifetimeCapSp?.toString() ?? null,
      archivedAt: o.archivedAt ? o.archivedAt.toISOString() : null,
      acquiredAt: o.acquiredAt.toISOString(),
    })),
    referrals: {
      made: referralsMade,
      qualified: referralsQualified,
      receivedFrom: user.referralReceived
        ? { referrerId: user.referralReceived.referrerId, code: user.referralReceived.code, eligible: user.referralReceived.eligible }
        : null,
    },
    ledger: ledger.map((l) => ({
      id: l.id.toString(),
      bucket: l.bucket,
      amountSp: l.amountSp.toString(),
      sourceType: l.sourceType,
      createdAt: l.createdAt.toISOString(),
    })),
    withdrawals: withdrawals.map((w) => ({
      id: w.id,
      grossSp: w.grossSp.toString(),
      feeUsdt: w.feeUsdt.toString(),
      netUsdt: w.netUsdt.toString(),
      address: w.address,
      status: w.status,
      createdAt: w.createdAt.toISOString(),
    })),
    production: { cyclesTotal, cyclesClaimed, cyclesProducing },
  }
}

/** Sensitive: requires an explicit confirm flag; admins cannot be suspended here. */
export async function setUserSuspension(
  db: PrismaClient,
  actorId: number,
  userId: number,
  input: { suspend: boolean; reason?: string; confirm: boolean },
) {
  if (!input.confirm) throw new AdminError('confirmation_required')
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isSuspended: true } })
    if (!user) throw new AdminError('not_found')
    if (input.suspend && user.role === 'ADMIN') throw new AdminError('cannot_suspend_admin')

    const updated = await tx.user.update({
      where: { id: userId },
      data: input.suspend
        ? { isSuspended: true, suspendedAt: new Date(), suspensionReason: input.reason ?? null }
        : { isSuspended: false, suspendedAt: null, suspensionReason: null },
      select: { id: true, username: true, isSuspended: true, suspendedAt: true, suspensionReason: true },
    })
    await tx.adminAuditLog.create({
      data: {
        actorId,
        action: input.suspend ? 'user.suspend' : 'user.reactivate',
        targetType: 'User',
        targetId: String(userId),
        metadata: { reason: input.reason ?? null },
      },
    })
    return updated
  })
}
