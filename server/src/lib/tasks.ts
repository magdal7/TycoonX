export type TaskEventTypeName = 'LOGIN' | 'CYCLE_START' | 'CYCLE_COLLECT'
export type TaskKind = 'daily' | 'weekly'
export type TaskMode = 'count' | 'distinctDays' | 'allDailyDays'

export interface TaskDef {
  key: string
  title: string
  kind: TaskKind
  goal: number
  xp: number
  mode: TaskMode
  event?: TaskEventTypeName
}

export const DAILY_TASKS: TaskDef[] = [
  { key: 'daily_login', title: 'Daily Login', kind: 'daily', goal: 1, xp: 10, mode: 'count', event: 'LOGIN' },
  { key: 'daily_start_1', title: 'Start Production', kind: 'daily', goal: 1, xp: 15, mode: 'count', event: 'CYCLE_START' },
  { key: 'daily_collect_1', title: 'Collect Production', kind: 'daily', goal: 1, xp: 20, mode: 'count', event: 'CYCLE_COLLECT' },
  { key: 'daily_start_3', title: 'Active Manager', kind: 'daily', goal: 3, xp: 30, mode: 'count', event: 'CYCLE_START' },
  { key: 'daily_collect_3', title: 'Daily Operator', kind: 'daily', goal: 3, xp: 40, mode: 'count', event: 'CYCLE_COLLECT' },
]

export const WEEKLY_TASKS: TaskDef[] = [
  { key: 'weekly_visitor', title: 'Weekly Visitor', kind: 'weekly', goal: 5, xp: 100, mode: 'distinctDays', event: 'LOGIN' },
  { key: 'weekly_start_15', title: 'Production Starter', kind: 'weekly', goal: 15, xp: 150, mode: 'count', event: 'CYCLE_START' },
  { key: 'weekly_collect_15', title: 'Production Collector', kind: 'weekly', goal: 15, xp: 200, mode: 'count', event: 'CYCLE_COLLECT' },
  { key: 'weekly_consistent', title: 'Consistent Manager', kind: 'weekly', goal: 3, xp: 250, mode: 'allDailyDays' },
  { key: 'weekly_champion', title: 'Weekly Champion', kind: 'weekly', goal: 5, xp: 300, mode: 'distinctDays', event: 'CYCLE_COLLECT' },
]

/** All-five daily completion bonus (Master Spec §6). */
export const DAILY_BONUS_XP = 50
/** All-five weekly completion bonus (Master Spec §6). */
export const WEEKLY_BONUS_XP = 250
/** Max XP from tasks per day / per week (Master Spec §13 sanity check). */
export const DAILY_MAX_XP = DAILY_TASKS.reduce((s, t) => s + t.xp, 0) + DAILY_BONUS_XP // 165
export const WEEKLY_MAX_XP = WEEKLY_TASKS.reduce((s, t) => s + t.xp, 0) + WEEKLY_BONUS_XP // 1250

export interface TaskEventLike {
  type: string
  createdAt: Date
}

const pad = (n: number, len = 2) => String(n).padStart(len, '0')

/** UTC calendar-day key, e.g. "2026-10-18". */
export function utcDayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** ISO-8601 week key (UTC), e.g. "2026-W42". */
export function utcWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = (d.getUTCDay() + 6) % 7 // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3) // Thursday of this week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
  return `${d.getUTCFullYear()}-W${pad(week)}`
}

export interface TaskState {
  key: string
  title: string
  kind: TaskKind
  goal: number
  xp: number
  progress: number
  completed: boolean
  periodKey: string
}

function countEvents(events: TaskEventLike[], type: string | undefined, predicate: (e: TaskEventLike) => boolean): number {
  if (!type) return 0
  return events.filter((e) => e.type === type && predicate(e)).length
}

function distinctDays(events: TaskEventLike[], type: string | undefined, predicate: (e: TaskEventLike) => boolean): number {
  if (!type) return 0
  const set = new Set<string>()
  for (const e of events) if (e.type === type && predicate(e)) set.add(utcDayKey(e.createdAt))
  return set.size
}

/** Number of distinct UTC dates within the week where all five daily tasks are completed. */
function allDailyDaysComplete(events: TaskEventLike[], inWeek: (e: TaskEventLike) => boolean): number {
  const days = new Set<string>()
  for (const e of events) if (inWeek(e)) days.add(utcDayKey(e.createdAt))
  let completeDays = 0
  for (const day of days) {
    const onDay = events.filter((e) => utcDayKey(e.createdAt) === day)
    const allMet = DAILY_TASKS.every(
      (t) => countEvents(onDay, t.event, () => true) >= t.goal,
    )
    if (allMet) completeDays += 1
  }
  return completeDays
}

export interface TaskBoard {
  day: string
  week: string
  daily: TaskState[]
  weekly: TaskState[]
  dailyBonus: { key: string; xp: number; completed: boolean; periodKey: string }
  weeklyBonus: { key: string; xp: number; completed: boolean; periodKey: string }
}

/** Computes the full task board for "now" from the user's raw task events (UTC periods). */
export function computeTaskBoard(events: TaskEventLike[], now: Date = new Date()): TaskBoard {
  const day = utcDayKey(now)
  const week = utcWeekKey(now)
  const inDay = (e: TaskEventLike) => utcDayKey(e.createdAt) === day
  const inWeek = (e: TaskEventLike) => utcWeekKey(e.createdAt) === week

  const daily: TaskState[] = DAILY_TASKS.map((t) => {
    const count = countEvents(events, t.event, inDay)
    return {
      key: t.key,
      title: t.title,
      kind: 'daily',
      goal: t.goal,
      xp: t.xp,
      progress: Math.min(count, t.goal),
      completed: count >= t.goal,
      periodKey: day,
    }
  })

  const weekly: TaskState[] = WEEKLY_TASKS.map((t) => {
    let value: number
    if (t.mode === 'distinctDays') value = distinctDays(events, t.event, inWeek)
    else if (t.mode === 'allDailyDays') value = allDailyDaysComplete(events, inWeek)
    else value = countEvents(events, t.event, inWeek)
    return {
      key: t.key,
      title: t.title,
      kind: 'weekly',
      goal: t.goal,
      xp: t.xp,
      progress: Math.min(value, t.goal),
      completed: value >= t.goal,
      periodKey: week,
    }
  })

  return {
    day,
    week,
    daily,
    weekly,
    dailyBonus: {
      key: 'daily_bonus',
      xp: DAILY_BONUS_XP,
      completed: daily.every((t) => t.completed),
      periodKey: day,
    },
    weeklyBonus: {
      key: 'weekly_bonus',
      xp: WEEKLY_BONUS_XP,
      completed: weekly.every((t) => t.completed),
      periodKey: week,
    },
  }
}

/** Resolves a claimable task key to its XP value (includes the completion bonuses). */
export function taskXp(key: string): number | null {
  if (key === 'daily_bonus') return DAILY_BONUS_XP
  if (key === 'weekly_bonus') return WEEKLY_BONUS_XP
  return [...DAILY_TASKS, ...WEEKLY_TASKS].find((t) => t.key === key)?.xp ?? null
}
