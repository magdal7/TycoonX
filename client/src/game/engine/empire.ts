import type { BuildingDef, BuildingType, IsoPalette, OwnedUnitState, PlotDef, DecorDef, WorldState } from './types'
import type { OwnedCeo } from '../../lib/game'

/**
 * Builds the interactive "My Empire" world from the player's REAL owned CEO
 * copies. This reuses the existing isometric renderer (GameCanvas / iso.ts) and
 * the existing WorldState shape - each owned copy becomes one unit whose id is
 * `owned-<ownedCeoId>`, with a deterministic, stable grid placement so the map
 * does not jump between renders or sessions.
 *
 * Never invents ownership, production, buildings, or rewards: an empty fleet
 * renders scenery only, and units reflect `OwnedCeo` state verbatim.
 */

const GRID_X = [1, 3, 5, 7]
const GRID_Y = [1, 3, 5, 7]
/** Visual cap; larger fleets use the accessible list and the "+N more" note. */
export const EMPIRE_MAX_UNITS = GRID_X.length * GRID_Y.length

export const EQUIPMENT_LABEL: Record<string, string> = {
  STANDARD: 'Standard - 4h',
  EXTENDED: 'Extended - 6h',
  ADVANCED: 'Advanced - 8h',
}

const RARITY_PALETTE: Record<string, IsoPalette> = {
  Common: { top: '#4ad3a0', left: '#0f2f27', right: '#1a6b52', detail: '#16A879' },
  Rare: { top: '#34d399', left: '#0b2f26', right: '#0f5f4a', detail: '#10B981' },
  Epic: { top: '#5eead4', left: '#0f2f2a', right: '#0f6b5c', detail: '#14B8A6' },
  Legendary: { top: '#fcd34d', left: '#3a2b10', right: '#8a6a1e', detail: '#D4AF65' },
  Mythic: { top: '#fda4af', left: '#3a1020', right: '#7f1d3a', detail: '#f43f5e' },
}

const RARITY_ACCENT: Record<string, string> = {
  Common: '#94a3b8',
  Rare: '#10B981',
  Epic: '#14B8A6',
  Legendary: '#D4AF65',
  Mythic: '#f43f5e',
}

function typeForEquipment(equipment: string): BuildingType {
  if (equipment === 'ADVANCED') return 'tower'
  if (equipment === 'EXTENDED') return 'labs'
  return 'server'
}

function levelForEquipment(equipment: string): number {
  if (equipment === 'ADVANCED') return 3
  if (equipment === 'EXTENDED') return 2
  return 1
}

/** Real production state of an owned copy (never inferred beyond the API). */
export function ownedUnitState(ceo: OwnedCeo): OwnedUnitState {
  if (ceo.archivedAt || ceo.status === 'EXHAUSTED') return 'exhausted'
  if (ceo.canCollect) return 'ready'
  if (ceo.cycleEndsAt) return 'producing'
  return 'idle'
}

function nextUpgradeFor(equipment: string): string {
  if (equipment === 'STANDARD') return 'Upgrade to Extended (6h)'
  if (equipment === 'EXTENDED') return 'Upgrade to Advanced (8h)'
  return 'Max equipment tier'
}

/**
 * Deterministic, bounded placement. Sorting by immutable ownedCeoId keeps a
 * copy in the same cell across reloads, and duplicate copies of the same
 * template each receive their own cell.
 */
export function buildEmpireWorld(owned: OwnedCeo[]): WorldState {
  const sorted = [...owned].sort((a, b) => a.id - b.id)
  const units: BuildingDef[] = sorted.slice(0, EMPIRE_MAX_UNITS).map((ceo, i) => {
    const gx = GRID_X[i % GRID_X.length]
    const gy = GRID_Y[Math.floor(i / GRID_X.length)]
    const level = levelForEquipment(ceo.equipment)
    return {
      id: `owned-${ceo.id}`,
      type: typeForEquipment(ceo.equipment),
      name: ceo.templateName,
      gx,
      gy,
      footprint: { w: 1, h: 1 },
      level,
      maxLevel: 3,
      description: `${ceo.rarity} - ${EQUIPMENT_LABEL[ceo.equipment] ?? ceo.equipment}`,
      nextUpgrade: nextUpgradeFor(ceo.equipment),
      accent: RARITY_ACCENT[ceo.rarity] ?? RARITY_ACCENT.Common,
      palette: RARITY_PALETTE[ceo.rarity] ?? RARITY_PALETTE.Common,
      status: ownedUnitState(ceo) === 'producing' ? 'upgrading' : 'operating',
      ownedCeoId: ceo.id,
      state: ownedUnitState(ceo),
    }
  })

  // Decorative scenery only - clearly separate from owned units.
  const hq: BuildingDef = {
    id: 'scenery-hq',
    type: 'hq',
    name: 'Company Headquarters',
    gx: 4,
    gy: 4,
    footprint: { w: 1, h: 1 },
    level: 1,
    maxLevel: 1,
    description: "Your company's home base. Purely decorative.",
    nextUpgrade: '',
    accent: '#D4AF65',
    palette: { top: '#34d399', left: '#0b2f26', right: '#0f5f4a', detail: '#D4AF65' },
    status: 'operating',
  }

  const plots: PlotDef[] = []
  const decor: DecorDef[] = [
    { id: 'e1', kind: 'pine', gx: 0, gy: 0 },
    { id: 'e2', kind: 'round', gx: 0, gy: 2 },
    { id: 'e3', kind: 'pine', gx: 8, gy: 0 },
    { id: 'e4', kind: 'bush', gx: 8, gy: 2 },
    { id: 'e5', kind: 'round', gx: 0, gy: 8 },
    { id: 'e6', kind: 'pine', gx: 8, gy: 8 },
    { id: 'e7', kind: 'lamp', gx: 4, gy: 0 },
    { id: 'e8', kind: 'lamp', gx: 4, gy: 8 },
    { id: 'e9', kind: 'crate', gx: 2, gy: 4 },
    { id: 'e10', kind: 'bush', gx: 6, gy: 4 },
  ]

  return { size: 9, buildings: [hq, ...units], plots, decor, paths: [] }
}
