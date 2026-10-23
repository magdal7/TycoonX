import type { WorldState, BuildingDef, PlotDef, DecorDef, Cell } from './types'

const HQ_PALETTE = { top: '#34d399', left: '#0b2f26', right: '#0f5f4a', detail: '#D4AF65' }
const SERVER_PALETTE = { top: '#4ad3a0', left: '#0f2f27', right: '#1a6b52', detail: '#16A879' }
const LABS_PALETTE = { top: '#5eead4', left: '#0f2f2a', right: '#0f6b5c', detail: '#14b8a6' }
const TOWER_PALETTE = { top: '#fcd34d', left: '#3a2b10', right: '#8a6a1e', detail: '#D4AF65' }

export function buildDemoWorld(): WorldState {
  const buildings: BuildingDef[] = [
    {
      id: 'hq',
      type: 'hq',
      name: 'Startup Headquarters',
      gx: 2,
      gy: 2,
      footprint: { w: 3, h: 3 },
      level: 3,
      maxLevel: 5,
      description: 'Central command of your growing technology empire.',
      nextUpgrade: 'Executive Wing',
      accent: '#10B981',
      palette: HQ_PALETTE,
      status: 'operating'
    },
    {
      id: 'server',
      type: 'server',
      name: 'Server Farm',
      gx: 6,
      gy: 2,
      footprint: { w: 2, h: 2 },
      level: 2,
      maxLevel: 5,
      description: 'Hosts the compute that powers production cycles.',
      nextUpgrade: 'Liquid Cooling',
      accent: '#16A879',
      palette: SERVER_PALETTE,
      status: 'operating'
    },
    {
      id: 'labs',
      type: 'labs',
      name: 'R&D Labs',
      gx: 2,
      gy: 6,
      footprint: { w: 2, h: 2 },
      level: 2,
      maxLevel: 5,
      description: 'Where future products and upgrades are prototyped.',
      nextUpgrade: 'AI Research Floor',
      accent: '#14B8A6',
      palette: LABS_PALETTE,
      status: 'upgrading'
    },
    {
      id: 'tower',
      type: 'tower',
      name: 'Executive Tower',
      gx: 6,
      gy: 6,
      footprint: { w: 2, h: 2 },
      level: 1,
      maxLevel: 5,
      description: 'A prestige landmark that will raise your empire’s rank.',
      nextUpgrade: 'Sky Lobby',
      accent: '#D4AF65',
      palette: TOWER_PALETTE,
      status: 'operating'
    }
  ]

  const plots: PlotDef[] = [
    { id: 'plot-a', name: 'Expansion Plot A', gx: 5, gy: 6, footprint: { w: 1, h: 1 }, status: 'available', note: 'Surveyed and ready for a future facility.' },
    { id: 'plot-b', name: 'Expansion Plot B', gx: 1, gy: 2, footprint: { w: 1, h: 1 }, status: 'locked', note: 'Unlocks at a higher empire level.' }
  ]

  const decor: DecorDef[] = [
    { id: 'd1', kind: 'pine', gx: 0, gy: 0 },
    { id: 'd2', kind: 'pine', gx: 1, gy: 0 },
    { id: 'd3', kind: 'round', gx: 0, gy: 1 },
    { id: 'd4', kind: 'pine', gx: 8, gy: 0 },
    { id: 'd5', kind: 'round', gx: 8, gy: 1 },
    { id: 'd6', kind: 'pine', gx: 0, gy: 8 },
    { id: 'd7', kind: 'round', gx: 1, gy: 8 },
    { id: 'd8', kind: 'pine', gx: 8, gy: 8 },
    { id: 'd9', kind: 'bush', gx: 3, gy: 0 },
    { id: 'd10', kind: 'bush', gx: 6, gy: 0 },
    { id: 'd11', kind: 'lamp', gx: 4, gy: 8 },
    { id: 'd12', kind: 'lamp', gx: 5, gy: 8 },
    { id: 'd13', kind: 'crate', gx: 8, gy: 4 },
    { id: 'd14', kind: 'bush', gx: 8, gy: 5 }
  ]

  const paths: Cell[] = [
    { gx: 4, gy: 4 },
    { gx: 5, gy: 4 },
    { gx: 4, gy: 5 },
    { gx: 5, gy: 5 }
  ]

  return { size: 9, buildings, plots, decor, paths }
}
