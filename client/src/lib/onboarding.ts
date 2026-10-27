/**
 * Progressive-onboarding persistence. Stored per authenticated user in
 * localStorage (no database model needed) so guidance is shown once, can be
 * skipped, and can be replayed. All access is guarded so a locked-down storage
 * environment never throws.
 */
export type OnboardingState = 'done' | 'skipped' | null

const key = (userId: number) => `tycoonx:onboarding:v1:${userId}`

function read(userId: number): string | null {
  try {
    return globalThis.localStorage?.getItem(key(userId)) ?? null
  } catch {
    return null
  }
}

function write(userId: number, value: string): void {
  try {
    globalThis.localStorage?.setItem(key(userId), value)
  } catch {
    /* storage unavailable; onboarding simply shows again next visit */
  }
}

function remove(userId: number): void {
  try {
    globalThis.localStorage?.removeItem(key(userId))
  } catch {
    /* ignore */
  }
}

export function getOnboardingState(userId: number | null | undefined): OnboardingState {
  if (userId == null) return null
  const v = read(userId)
  return v === 'done' || v === 'skipped' ? v : null
}

export function setOnboardingState(userId: number, state: 'done' | 'skipped'): void {
  write(userId, state)
}

export function clearOnboardingState(userId: number): void {
  remove(userId)
}

/** Whether the guide should auto-open (never completed, never skipped). */
export function shouldShowOnboarding(userId: number | null | undefined): boolean {
  return userId != null && getOnboardingState(userId) === null
}
