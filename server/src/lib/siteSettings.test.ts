import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SITE_SETTINGS,
  applySiteSettingsPatch,
  parseSiteSettings,
  serializeSiteSettings,
  toPublicSettings,
} from './siteSettings'

test('defaults apply when no keys are stored', () => {
  const settings = parseSiteSettings({})
  assert.deepEqual(settings, DEFAULT_SITE_SETTINGS)
  assert.equal(settings.registrationEnabled, true)
  assert.equal(settings.maintenance.enabled, false)
})

test('stored overrides are parsed and bad JSON falls back to defaults', () => {
  const settings = parseSiteSettings({
    'site.registrationEnabled': 'false',
    'site.maintenance': JSON.stringify({ enabled: true, message: 'Down for upgrades' }),
    'site.announcement': 'not-json',
    'site.features': JSON.stringify({ market: false, wallet: false }),
  })
  assert.equal(settings.registrationEnabled, false)
  assert.equal(settings.maintenance.enabled, true)
  assert.equal(settings.maintenance.message, 'Down for upgrades')
  assert.deepEqual(settings.announcement, DEFAULT_SITE_SETTINGS.announcement)
  assert.equal(settings.features.market, false)
  assert.equal(settings.features.wallet, false)
  assert.equal(settings.features.tasks, true)
})

test('invalid announcement level is rejected', () => {
  const settings = parseSiteSettings({
    'site.announcement': JSON.stringify({ enabled: true, message: 'hi', level: 'rainbow' }),
  })
  assert.equal(settings.announcement.level, 'info')
})

test('patch merges per section and serialize round-trips', () => {
  const next = applySiteSettingsPatch(DEFAULT_SITE_SETTINGS, {
    maintenance: { enabled: true },
    features: { leaderboard: false },
    announcement: { enabled: true, message: 'Hello', level: 'warning' },
  })
  assert.equal(next.maintenance.enabled, true)
  assert.equal(next.maintenance.message, DEFAULT_SITE_SETTINGS.maintenance.message)
  assert.equal(next.features.leaderboard, false)
  assert.equal(next.announcement.level, 'warning')

  const entries: Record<string, string> = {}
  for (const { key, value } of serializeSiteSettings(next)) entries[key] = value
  assert.deepEqual(parseSiteSettings(entries), next)
})

test('public settings expose only the safe view', () => {
  const pub = toPublicSettings(DEFAULT_SITE_SETTINGS)
  assert.deepEqual(Object.keys(pub).sort(), ['announcement', 'features', 'maintenance', 'registrationEnabled'])
})
