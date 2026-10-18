import type { PrismaClient } from '@prisma/client'
import { levelFromLifetimeXp, rankForLevel } from '../lib/gameMath'

export interface LeaderboardEntry {
  rank: number
  userId: number
  username: string
  avatarKey: string
  level: number
  rankName: string
  xp: number
  primaryBadge: string | null
}

function firstFeatured(featured: unknown): string | null {
  if (Array.isArray(featured) && featured.length > 0 && typeof featured[0] === 'string') return featured[0]
  return null
}

export async function getLeaderboard(db: PrismaClient, limit = 100): Promise<LeaderboardEntry[]> {
  const rows = await db.progressAccount.findMany({
    orderBy: [{ xp: 'desc' }, { userId: 'asc' }],
    take: Math.min(Math.max(limit, 1), 100),
    include: { user: { select: { username: true, profile: { select: { avatarKey: true, featured: true } } } } },
  })
  return rows.map((row, i) => {
    const level = levelFromLifetimeXp(row.xp)
    return {
      rank: i + 1,
      userId: row.userId,
      username: row.user.username,
      avatarKey: row.user.profile?.avatarKey ?? 'founder-1',
      level,
      rankName: rankForLevel(level),
      xp: row.xp,
      primaryBadge: firstFeatured(row.user.profile?.featured),
    }
  })
}

export async function getPlayerRank(db: PrismaClient, userId: number): Promise<number | null> {
  const me = await db.progressAccount.findUnique({ where: { userId } })
  if (!me) return null
  const ahead = await db.progressAccount.count({ where: { xp: { gt: me.xp } } })
  return ahead + 1
}

export interface PublicProfile {
  username: string
  avatarKey: string
  level: number
  rankName: string
  xp: number
  featured: string[]
}

export async function getPublicProfile(db: PrismaClient, username: string): Promise<PublicProfile | null> {
  const user = await db.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
    select: {
      id: true,
      username: true,
      progress: { select: { xp: true } },
      profile: { select: { avatarKey: true, featured: true } },
    },
  })
  if (!user) return null
  const xp = user.progress?.xp ?? 0
  const level = levelFromLifetimeXp(xp)
  return {
    username: user.username,
    avatarKey: user.profile?.avatarKey ?? 'founder-1',
    level,
    rankName: rankForLevel(level),
    xp,
    featured: Array.isArray(user.profile?.featured) ? (user.profile!.featured as string[]) : [],
  }
}

/** Sets up to 3 featured badges (first is the primary shown by the leaderboard). */
export async function setFeaturedBadges(
  db: PrismaClient,
  userId: number,
  badges: string[],
): Promise<string[]> {
  const cleaned = badges.filter((b) => typeof b === 'string').slice(0, 3)
  await db.userProfile.upsert({
    where: { userId },
    create: { userId, featured: cleaned },
    update: { featured: cleaned },
  })
  return cleaned
}

export async function setAvatar(db: PrismaClient, userId: number, avatarKey: string): Promise<void> {
  await db.userProfile.upsert({
    where: { userId },
    create: { userId, avatarKey },
    update: { avatarKey },
  })
}
