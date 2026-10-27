import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  canCreateDeposit,
  depositAccessMode,
  depositAdminAllowlist,
  runtimeCapabilities,
} from './paymentAccess'

test('deposit access mode is disabled by default and unknown values fail closed', () => {
  assert.equal(depositAccessMode({}), 'disabled')
  assert.equal(depositAccessMode({ DEPOSIT_ACCESS_MODE: 'ALL' }), 'all')
  assert.equal(depositAccessMode({ DEPOSIT_ACCESS_MODE: 'admin_allowlist' }), 'admin_allowlist')
  assert.equal(depositAccessMode({ DEPOSIT_ACCESS_MODE: 'yes' }), 'disabled')
})

test('allowlist parses only positive integer IDs', () => {
  const ids = depositAdminAllowlist({ DEPOSIT_ADMIN_ALLOWLIST: '7, 12 ,x,0,-3, 40' })
  assert.deepEqual([...ids].sort((a, b) => a - b), [7, 12, 40])
  assert.equal(depositAdminAllowlist({}).size, 0)
})

test('canCreateDeposit is fail-closed when payments are disabled', () => {
  assert.equal(canCreateDeposit({ id: 7, role: 'ADMIN' }, { DEPOSIT_ACCESS_MODE: 'all' }), false)
})

test('canCreateDeposit: all mode allows any authenticated user when payments are enabled', () => {
  const env = { PAYMENTS_ENABLED: 'true', DEPOSIT_ACCESS_MODE: 'all' }
  assert.equal(canCreateDeposit({ id: 5, role: 'USER' }, env), true)
  assert.equal(canCreateDeposit({ id: 9, role: 'ADMIN' }, env), true)
})

test('canCreateDeposit: admin_allowlist requires ADMIN role AND a listed immutable User ID', () => {
  const env = { PAYMENTS_ENABLED: 'true', DEPOSIT_ACCESS_MODE: 'admin_allowlist', DEPOSIT_ADMIN_ALLOWLIST: '7,40' }
  assert.equal(canCreateDeposit({ id: 7, role: 'ADMIN' }, env), true)
  assert.equal(canCreateDeposit({ id: 40, role: 'ADMIN' }, env), true)
  // Listed but not an admin.
  assert.equal(canCreateDeposit({ id: 7, role: 'USER' }, env), false)
  // Admin but not listed.
  assert.equal(canCreateDeposit({ id: 99, role: 'ADMIN' }, env), false)
})

test('canCreateDeposit: disabled mode blocks everyone even when payments are enabled', () => {
  const env = { PAYMENTS_ENABLED: 'true', DEPOSIT_ACCESS_MODE: 'disabled' }
  assert.equal(canCreateDeposit({ id: 1, role: 'ADMIN' }, env), false)
  assert.equal(canCreateDeposit({ id: 1, role: 'ADMIN' }, { PAYMENTS_ENABLED: 'true' }), false)
})

test('runtimeCapabilities reflects the three independent gates (fail-closed by default)', () => {
  assert.deepEqual(runtimeCapabilities({}), {
    deposits: false,
    payouts: false,
    referralRewards: false,
  })
  assert.deepEqual(
    runtimeCapabilities({
      PAYMENTS_ENABLED: 'true',
      PAYOUTS_ENABLED: 'true',
      REFERRAL_REWARDS_ENABLED: 'true',
    }),
    { deposits: true, payouts: true, referralRewards: true },
  )
  // Gates stay independent.
  assert.deepEqual(runtimeCapabilities({ PAYMENTS_ENABLED: 'true' }), {
    deposits: true,
    payouts: false,
    referralRewards: false,
  })
})
