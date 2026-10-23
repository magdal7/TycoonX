import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  REFERRAL_COMMISSION_BPS,
  REFERRAL_REGISTRATION_BONUS_SP,
  REFERRAL_REWARDS_ENABLED,
  commissionSp,
  evaluateQualification,
  isNonEarningPurchaseStatus,
  isReferralRewardsEnabled,
  isReversalPurchaseStatus,
} from './referralRules'

const OK_CONFIG = { minLevel: 1, requireEmailVerification: false, minCyclesCollected: 0 }
const OK_EVIDENCE = {
  selfReferral: false,
  alreadyAttributed: false,
  referredLevel: 5,
  referredCyclesCollected: 3,
  emailVerified: true,
}

test('referral rewards remain disabled and amounts are the owner-confirmed values', () => {
  assert.equal(REFERRAL_REWARDS_ENABLED, false)
  assert.equal(REFERRAL_REGISTRATION_BONUS_SP, 10n)
  assert.equal(REFERRAL_COMMISSION_BPS, 1000)
})

test('referral rewards are independently gated and disabled by default', () => {
  assert.equal(isReferralRewardsEnabled({}), false)
  assert.equal(isReferralRewardsEnabled({ REFERRAL_REWARDS_ENABLED: 'true' }), true)
  assert.equal(isReferralRewardsEnabled({ PAYMENTS_ENABLED: 'true' }), false)
  assert.equal(isReferralRewardsEnabled({ REFERRAL_REWARDS_ENABLED: 'TRUE' }), false)
  assert.equal(isReferralRewardsEnabled({ REFERRAL_REWARDS_ENABLED: ' true ' }), false)
  assert.equal(isReferralRewardsEnabled({ REFERRAL_REWARDS_ENABLED: '1' }), false)
})

test('commission floors to whole units and ignores non-positive input', () => {
  assert.equal(commissionSp(1000n), 100n)
  assert.equal(commissionSp(999n), 99n)
  assert.equal(commissionSp(0n), 0n)
  assert.equal(commissionSp(1000n, 0), 0n)
})

test('qualification passes when all criteria are met', () => {
  assert.equal(evaluateQualification(OK_CONFIG, OK_EVIDENCE).qualified, true)
})

test('qualification reports each failing reason', () => {
  assert.deepEqual(evaluateQualification(OK_CONFIG, { ...OK_EVIDENCE, selfReferral: true }).reasons, ['self_referral'])
  assert.deepEqual(evaluateQualification(OK_CONFIG, { ...OK_EVIDENCE, alreadyAttributed: true }).reasons, ['already_attributed'])
  assert.deepEqual(evaluateQualification({ ...OK_CONFIG, minLevel: 10 }, OK_EVIDENCE).reasons, ['below_min_level'])
  assert.deepEqual(evaluateQualification({ ...OK_CONFIG, minCyclesCollected: 5 }, OK_EVIDENCE).reasons, ['below_min_cycles'])
  assert.deepEqual(
    evaluateQualification({ ...OK_CONFIG, requireEmailVerification: true }, { ...OK_EVIDENCE, emailVerified: false }).reasons,
    ['email_unverified'],
  )
})

test('purchase status classification is safe for commission handling', () => {
  assert.equal(isNonEarningPurchaseStatus('FAILED'), true)
  assert.equal(isNonEarningPurchaseStatus('REFUNDED'), true)
  assert.equal(isNonEarningPurchaseStatus('CHARGEBACK'), true)
  assert.equal(isNonEarningPurchaseStatus('DUPLICATE'), true)
  assert.equal(isNonEarningPurchaseStatus('SETTLED'), false)
  assert.equal(isReversalPurchaseStatus('REFUNDED'), true)
  assert.equal(isReversalPurchaseStatus('CHARGEBACK'), true)
  assert.equal(isReversalPurchaseStatus('SETTLED'), false)
  assert.equal(isReversalPurchaseStatus('FAILED'), false)
})
