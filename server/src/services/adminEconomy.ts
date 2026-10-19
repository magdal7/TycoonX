import type { PrismaClient } from '@prisma/client'

/** Anti-abuse watch thresholds for economy monitoring (not economy rules). */
export const LARGE_CREDIT_SP = 100_000n
export const HIGH_CYCLE_COUNT = 500

export async function getEconomyOverview(db: PrismaClient) {
  const [spAgg, ledgerBySource, cyclesByStatus, ownedByStatus, largeCredits, topCycleUsers] = await Promise.all([
    db.spAccount.aggregate({
      _sum: { earnedSp: true, bonusSp: true, lifetimeEarnedSp: true },
      _count: { _all: true },
    }),
    db.spLedgerEntry.groupBy({ by: ['sourceType'], _count: { _all: true }, _sum: { amountSp: true } }),
    db.productionCycle.groupBy({ by: ['status'], _count: { _all: true } }),
    db.ownedCeo.groupBy({ by: ['status'], _count: { _all: true } }),
    db.spLedgerEntry.findMany({
      where: { amountSp: { gt: LARGE_CREDIT_SP } },
      orderBy: { amountSp: 'desc' },
      take: 20,
      select: {
        id: true,
        userId: true,
        bucket: true,
        amountSp: true,
        sourceType: true,
        createdAt: true,
        user: { select: { username: true } },
      },
    }),
    db.productionCycle.groupBy({
      by: ['userId'],
      _count: { _all: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 10,
    }),
  ])

  const userIds = topCycleUsers.map((r) => r.userId)
  const users = userIds.length
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true } })
    : []
  const usernameById = new Map(users.map((u) => [u.id, u.username]))

  const totals = {
    earnedSp: (spAgg._sum.earnedSp ?? 0n).toString(),
    bonusSp: (spAgg._sum.bonusSp ?? 0n).toString(),
    lifetimeEarnedSp: (spAgg._sum.lifetimeEarnedSp ?? 0n).toString(),
    accounts: spAgg._count._all,
  }

  return {
    totals,
    ledgerBySource: ledgerBySource.map((r) => ({
      sourceType: r.sourceType,
      count: r._count._all,
      amountSp: (r._sum.amountSp ?? 0n).toString(),
    })),
    cyclesByStatus: cyclesByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    ownedByStatus: ownedByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    suspicious: {
      largeCredits: largeCredits.map((l) => ({
        id: l.id.toString(),
        userId: l.userId,
        username: l.user.username,
        bucket: l.bucket,
        amountSp: l.amountSp.toString(),
        sourceType: l.sourceType,
        createdAt: l.createdAt.toISOString(),
      })),
      highVolumeUsers: topCycleUsers.map((r) => ({
        userId: r.userId,
        username: usernameById.get(r.userId) ?? `#${r.userId}`,
        cycles: r._count._all,
        flagged: r._count._all >= HIGH_CYCLE_COUNT,
      })),
    },
  }
}
