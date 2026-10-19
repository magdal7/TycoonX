import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  catalogCreateSchema,
  catalogUpdateSchema,
  settingsUpdateSchema,
  userSuspensionSchema,
} from './admin'

test('catalog update rejects economy/production fields (strict)', () => {
  assert.equal(catalogUpdateSchema.safeParse({ name: 'Intern II', isForSale: false }).success, true)
  assert.equal(catalogUpdateSchema.safeParse({ priceUsd: '9.99' }).success, false)
  assert.equal(catalogUpdateSchema.safeParse({ lifetimeCapSp: '999999' }).success, false)
  assert.equal(catalogUpdateSchema.safeParse({ nominalSpPer24h: 500 }).success, false)
  assert.equal(catalogUpdateSchema.safeParse({ cycleHours: 8 }).success, false)
})

test('catalog create requires an explicit new-tier confirmation', () => {
  const base = {
    name: 'New',
    slug: 'new',
    rarity: 'Rare',
    priceUsd: '1.00',
    dailyRatePercent: '0.0100',
    energyCost: 2,
  }
  assert.equal(catalogCreateSchema.safeParse(base).success, false)
  assert.equal(catalogCreateSchema.safeParse({ ...base, confirmNewTier: true }).success, true)
})

test('suspension payload validates', () => {
  assert.equal(userSuspensionSchema.safeParse({ suspend: true, confirm: true }).success, true)
  assert.equal(userSuspensionSchema.safeParse({ suspend: true }).success, false)
})

test('settings update requires confirmation', () => {
  assert.equal(settingsUpdateSchema.safeParse({ registrationEnabled: false }).success, false)
  assert.equal(settingsUpdateSchema.safeParse({ registrationEnabled: false, confirm: true }).success, true)
})
