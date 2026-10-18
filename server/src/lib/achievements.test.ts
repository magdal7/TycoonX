import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  stageIndexFor,
  buildAchievementViews,
  achievementXp,
  ACHIEVEMENT_TRACKS,
} from './achievements'

test('stageIndexFor maps lifetime values to the highest achieved stage', () => {
  const t = [5, 25, 100, 500]
  assert.equal(stageIndexFor(0, t), -1)
  assert.equal(stageIndexFor(4, t), -1)
  assert.equal(stageIndexFor(5, t), 0)
  assert.equal(stageIndexFor(24, t), 0)
  assert.equal(stageIndexFor(25, t), 1)
  assert.equal(stageIndexFor(100, t), 2)
  assert.equal(stageIndexFor(500, t), 3)
  assert.equal(stageIndexFor(99999, t), 3)
})

test('achievement views expose thresholds, achieved flags, and claims', () => {
  const views = buildAchievementViews(
    [
      { key: 'cycles_collected', value: 30 },
      { key: 'login_days', value: 3 },
    ],
    new Set(['cycles_collected:BRONZE']),
  )
  const cycles = views.find((v) => v.key === 'cycles_collected')!
  assert.equal(cycles.value, 30)
  assert.equal(cycles.stageIndex, 1) // Silver (25), not Gold (100)
  assert.deepEqual(
    cycles.stages.map((s) => s.achieved),
    [true, true, false, false],
  )
  assert.equal(cycles.stages[0].claimed, true)
  assert.equal(cycles.stages[1].claimed, false)

  const logins = views.find((v) => v.key === 'login_days')!
  assert.equal(logins.stages[0].achieved, true)
  assert.equal(logins.stages[1].achieved, false)

  const copies = views.find((v) => v.key === 'copies_acquired')!
  assert.equal(copies.value, 0)
  assert.equal(copies.stageIndex, -1)
})

test('achievement XP values match the approved table and are XP-only', () => {
  assert.equal(achievementXp('cycles_collected', 'BRONZE'), 50)
  assert.equal(achievementXp('cycles_collected', 'DIAMOND'), 1000)
  assert.equal(achievementXp('copies_acquired', 'BRONZE'), 25)
  assert.equal(achievementXp('copies_acquired', 'DIAMOND'), 800)
  assert.equal(achievementXp('earned_sp', 'SILVER'), 150)
  assert.equal(achievementXp('unknown', 'BRONZE'), null)
  assert.equal(achievementXp('cycles_collected', 'NOPE'), null)
})

test('all five tracks are present with four monotonic thresholds', () => {
  assert.equal(ACHIEVEMENT_TRACKS.length, 5)
  for (const t of ACHIEVEMENT_TRACKS) {
    for (let i = 1; i < t.thresholds.length; i += 1) {
      assert.ok(t.thresholds[i] > t.thresholds[i - 1])
      assert.ok(t.xp[i] > t.xp[i - 1])
    }
  }
})
