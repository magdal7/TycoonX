import type { PrismaClient } from '@prisma/client'
import {
  ACHIEVEMENT_TRACKS,
  achievementXp,
  buildAchievementViews,
  stageIndexFor,
  type AchievementTrackView,
  type TrackCounter,
} from '../lib/achievements'
import { utcDayKey } from '../lib/tasks'
import { awardXp } from './progress'

export async function achievementCounters(db: PrismaClient, userId: number): Promise<TrackCounter[]> {
  const [cyclesCollected, copiesAcquired, copiesExhausted, spAccount, loginEvents] = await Promise.all([
    db.productionCycle.count({ where: { userId, status: 'CLAIMED' } }),
    db.ownedCeo.count({ where: { userId } }),
    db.ownedCeo.count({ where: { userId, archivedAt: { not: null } } }),
    db.spAccount.findUnique({ where: { userId } }),
    db.taskEvent.findMany({ where: { userId, type: 'LOGIN' }, select: { createdAt: true } }),
  ])
  const loginDays = new Set(loginEvents.map((e) => utcDayKey(e.createdAt))).size
  return [
    { key: 'cycles_collected', value: cyclesCollected },
    { key: 'copies_acquired', value: copiesAcquired },
    { key: 'copies_exhausted', value: copiesExhausted },
    { key: 'earned_sp', value: Number(spAccount?.lifetimeEarnedSp ?? 0) },
    { key: 'login_days', value: loginDays },
  ]
}

export async function listAchievements(db: PrismaClient, userId: number): Promise<AchievementTrackView[]> {
  const [counters, claims] = await Promise.all([
    achievementCounters(db, userId),
    db.achievementClaim.findMany({ where: { userId }, select: { trackKey: true, stage: true } }),
  ])
  const claimed = new Set(claims.map((c) => `${c.trackKey}:${c.stage}`))
  return buildAchievementViews(counters, claimed)
}

/**
 * Claims one achieved, unclaimed achievement stage (XP-only). Idempotent via the
 * `AchievementClaim` unique key. Returns XP awarded (0 if not claimable).
 */
export async function claimAchievement(
  db: PrismaClient,
  userId: number,
  trackKey: string,
  stage: string,
): Promise<number> {
  return db.$transaction(async (tx) => {
    const track = ACHIEVEMENT_TRACKS.find((t) => t.key === trackKey)
    if (!track) return 0
    const stageIdx = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'].indexOf(stage)
    if (stageIdx < 0) return 0

    const counters = await achievementCounters(tx as unknown as PrismaClient, userId)
    const value = counters.find((c) => c.key === trackKey)?.value ?? 0
    if (stageIndexFor(value, track.thresholds) < stageIdx) return 0

    const existing = await tx.achievementClaim.findUnique({
      where: { userId_trackKey_stage: { userId, trackKey, stage } },
    })
    if (existing) return 0

    const xp = achievementXp(trackKey, stage) ?? 0
    await tx.achievementClaim.create({ data: { userId, trackKey, stage, xpAwarded: xp } })
    await awardXp(tx, userId, xp)
    return xp
  })
}
