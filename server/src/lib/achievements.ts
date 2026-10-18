export const ACHIEVEMENT_STAGES = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'] as const
export type AchievementStage = (typeof ACHIEVEMENT_STAGES)[number]

export interface AchievementTrackDef {
  key: string
  title: string
  /** Lifetime cumulative thresholds for BRONZE/SILVER/GOLD/DIAMOND. */
  thresholds: [number, number, number, number]
  /** One-time XP reward per stage. */
  xp: [number, number, number, number]
}

/** Owner-approved achievement tracks (Master Spec §7). XP-only; no withdrawable value. */
export const ACHIEVEMENT_TRACKS: AchievementTrackDef[] = [
  { key: 'cycles_collected', title: 'CEO cycles collected', thresholds: [5, 25, 100, 500], xp: [50, 150, 400, 1000] },
  { key: 'copies_acquired', title: 'CEO copies acquired', thresholds: [1, 3, 10, 30], xp: [25, 100, 300, 800] },
  { key: 'copies_exhausted', title: 'CEO copies exhausted', thresholds: [1, 3, 10, 25], xp: [50, 150, 400, 1000] },
  { key: 'earned_sp', title: 'Earned SP collected', thresholds: [20, 500, 5000, 50000], xp: [50, 150, 400, 1000] },
  { key: 'login_days', title: 'Distinct UTC login days', thresholds: [3, 14, 45, 120], xp: [50, 150, 400, 1000] },
]

export interface TrackCounter {
  key: string
  value: number
}

export interface AchievementStageView {
  stage: AchievementStage
  threshold: number
  xp: number
  achieved: boolean
  claimed: boolean
}

export interface AchievementTrackView {
  key: string
  title: string
  value: number
  /** Highest achieved stage index (-1 = none). */
  stageIndex: number
  stages: AchievementStageView[]
}

/**
 * Maps a lifetime value to the highest achieved stage index (-1..3).
 * Progress is cumulative and never resets (Master Spec §7).
 */
export function stageIndexFor(value: number, thresholds: readonly number[]): number {
  let idx = -1
  for (let i = 0; i < thresholds.length; i += 1) {
    if (value >= thresholds[i]) idx = i
  }
  return idx
}

export function buildAchievementViews(
  counters: TrackCounter[],
  claimed: Set<string>,
): AchievementTrackView[] {
  const byKey = new Map(counters.map((c) => [c.key, c.value]))
  return ACHIEVEMENT_TRACKS.map((track) => {
    const value = byKey.get(track.key) ?? 0
    const stageIndex = stageIndexFor(value, track.thresholds)
    const stages: AchievementStageView[] = track.thresholds.map((threshold, i) => ({
      stage: ACHIEVEMENT_STAGES[i],
      threshold,
      xp: track.xp[i],
      achieved: value >= threshold,
      claimed: claimed.has(`${track.key}:${ACHIEVEMENT_STAGES[i]}`),
    }))
    return { key: track.key, title: track.title, value, stageIndex, stages }
  })
}

export function achievementXp(trackKey: string, stage: string): number | null {
  const track = ACHIEVEMENT_TRACKS.find((t) => t.key === trackKey)
  if (!track) return null
  const idx = ACHIEVEMENT_STAGES.indexOf(stage as AchievementStage)
  if (idx < 0) return null
  return track.xp[idx]
}
