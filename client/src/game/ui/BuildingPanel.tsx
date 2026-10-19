import { Lock, ArrowUpRight, X, Building2, Layers } from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { describeSelection } from '../engine/selectors'
import type { WorldState, Selected } from '../engine/types'

export default function BuildingPanel({
  world,
  selected,
  onClose
}: {
  world: WorldState
  selected: Selected
  onClose: () => void
}) {
  const view = describeSelection(world, selected)

  const body = view ? (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-400">
            {view.kind === 'building' ? <Building2 className="h-3 w-3" /> : <Layers className="h-3 w-3" />}
            {view.subtitle}
          </span>
          <h2 className="mt-0.5 truncate text-lg font-bold text-white">{view.name}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-gray-400 hover:text-white lg:hidden"
          aria-label="Close details"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="text-sm text-gray-400">{view.description}</p>

      <div className="flex flex-wrap gap-2">
        <Badge variant="demo">PREVIEW</Badge>
        {view.upgrading && <Badge variant="warning">Upgrading</Badge>}
        {view.level !== null && (
          <Badge variant="default">
            Level {view.level}/{view.maxLevel} (demo)
          </Badge>
        )}
        <Badge variant="default">Footprint {view.footprint}</Badge>
      </div>

      {view.level !== null && view.maxLevel !== null && (
        <div className="flex items-center gap-1.5">
          {Array.from({ length: view.maxLevel }, (_, i) => (
            <span
              key={i}
              className="h-2 w-6 rounded-full"
              style={{ backgroundColor: i < (view.level ?? 0) ? view.accent : 'rgba(148,163,184,0.16)' }}
            />
          ))}
          <span className="ml-1 text-[10px] text-muted">L{view.level}/{view.maxLevel}</span>
        </div>
      )}

      <div className="rounded-lg border border-gray-800/60 bg-gray-900/30 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Status</span>
          <span className="text-gray-200">{view.status}</span>
        </div>
        {view.nextUpgrade && (
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-gray-400">Next upgrade</span>
            <span className="inline-flex items-center gap-1 text-gray-200">
              <Lock className="h-3 w-3" /> {view.nextUpgrade}
            </span>
          </div>
        )}
      </div>

      <Button variant="outline" size="sm" disabled aria-disabled="true" className="w-full">
        <ArrowUpRight className="mr-2 h-3.5 w-3.5" /> {view.actionLabel} — Coming Soon
      </Button>

      <p className="text-[10px] text-gray-500">Preview only — no purchases, upgrades or ownership.</p>
    </div>
  ) : (
    <div className="py-8 text-center">
      <Building2 className="mx-auto mb-2 h-6 w-6 text-gray-500" />
      <p className="text-sm text-gray-300">Select a building</p>
      <p className="text-xs text-gray-500">Tap a building or available plot to inspect it.</p>
    </div>
  )

  return (
    <div className="lg:h-full">
      <aside className="hidden h-full rounded-2xl border border-gray-800/60 bg-gray-900/30 p-4 lg:block">{body}</aside>
      {view && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)_+_3.5rem)] z-30 mx-3 max-h-[45vh] overflow-y-auto rounded-2xl border border-gray-800/70 bg-gray-900/95 p-4 backdrop-blur lg:hidden">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-700" />
          {body}
        </div>
      )}
    </div>
  )
}
