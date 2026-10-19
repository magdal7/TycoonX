import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerWithReferralSchema } from './game'

const base = { email: 'a@example.com', username: 'founder', password: 'password123' }

test('registration requires explicit policy acceptance', () => {
  assert.equal(registerWithReferralSchema.safeParse({ ...base }).success, false)
  assert.equal(registerWithReferralSchema.safeParse({ ...base, acceptTerms: false }).success, false)
  assert.equal(registerWithReferralSchema.safeParse({ ...base, acceptTerms: true }).success, true)
})

test('registration accepts an optional referral code but rejects malformed ones', () => {
  assert.equal(registerWithReferralSchema.safeParse({ ...base, acceptTerms: true }).success, true)
  const ok = registerWithReferralSchema.safeParse({ ...base, acceptTerms: true, ref: 'alice_01' })
  assert.equal(ok.success, true)
  const bad = registerWithReferralSchema.safeParse({ ...base, acceptTerms: true, ref: 'bad code!' })
  assert.equal(bad.success, false)
})
