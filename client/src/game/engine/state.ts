import type { WorldState, BuildingDef, PlotDef, DecorDef, Cell } from './types'

const HQ_PALETTE = {
  top: '#7aa8ff',
  left: '#16224a',
  right: '#2d4fa0',
  detail: '#8B5CF6'
}

const SERVER_PALETTE = {
  top: '#4ad3a0',
  left: '#0f2f27',
  right: '#1a6b52',
  detail: '#16A879'
}

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
      accent: '#3478FF',
      palette: HQ_PALETTE
    },
    {
      id: 'server',
      type: 'server',
      name: 'Server Farm',
      gx: 5,
      gy: 2,
      footprint: { w: 2, h: 2 },
      level: 2,
      maxLevel: 5,
      description: 'Hosts the compute that will power production cycles.',
      nextUpgrade: 'Liquid Cooling',
      accent: '#16A879',
      palette: SERVER_PALETTE
    }
  ]

  const plots: PlotDef[] = [
    {
      id: 'plot-a',
      name: 'Expansion Plot A',
      gx: 5,
      gy: 5,
      footprint: { w: 2, h: 2 },
      status: 'available',
      note: 'Surveyed and ready for a future facility.'
    },
    {
      id: 'plot-b',
      name: 'Expansion Plot B',
      gx: 1,
      gy: 5,
      footprint: { w: 2, h: 2 },
      status: 'locked',
      note: 'Unlocks at a higher empire level.'
    }
  ]

  const decor: DecorDef[] = [
    { id: 'd1', kind: 'pine', gx: 0, gy: 0 },
    { id: 'd2', kind: 'pine', gx: 1, gy: 0 },
    { id: 'd3', kind: 'round', gx: 0, gy: 1 },
    { id: 'd4', kind: 'pine', gx: 7, gy: 0 },
    { id: 'd5', kind: 'round', gx: 7, gy: 1 },
    { id: 'd6', kind: 'pine', gx: 0, gy: 7 },
    { id: 'd7', kind: 'round', gx: 1, gy: 7 },
    { id: 'd8', kind: 'pine', gx: 7, gy: 7 },
    { id: 'd9', kind: 'pine', gx: 7, gy: 6 },
    { id: 'd10', kind: 'bush', gx: 3, gy: 0 },
    { id: 'd11', kind: 'bush', gx: 6, gy: 0 },
    { id: 'd12', kind: 'lamp', gx: 4, gy: 6 },
    { id: 'd13', kind: 'lamp', gx: 5, gy: 7 },
    { id: 'd14', kind: 'crate', gx: 6, gy: 7 },
    { id: 'd15', kind: 'bush', gx: 4, gy: 7 }
  ]

  const paths: Cell[] = [
    { gx: 3, gy: 5 },
    { gx: 3, gy: 6 },
    { gx: 4, gy: 5 },
    { gx: 4, gy: 6 }
  ]

  return { size: 8, buildings, plots, decor, paths }
}
