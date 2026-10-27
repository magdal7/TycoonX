import { test } from 'node:test'
import assert from 'node:assert/strict'
import en from './locales/en'
import ar from './locales/ar'
import fr from './locales/fr'
import es from './locales/es'
import de from './locales/de'
import ptBR from './locales/pt-BR'
import tr from './locales/tr'
import ru from './locales/ru'
import { interpolate, placeholdersOf, pluralCategory, resolvePlural, resolveTranslation } from './translate'

const EN: Record<string, string> = en
const LOCALES: Record<string, Record<string, string>> = { en, ar, fr, es, de, 'pt-BR': ptBR, tr, ru }
const enKeys = Object.keys(EN).sort()

test('every locale defines exactly the same translation keys as English', () => {
  for (const [code, dict] of Object.entries(LOCALES)) {
    const keys = Object.keys(dict).sort()
    const missing = enKeys.filter((k) => !(k in dict))
    const extra = keys.filter((k) => !(k in EN))
    assert.deepEqual(missing, [], `${code} is missing keys`)
    assert.deepEqual(extra, [], `${code} has extra keys`)
    assert.deepEqual(keys, enKeys, `${code} key set differs from en`)
  }
})

test('no locale has empty or whitespace-only translations', () => {
  for (const [code, dict] of Object.entries(LOCALES)) {
    for (const [key, value] of Object.entries(dict)) {
      assert.equal(typeof value, 'string', `${code}.${key} must be a string`)
      assert.ok(value.trim().length > 0, `${code}.${key} is empty`)
    }
  }
})

test('interpolation placeholders match English for every key', () => {
  for (const [code, dict] of Object.entries(LOCALES)) {
    for (const key of enKeys) {
      assert.deepEqual(
        placeholdersOf(dict[key]),
        placeholdersOf(EN[key]),
        `${code}.${key} placeholder mismatch`,
      )
    }
  }
})

test('plural keys are paired (.one and .other both present)', () => {
  const keys = new Set(enKeys)
  for (const key of enKeys) {
    if (key.endsWith('.one')) assert.ok(keys.has(key.replace(/\.one$/, '.other')), `${key} has no .other`)
    if (key.endsWith('.other')) assert.ok(keys.has(key.replace(/\.other$/, '.one')), `${key} has no .one`)
  }
})

test('interpolate fills known tokens and preserves unknown tokens', () => {
  assert.equal(interpolate('Hi {name}', { name: 'Ada' }), 'Hi Ada')
  assert.equal(interpolate('Hi {name}', {}), 'Hi {name}')
  assert.equal(interpolate('a {x} b {y}', { x: 1, y: 2 }), 'a 1 b 2')
  assert.equal(interpolate('no vars'), 'no vars')
})

test('plural categories follow Intl.PluralRules', () => {
  assert.equal(pluralCategory('en', 1), 'one')
  assert.equal(pluralCategory('en', 2), 'other')
  assert.equal(pluralCategory('ar', 2), 'two')
  assert.equal(pluralCategory('ru', 5), 'many')
  assert.equal(pluralCategory('not-a-locale', 1), 'one')
})

test('resolveTranslation falls back to English for a missing key', () => {
  const partial = { 'common.save': 'Speichern' }
  assert.equal(resolveTranslation(partial, en, 'common.save'), 'Speichern')
  assert.equal(resolveTranslation(partial, en, 'common.cancel'), 'Cancel')
  assert.equal(resolveTranslation(partial, en, 'totally.missing.key'), 'totally.missing.key')
})

test('resolvePlural selects .one/.other and falls back', () => {
  const dict = { 'items.one': '{count} item', 'items.other': '{count} items' }
  assert.equal(resolvePlural(dict, en, 'en', 'items', 1), '1 item')
  assert.equal(resolvePlural(dict, en, 'en', 'items', 3), '3 items')
  // Missing plural variant falls back to English .other.
  assert.equal(resolvePlural({}, en, 'en', 'dashboard.cyclesStarted', 2), 'Started 2 cycles')
})
