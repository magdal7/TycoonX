import type { Prisma } from '@prisma/client'
import { levelFromLifetimeXp, levelProgress, rankForLevel } from '../lib/gameMath'

type Tx = Prisma.TransactionClient

export interface ProgressView {
  xp: number
  level: number
  rank: string
  intoLevel: number
  toNext: number
}

export function toProgressView(xp: number): ProgressView {
  const p = levelProgress(xp)
  return { xp, level: p.level, rank: rankForLevel(p.level), intoLevel: p.intoLevel, toNext: p.toNext }
}

export async function getProgress(tx: Tx, userId: number): Promise<ProgressView> {
  const row = await tx.progressAccount.findUnique({ where: { userId } })
  return toProgressView(row?.xp ?? 0)
}

/**
 * Awards XP and recomputes the derived level. Returns the updated progress view.
 * XP is lifetime-cumulative and never decreases (Master Spec §5).
 */
export async function awardXp(tx: Tx, userId: number, amount: number): Promise<ProgressView> {
  if (!Number.isFinite(amount) || amount <= 0) return getProgress(tx, userId)
  const row = await tx.progressAccount.upsert({
    where: { userId },
    create: { userId, xp: Math.floor(amount) },
    update: { xp: { increment: Math.floor(amount) } },
  })
  const level = levelFromLifetimeXp(row.xp)
  if (level !== row.level) {
    await tx.progressAccount.update({ where: { userId }, data: { level } })
  }
  return toProgressView(row.xp)
}
