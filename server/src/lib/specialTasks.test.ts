import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  HIGH_REWARD_BONUS_SP,
  HIGH_REWARD_XP,
  MAX_PROOF_ATTEMPTS,
  derivePlayerState,
  isOpenForNewSubmissions,
  isUnavailable,
  nextStatus,
  rewardRequiresConfirmation,
} from './specialTasks'

const NOW = new Date('2026-10-19T12:00:00Z')

const baseTask = {
  status: 'PUBLISHED' as const,
  startsAt: null,
  expiresAt: null,
}

test('MAX_PROOF_ATTEMPTS is the approved three', () => {
  assert.equal(MAX_PROOF_ATTEMPTS, 3)
})

test('campaign availability respects status and window', () => {
  assert.equal(isOpenForNewSubmissions(baseTask, NOW), true)
  assert.equal(isOpenForNewSubmissions({ ...baseTask, status: 'PAUSED' }, NOW), false)
  assert.equal(isOpenForNewSubmissions({ ...baseTask, status: 'DRAFT' }, NOW), false)
  assert.equal(isOpenForNewSubmissions({ ...baseTask, status: 'EXPIRED' }, NOW), false)
  assert.equal(isOpenForNewSubmissions({ ...baseTask, startsAt: new Date(NOW.getTime() + 1000) }, NOW), false)
  assert.equal(isOpenForNewSubmissions({ ...baseTask, expiresAt: new Date(NOW.getTime() - 1000) }, NOW), false)
})

test('unavailable covers expired, archived, and out-of-window', () => {
  assert.equal(isUnavailable(baseTask, NOW), false)
  assert.equal(isUnavailable({ ...baseTask, status: 'EXPIRED' }, NOW), true)
  assert.equal(isUnavailable({ ...baseTask, status: 'ARCHIVED' }, NOW), true)
  assert.equal(isUnavailable({ ...baseTask, expiresAt: new Date(NOW.getTime() - 1) }, NOW), true)
})

test('player state derives from submission and eligibility', () => {
  const base = {
    status: 'PUBLISHED' as const,
    minLevel: 1,
    maxCompletions: null as number | null,
    completionsCount: 0,
    startsAt: null,
    expiresAt: null,
    submission: null,
    playerLevel: 1,
    now: NOW,
  }
  assert.equal(derivePlayerState(base), 'AVAILABLE')
  assert.equal(derivePlayerState({ ...base, playerLevel: 0 }), 'INELIGIBLE')
  assert.equal(
    derivePlayerState({ ...base, minLevel: 5, playerLevel: 2 }),
    'INELIGIBLE',
  )
  assert.equal(
    derivePlayerState({ ...base, maxCompletions: 3, completionsCount: 3 }),
    'FULL',
  )
  assert.equal(
    derivePlayerState({ ...base, submission: { status: 'PENDING', attempt: 1 } }),
    'PENDING',
  )
  assert.equal(
    derivePlayerState({ ...base, submission: { status: 'APPROVED', attempt: 1 } }),
    'APPROVED',
  )
  assert.equal(
    derivePlayerState({ ...base, submission: { status: 'CLAIMED', attempt: 1 } }),
    'COMPLETED',
  )
  assert.equal(
    derivePlayerState({ ...base, submission: { status: 'REJECTED', attempt: 1 } }),
    'REJECTED',
  )
  assert.equal(
    derivePlayerState({
      ...base,
      status: 'PAUSED',
      submission: { status: 'REJECTED', attempt: 1 },
    }),
    'REJECTED',
  )
  assert.equal(
    derivePlayerState({
      ...base,
      status: 'EXPIRED',
      submission: { status: 'REJECTED', attempt: 1 },
    }),
    'EXPIRED',
  )
  assert.equal(derivePlayerState({ ...base, status: 'EXPIRED' }), 'EXPIRED')
})

test('campaign lifecycle transitions are constrained', () => {
  assert.equal(nextStatus('DRAFT', 'publish'), 'PUBLISHED')
  assert.equal(nextStatus('PAUSED', 'publish'), 'PUBLISHED')
  assert.equal(nextStatus('PUBLISHED', 'pause'), 'PAUSED')
  assert.equal(nextStatus('PUBLISHED', 'expire'), 'EXPIRED')
  assert.equal(nextStatus('PAUSED', 'expire'), 'EXPIRED')
  assert.equal(nextStatus('DRAFT', 'archive'), 'ARCHIVED')
  assert.equal(nextStatus('PUBLISHED', 'archive'), 'ARCHIVED')
  assert.equal(nextStatus('PUBLISHED', 'publish'), null)
  assert.equal(nextStatus('DRAFT', 'pause'), null)
  assert.equal(nextStatus('EXPIRED', 'pause'), null)
  assert.equal(nextStatus('ARCHIVED', 'archive'), null)
})

test('unusually high rewards require explicit confirmation', () => {
  assert.equal(rewardRequiresConfirmation(HIGH_REWARD_XP, HIGH_REWARD_BONUS_SP), false)
  assert.equal(rewardRequiresConfirmation(HIGH_REWARD_XP + 1, 0n), true)
  assert.equal(rewardRequiresConfirmation(0, HIGH_REWARD_BONUS_SP + 1n), true)
})
