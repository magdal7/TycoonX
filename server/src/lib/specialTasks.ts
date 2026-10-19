export type SpecialTaskStatusName = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED'
export type SpecialTaskVerificationName = 'MANUAL' | 'AUTO'
export type SubmissionStatusName = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLAIMED'

export type SpecialTaskAction = 'publish' | 'pause' | 'expire' | 'archive'

/** Player-visible state of a campaign for one player (Master Spec §8 / Step 3). */
export type PlayerSpecialTaskState =
  | 'AVAILABLE'
  | 'PENDING'
  | 'APPROVED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'INELIGIBLE'
  | 'FULL'

/** Total proof attempts allowed per player per campaign (Master Spec §8). */
export const MAX_PROOF_ATTEMPTS = 3

/**
 * Anti-abuse guardrails (not economy rules): admin-configured rewards above these
 * require an explicit confirmation flag and are audited (Master Spec §8).
 */
export const HIGH_REWARD_XP = 5000
export const HIGH_REWARD_BONUS_SP = 5000n

export interface SpecialTaskWindow {
  status: SpecialTaskStatusName
  startsAt: Date | null
  expiresAt: Date | null
}

export interface PlayerSubmissionView {
  status: SubmissionStatusName
  attempt: number
}

export interface PlayerTaskInput extends SpecialTaskWindow {
  minLevel: number
  maxCompletions: number | null
  completionsCount: number
  submission: PlayerSubmissionView | null
  playerLevel: number
  now?: Date
}

/** Archived tasks and tasks outside their [startsAt, expiresAt] window are unavailable. */
export function isUnavailable(task: SpecialTaskWindow, now: Date = new Date()): boolean {
  if (task.status === 'EXPIRED' || task.status === 'ARCHIVED') return true
  if (task.startsAt && now < task.startsAt) return true
  if (task.expiresAt && now > task.expiresAt) return true
  return false
}

/** New proof submissions are accepted only while a campaign is published and in-window. */
export function isOpenForNewSubmissions(task: SpecialTaskWindow, now: Date = new Date()): boolean {
  if (task.status !== 'PUBLISHED') return false
  if (task.startsAt && now < task.startsAt) return false
  if (task.expiresAt && now > task.expiresAt) return false
  return true
}

export function derivePlayerState(input: PlayerTaskInput): PlayerSpecialTaskState {
  const now = input.now ?? new Date()
  const sub = input.submission
  if (sub) {
    if (sub.status === 'CLAIMED') return 'COMPLETED'
    if (sub.status === 'APPROVED') return 'APPROVED'
    if (sub.status === 'PENDING') return 'PENDING'
    // REJECTED: retryable until the campaign closes.
    return isUnavailable(input, now) ? 'EXPIRED' : 'REJECTED'
  }
  if (isUnavailable(input, now)) return 'EXPIRED'
  if (input.playerLevel < input.minLevel) return 'INELIGIBLE'
  if (input.maxCompletions != null && input.completionsCount >= input.maxCompletions) return 'FULL'
  return 'AVAILABLE'
}

/** Valid campaign lifecycle transitions; returns the target status or null if illegal. */
export function nextStatus(from: SpecialTaskStatusName, action: SpecialTaskAction): SpecialTaskStatusName | null {
  switch (action) {
    case 'publish':
      return from === 'DRAFT' || from === 'PAUSED' ? 'PUBLISHED' : null
    case 'pause':
      return from === 'PUBLISHED' ? 'PAUSED' : null
    case 'expire':
      return from === 'PUBLISHED' || from === 'PAUSED' ? 'EXPIRED' : null
    case 'archive':
      return from === 'ARCHIVED' ? null : 'ARCHIVED'
    default:
      return null
  }
}

export function rewardRequiresConfirmation(rewardXp: number, rewardBonusSp: bigint): boolean {
  return rewardXp > HIGH_REWARD_XP || rewardBonusSp > HIGH_REWARD_BONUS_SP
}
