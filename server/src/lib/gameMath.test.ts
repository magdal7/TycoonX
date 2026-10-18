import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  xpToAdvance,
  cumulativeXpForLevel,
  levelFromLifetimeXp,
  levelProgress,
  rankForLevel,
  EQUIPMENT,
  cycleRewardSp,
  clampRewardToCap,
  planSpend,
} from './gameMath'

test('xpToAdvance matches the approved formula', () => {
  assert.equal(xpToAdvance(1), 100)
  assert.equal(xpToAdvance(2), 130)
  assert.equal(xpToAdvance(3), 170)
  assert.equal(xpToAdvance(50), 0)
})

test('cumulative XP to level 50 is 224,420', () => {
  assert.equal(cumulativeXpForLevel(50), 224420)
})

test('levelFromLifetimeXp inverts the cumulative thresholds', () => {
  assert.equal(levelFromLifetimeXp(0), 1)
  assert.equal(levelFromLifetimeXp(99), 1)
  assert.equal(levelFromLifetimeXp(100), 2)
  assert.equal(levelFromLifetimeXp(229), 2)
  assert.equal(levelFromLifetimeXp(230), 3)
  assert.equal(levelFromLifetimeXp(224419), 49)
  assert.equal(levelFromLifetimeXp(224420), 50)
  assert.equal(levelFromLifetimeXp(10_000_000), 50)
})

test('levelProgress reports within-level progress', () => {
  assert.deepEqual(levelProgress(100), { level: 2, intoLevel: 0, toNext: 130 })
  assert.deepEqual(levelProgress(120), { level: 2, intoLevel: 20, toNext: 130 })
})

test('rank bands follow the approved thresholds', () => {
  assert.equal(rankForLevel(1), 'Rookie')
  assert.equal(rankForLevel(4), 'Rookie')
  assert.equal(rankForLevel(5), 'Entrepreneur')
  assert.equal(rankForLevel(9), 'Entrepreneur')
  assert.equal(rankForLevel(10), 'Founder')
  assert.equal(rankForLevel(19), 'Founder')
  assert.equal(rankForLevel(20), 'Executive')
  assert.equal(rankForLevel(30), 'Tycoon')
  assert.equal(rankForLevel(40), 'Empire Legend')
  assert.equal(rankForLevel(50), 'Empire Legend')
})

test('equipment tiers carry approved hours, costs, and unlock levels', () => {
  assert.deepEqual(EQUIPMENT.STANDARD, { tier: 'STANDARD', hours: 4, costSp: 0, requiredLevel: 1 })
  assert.deepEqual(EQUIPMENT.EXTENDED, { tier: 'EXTENDED', hours: 6, costSp: 500, requiredLevel: 5 })
  assert.deepEqual(EQUIPMENT.ADVANCED, { tier: 'ADVANCED', hours: 8, costSp: 1500, requiredLevel: 12 })
})

test('longer cycles scale proportionally by hour (constant hourly rate)', () => {
  assert.equal(cycleRewardSp(10, 4), 1) // 10 * 4 / 24 = 1.66 -> 1
  assert.equal(cycleRewardSp(10, 6), 2) // 2.5 -> 2
  assert.equal(cycleRewardSp(10, 8), 3) // 3.33 -> 3
  assert.equal(cycleRewardSp(100, 4), 16) // CEO 2: 100*4/24 = 16.66
  assert.equal(cycleRewardSp(100, 24), 100)
})

test('reward is clamped to remaining lifetime cap', () => {
  assert.equal(clampRewardToCap(3, 40, 38), 2)
  assert.equal(clampRewardToCap(3, 40, 40), 0)
  assert.equal(clampRewardToCap(3, 40, 39), 1)
  assert.equal(clampRewardToCap(3, 40, 10), 3)
})

test('planSpend spends Bonus first, then Earned, and rejects shortfalls', () => {
  assert.deepEqual(planSpend(100, 50, 30), { bonusDebit: 30, earnedDebit: 0, affordable: true })
  assert.deepEqual(planSpend(10, 50, 30), { bonusDebit: 10, earnedDebit: 20, affordable: true })
  assert.deepEqual(planSpend(0, 50, 30), { bonusDebit: 0, earnedDebit: 30, affordable: true })
  assert.deepEqual(planSpend(10, 10, 30), { bonusDebit: 0, earnedDebit: 0, affordable: false })
})
