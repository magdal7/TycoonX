export type BuildingType = 'hq' | 'server' | 'labs' | 'tower'

export type BuildingStatus = 'operating' | 'upgrading'

export interface Footprint {
  w: number
  h: number
}

export interface IsoPalette {
  top: string
  left: string
  right: string
  detail: string
}

/** Production state of an owned CEO unit shown on the empire map. */
export type OwnedUnitState = 'idle' | 'producing' | 'ready' | 'exhausted'

export interface BuildingDef {
  id: string
  type: BuildingType
  name: string
  gx: number
  gy: number
  footprint: Footprint
  level: number
  maxLevel: number
  description: string
  nextUpgrade: string
  accent: string
  palette: IsoPalette
  status: BuildingStatus
  /**
   * Present only for units that represent a real owned CEO copy. `id` is then
   * `owned-<ownedCeoId>` and these fields drive the interaction panel.
   */
  ownedCeoId?: number
  state?: OwnedUnitState
}

export type PlotStatus = 'locked' | 'available'

export interface PlotDef {
  id: string
  name: string
  gx: number
  gy: number
  footprint: Footprint
  status: PlotStatus
  note: string
}

export type DecorKind = 'pine' | 'round' | 'bush' | 'lamp' | 'crate'

export interface DecorDef {
  id: string
  kind: DecorKind
  gx: number
  gy: number
}

export interface Cell {
  gx: number
  gy: number
}

export interface WorldState {
  size: number
  buildings: BuildingDef[]
  plots: PlotDef[]
  decor: DecorDef[]
  paths: Cell[]
}

export type Selected = { kind: 'building' | 'plot'; id: string } | null
