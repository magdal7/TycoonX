import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  clearOnboardingState,
  getOnboardingState,
  setOnboardingState,
  shouldShowOnboarding,
} from './onboarding'

function installFakeStorage() {
  const map = new Map<string, string>()
  const fake = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size
    },
  }
  ;(globalThis as unknown as { localStorage: unknown }).localStorage = fake
}

test('onboarding shows once, persists completion, and is per-user', () => {
  installFakeStorage()
  assert.equal(shouldShowOnboarding(7), true)
  setOnboardingState(7, 'done')
  assert.equal(getOnboardingState(7), 'done')
  assert.equal(shouldShowOnboarding(7), false)
  // Another user is unaffected.
  assert.equal(shouldShowOnboarding(8), true)
})

test('skip persists and replay clears state', () => {
  installFakeStorage()
  setOnboardingState(1, 'skipped')
  assert.equal(getOnboardingState(1), 'skipped')
  assert.equal(shouldShowOnboarding(1), false)
  clearOnboardingState(1)
  assert.equal(getOnboardingState(1), null)
  assert.equal(shouldShowOnboarding(1), true)
})

test('null user never shows onboarding and storage errors do not throw', () => {
  assert.equal(shouldShowOnboarding(null), false)
  assert.equal(getOnboardingState(undefined), null)
  ;(globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem() {
      throw new Error('blocked')
    },
    setItem() {
      throw new Error('blocked')
    },
    removeItem() {
      throw new Error('blocked')
    },
  }
  assert.equal(getOnboardingState(1), null)
  assert.doesNotThrow(() => setOnboardingState(1, 'done'))
})
