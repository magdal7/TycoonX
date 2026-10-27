import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildEmpireWorld, ownedUnitState, EMPIRE_MAX_UNITS } from './empire'
import type { OwnedCeo } from '../../lib/game'

const BASE: Omit<OwnedCeo, 'id'> = {
  templateId: 1,
  templateSlug: 'intern-ceo',
  templateName: 'Intern CEO',
  templateImageUrl: null,
  rarity: 'Common',
  acquisitionType: 'STARTER',
  level: 1,
  status: 'IDLE',
  equipment: 'STANDARD',
  cycleLimit: null,
  completedRewardCycles: 0,
  baseSpPerCycle: 10,
  nominalSpPer24h: 120,
  lifetimeCapSp: 500,
  lifetimeEarnedSp: 0,
  archivedAt: null,
  priceUsd: 0,
  cycleHours: 4,
  cycleEndsAt: null,
  cycleRewardSp: null,
  canStart: true,
  canCollect: false,
  acquiredAt: new Date().toISOString(),
}

function ceo(over: Partial<OwnedCeo> & { id: number }): OwnedCeo {
  return { ...BASE, ...over }
}

test('ownedUnitState maps real production flags to a unit state', () => {
  assert.equal(ownedUnitState(ceo({ id: 1 })), 'idle')
  assert.equal(ownedUnitState(ceo({ id: 1, cycleEndsAt: new Date(Date.now() + 1000).toISOString() })), 'producing')
  assert.equal(ownedUnitState(ceo({ id: 1, canCollect: true })), 'ready')
  assert.equal(ownedUnitState(ceo({ id: 1, status: 'EXHAUSTED' })), 'exhausted')
  assert.equal(ownedUnitState(ceo({ id: 1, archivedAt: new Date().toISOString() })), 'exhausted')
})

test('buildEmpireWorld is deterministic and stable across input order', () => {
  const a = [ceo({ id: 3 }), ceo({ id: 1 }), ceo({ id: 2 })]
  const w1 = buildEmpireWorld(a)
  const w2 = buildEmpireWorld([...a].reverse())
  const pos = (w: typeof w1, id: number) => {
    const b = w.buildings.find((x) => x.id === `owned-${id}`)!
    return `${b.gx},${b.gy}`
  }
  assert.equal(pos(w1, 1), pos(w2, 1))
  assert.equal(pos(w1, 2), pos(w2, 2))
  assert.equal(pos(w1, 3), pos(w2, 3))
})

test('buildEmpireWorld gives every copy (including duplicates) its own cell', () => {
  const fleet = [ceo({ id: 1 }), ceo({ id: 2 }), ceo({ id: 3 }), ceo({ id: 4 })]
  const world = buildEmpireWorld(fleet)
  const units = world.buildings.filter((b) => b.ownedCeoId !== undefined)
  assert.equal(units.length, 4)
  const cells = new Set(units.map((u) => `${u.gx},${u.gy}`))
  assert.equal(cells.size, 4)
  assert.ok(units.every((u) => u.id.startsWith('owned-')))
})

test('buildEmpireWorld always includes decorative scenery and never fakes ownership', () => {
  const world = buildEmpireWorld([])
  assert.ok(world.buildings.some((b) => b.id === 'scenery-hq'))
  assert.equal(world.buildings.filter((b) => b.ownedCeoId !== undefined).length, 0)
})

test('buildEmpireWorld bounds the visual fleet size', () => {
  const fleet = Array.from({ length: EMPIRE_MAX_UNITS + 5 }, (_, i) => ceo({ id: i + 1 }))
  const world = buildEmpireWorld(fleet)
  assert.equal(world.buildings.filter((b) => b.ownedCeoId !== undefined).length, EMPIRE_MAX_UNITS)
})
