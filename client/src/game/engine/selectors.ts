import type { WorldState, Selected } from './types'

export interface SelectionView {
  kind: 'building' | 'plot'
  id: string
  name: string
  subtitle: string
  description: string
  level: number | null
  maxLevel: number | null
  nextUpgrade: string | null
  footprint: string
  status: string
  accent: string
  actionLabel: string
}

export function describeSelection(world: WorldState, selected: Selected): SelectionView | null {
  if (!selected) return null
  if (selected.kind === 'building') {
    const b = world.buildings.find((x) => x.id === selected.id)
    if (!b) return null
    return {
      kind: 'building',
      id: b.id,
      name: b.name,
      subtitle: b.type === 'hq' ? 'Headquarters' : 'Facility',
      description: b.description,
      level: b.level,
      maxLevel: b.maxLevel,
      nextUpgrade: b.nextUpgrade,
      footprint: `${b.footprint.w} × ${b.footprint.h}`,
      status: 'Operating (preview)',
      accent: b.accent,
      actionLabel: `Upgrade to L${Math.min(b.level + 1, b.maxLevel)}`
    }
  }
  const p = world.plots.find((x) => x.id === selected.id)
  if (!p) return null
  return {
    kind: 'plot',
    id: p.id,
    name: p.name,
    subtitle: p.status === 'locked' ? 'Locked plot' : 'Expansion plot',
    description: p.note,
    level: null,
    maxLevel: null,
    nextUpgrade: null,
    footprint: `${p.footprint.w} × ${p.footprint.h}`,
    status: p.status === 'locked' ? 'Locked' : 'Available (preview)',
    accent: p.status === 'locked' ? '#F59E0B' : '#3478FF',
    actionLabel: 'Build facility'
  }
}
