import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeTaskBoard,
  utcDayKey,
  utcWeekKey,
  DAILY_MAX_XP,
  WEEKLY_MAX_XP,
  taskXp,
  type TaskEventLike,
} from './tasks'

const NOW = new Date('2026-10-18T12:00:00Z') // Sunday

function eventsForDay(dayIso: string, spec: Partial<Record<'LOGIN' | 'CYCLE_START' | 'CYCLE_COLLECT', number>>): TaskEventLike[] {
  const out: TaskEventLike[] = []
  for (const [type, count] of Object.entries(spec)) {
    for (let i = 0; i < (count ?? 0); i += 1) {
      out.push({ type, createdAt: new Date(`${dayIso}T10:00:00Z`) })
    }
  }
  return out
}

test('task XP maxima match the approved values', () => {
  assert.equal(DAILY_MAX_XP, 165)
  assert.equal(WEEKLY_MAX_XP, 1250)
  assert.equal(taskXp('daily_login'), 10)
  assert.equal(taskXp('daily_bonus'), 50)
  assert.equal(taskXp('weekly_bonus'), 250)
  assert.equal(taskXp('nope'), null)
})

test('utc period keys are stable and UTC-based', () => {
  assert.equal(utcDayKey(new Date('2026-10-18T23:59:59Z')), '2026-10-18')
  assert.equal(utcDayKey(new Date('2026-10-19T00:00:00Z')), '2026-10-19')
  const sameWeek = utcWeekKey(new Date('2026-10-13T00:00:00Z')) === utcWeekKey(new Date('2026-10-18T00:00:00Z'))
  assert.equal(sameWeek, true)
  assert.notEqual(utcWeekKey(new Date('2026-10-18T00:00:00Z')), utcWeekKey(new Date('2026-10-25T00:00:00Z')))
})

test('an empty board has no completed tasks', () => {
  const board = computeTaskBoard([], NOW)
  assert.equal(board.daily.every((t) => !t.completed), true)
  assert.equal(board.weekly.every((t) => !t.completed), true)
  assert.equal(board.dailyBonus.completed, false)
})

test('daily and weekly counters respect their windows', () => {
  // Events on Oct 13-15 (same week as NOW), none on Oct 18.
  const events = [
    ...eventsForDay('2026-10-13', { LOGIN: 1, CYCLE_START: 3, CYCLE_COLLECT: 3 }),
  ]
  const board = computeTaskBoard(events, NOW)
  const dailyLogin = board.daily.find((t) => t.key === 'daily_login')!
  assert.equal(dailyLogin.completed, false) // not today
  const weeklyStart = board.weekly.find((t) => t.key === 'weekly_start_15')!
  assert.equal(weeklyStart.progress, 3)
  const visitor = board.weekly.find((t) => t.key === 'weekly_visitor')!
  assert.equal(visitor.progress, 1)
})

test('distinct-day and all-daily-days weekly tasks complete correctly', () => {
  const events = [
    ...eventsForDay('2026-10-13', { LOGIN: 1, CYCLE_START: 3, CYCLE_COLLECT: 3 }),
    ...eventsForDay('2026-10-14', { LOGIN: 1, CYCLE_START: 3, CYCLE_COLLECT: 3 }),
    ...eventsForDay('2026-10-15', { LOGIN: 1, CYCLE_START: 3, CYCLE_COLLECT: 3 }),
  ]
  const board = computeTaskBoard(events, NOW)
  const visitor = board.weekly.find((t) => t.key === 'weekly_visitor')!
  assert.equal(visitor.progress, 3)
  assert.equal(visitor.completed, false)
  const champion = board.weekly.find((t) => t.key === 'weekly_champion')!
  assert.equal(champion.progress, 3)
  const consistent = board.weekly.find((t) => t.key === 'weekly_consistent')!
  assert.equal(consistent.progress, 3)
  assert.equal(consistent.completed, true)
})

test('the daily bonus completes only when all five dailies are done', () => {
  const partial = eventsForDay('2026-10-18', { LOGIN: 1, CYCLE_START: 3, CYCLE_COLLECT: 1 })
  assert.equal(computeTaskBoard(partial, NOW).dailyBonus.completed, false)
  const full = eventsForDay('2026-10-18', { LOGIN: 1, CYCLE_START: 3, CYCLE_COLLECT: 3 })
  const board = computeTaskBoard(full, NOW)
  assert.equal(board.daily.every((t) => t.completed), true)
  assert.equal(board.dailyBonus.completed, true)
})

test('claimed state is surfaced only for the matching period', () => {
  const events = eventsForDay('2026-10-18', { LOGIN: 1, CYCLE_START: 3, CYCLE_COLLECT: 3 })
  const day = utcDayKey(NOW)
  const week = utcWeekKey(NOW)

  const board = computeTaskBoard(events, NOW, [
    { taskKey: 'daily_login', periodKey: day },
    { taskKey: 'weekly_start_15', periodKey: week },
    { taskKey: 'daily_bonus', periodKey: day },
  ])
  assert.equal(board.daily.find((t) => t.key === 'daily_login')!.claimed, true)
  assert.equal(board.daily.find((t) => t.key === 'daily_start_3')!.claimed, false)
  assert.equal(board.weekly.find((t) => t.key === 'weekly_start_15')!.claimed, true)
  assert.equal(board.dailyBonus.claimed, true)
  assert.equal(board.weeklyBonus.claimed, false)
})

test('claims from a previous period never leak into the current board', () => {
  const events = eventsForDay('2026-10-18', { LOGIN: 1 })
  const stale = computeTaskBoard(events, NOW, [
    { taskKey: 'daily_login', periodKey: '2000-01-01' },
    { taskKey: 'weekly_visitor', periodKey: '2000-W01' },
  ])
  assert.equal(stale.daily.every((t) => !t.claimed), true)
  assert.equal(stale.weekly.every((t) => !t.claimed), true)
  assert.equal(stale.dailyBonus.claimed, false)
})

