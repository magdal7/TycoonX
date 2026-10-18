export const MIN_LEVEL = 1
export const MAX_LEVEL = 50

/** XP required to advance from level L to L+1. */
export function xpToAdvance(level: number): number {
  if (level < MIN_LEVEL || level >= MAX_LEVEL) return 0
  const n = level - 1
  return 100 + 25 * n + 5 * n * n
}

/** Cumulative lifetime XP required to *reach* the given level (level 1 = 0). */
export function cumulativeXpForLevel(level: number): number {
  let total = 0
  const cap = Math.min(Math.max(level, MIN_LEVEL), MAX_LEVEL)
  for (let l = MIN_LEVEL; l < cap; l += 1) total += xpToAdvance(l)
  return total
}

/** Highest level reachable with the given lifetime XP (1..MAX_LEVEL). */
export function levelFromLifetimeXp(xp: number): number {
  let level = MIN_LEVEL
  let remaining = Math.max(0, Math.floor(xp))
  while (level < MAX_LEVEL) {
    const need = xpToAdvance(level)
    if (remaining < need) break
    remaining -= need
    level += 1
  }
  return level
}

/** XP progress within the current level, for progress bars. */
export function levelProgress(xp: number): { level: number; intoLevel: number; toNext: number } {
  const level = levelFromLifetimeXp(xp)
  const floorXp = cumulativeXpForLevel(level)
  const intoLevel = Math.max(0, Math.floor(xp) - floorXp)
  return { level, intoLevel, toNext: xpToAdvance(level) }
}

export type RankName =
  | 'Rookie'
  | 'Entrepreneur'
  | 'Founder'
  | 'Executive'
  | 'Tycoon'
  | 'Empire Legend'

export function rankForLevel(level: number): RankName {
  if (level >= 40) return 'Empire Legend'
  if (level >= 30) return 'Tycoon'
  if (level >= 20) return 'Executive'
  if (level >= 10) return 'Founder'
  if (level >= 5) return 'Entrepreneur'
  return 'Rookie'
}

export type EquipmentTierName = 'STANDARD' | 'EXTENDED' | 'ADVANCED'

export interface EquipmentSpec {
  tier: EquipmentTierName
  hours: number
  costSp: number
  requiredLevel: number
}

/** Owner-approved equipment tiers (Master Spec §3). Longer cycles scale proportionally by hour. */
export const EQUIPMENT: Record<EquipmentTierName, EquipmentSpec> = {
  STANDARD: { tier: 'STANDARD', hours: 4, costSp: 0, requiredLevel: 1 },
  EXTENDED: { tier: 'EXTENDED', hours: 6, costSp: 500, requiredLevel: 5 },
  ADVANCED: { tier: 'ADVANCED', hours: 8, costSp: 1500, requiredLevel: 12 },
}

export const EQUIPMENT_ORDER: EquipmentTierName[] = ['STANDARD', 'EXTENDED', 'ADVANCED']

export function equipmentRank(tier: EquipmentTierName): number {
  return EQUIPMENT_ORDER.indexOf(tier)
}

/**
 * Exact SP credited for a completed cycle at a given equipment duration.
 * The underlying hourly rate is constant; longer cycles yield proportionally more
 * per collection. Deterministic floor, no floating point money.
 */
export function cycleRewardSp(nominalSpPer24h: number, cycleHours: number): number {
  return Math.floor((nominalSpPer24h * cycleHours) / 24)
}

/** Reward clamped to the copy's remaining lifetime Earned-SP capacity. */
export function clampRewardToCap(rewardSp: number, lifetimeCapSp: number, alreadyEarnedSp: number): number {
  const remaining = lifetimeCapSp - alreadyEarnedSp
  return Math.max(0, Math.min(rewardSp, remaining))
}

export interface SpendPlan {
  bonusDebit: number
  earnedDebit: number
  affordable: boolean
}

/**
 * Bonus SP is spent first, then Earned SP (Master Spec §2). Pure and deterministic;
 * the DB layer turns the plan into guarded decrements + ledger rows.
 */
export function planSpend(bonusSp: number, earnedSp: number, amountSp: number): SpendPlan {
  const amount = Math.max(0, Math.floor(amountSp))
  if (amount > bonusSp + earnedSp) {
    return { bonusDebit: 0, earnedDebit: 0, affordable: false }
  }
  const bonusDebit = Math.min(bonusSp, amount)
  return { bonusDebit, earnedDebit: amount - bonusDebit, affordable: true }
}

/** 1 USDT = 1,000 SP (owner-confirmed). */
export const SP_PER_USDT = 1000

export function spToUsdt(sp: number): number {
  return sp / SP_PER_USDT
}
