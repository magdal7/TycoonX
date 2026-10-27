import { useEffect, useMemo, useState } from 'react'
import { Play, Download, RefreshCw, AlertTriangle, List, Map as MapIcon } from 'lucide-react'
import GameHud from './ui/GameHud'
import GameCanvas from './render/GameCanvas'
import EmpirePanel from './ui/EmpirePanel'
import { buildEmpireWorld, EMPIRE_MAX_UNITS } from './engine/empire'
import type { Selected } from './engine/types'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { CeoAvatar } from '../components/CeoAvatar'
import { useApi } from '../lib/useApi'
import { useResources } from '../lib/resources'
import {
  bulkCollect,
  bulkStart,
  collectCycle,
  fetchOwnedCeos,
  startCycle,
  upgradeEquipment,
  type OwnedCeo
} from '../lib/game'
import { formatNumber } from '../lib/format'

/** Interactive "My Empire": a visualisation of the player's real owned CEOs. */
export default function GameHome({ navigate }: { navigate: (p: string) => void }) {
  const fleet = useApi(() => fetchOwnedCeos(), [])
  const resources = useResources()
  const owned = fleet.data ?? []
  const level = resources.data?.progress?.level ?? 1

  const world = useMemo(() => buildEmpireWorld(fleet.data ?? []), [fleet.data])
  const [selected, setSelected] = useState<Selected>(null)
  const [showList, setShowList] = useState(false)
  const [busy, setBusy] = useState<Record<number, boolean>>({})
  const [notice, setNotice] = useState('')
  const [flash, setFlash] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  function reload() {
    resources.reload()
    fleet.reload()
  }

  async function run(ceo: OwnedCeo, fn: () => Promise<unknown>, success: string) {
    setBusy((b) => ({ ...b, [ceo.id]: true }))
    setNotice('')
    setFlash('')
    try {
      await fn()
      setFlash(success)
      window.setTimeout(() => setFlash(''), 4000)
      reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy((b) => ({ ...b, [ceo.id]: false }))
    }
  }

  async function runBulk(kind: 'start' | 'collect') {
    const ready = owned.filter((c) => (kind === 'start' ? c.canStart : c.canCollect))
    const ids = ready.map((c) => c.id)
    if (!ids.length) return
    setNotice('')
    setFlash('')
    try {
      if (kind === 'start') {
        await bulkStart(ids)
        setFlash(`Started ${ids.length} cycle${ids.length === 1 ? '' : 's'}`)
      } else {
        const r = await bulkCollect(ids)
        setFlash(`Collected ${r.summary.succeeded} cycle${r.summary.succeeded === 1 ? '' : 's'}`)
      }
      window.setTimeout(() => setFlash(''), 4000)
      reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Bulk action failed')
    }
  }

  const startable = owned.filter((c) => c.canStart).length
  const collectable = owned.filter((c) => c.canCollect).length
  const hidden = Math.max(0, owned.length - EMPIRE_MAX_UNITS)

  return (
    <div className="space-y-4">
      <GameHud onEmpire={() => navigate('/dashboard')} />

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-red-300">
          <AlertTriangle className="h-4 w-4" /> {notice}
        </div>
      )}
      {flash && (
        <div className="flex animate-slide-up items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
          <Download className="h-4 w-4" /> {flash}
        </div>
      )}

      {fleet.error ? (
        <div className="rounded-xl border border-line bg-surface-2/50 px-3 py-2 text-xs text-muted">
          Could not load your empire. <button className="text-primary underline" onClick={fleet.reload}>Retry</button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => runBulk('start')} disabled={startable === 0} iconLeft={<Play className="h-4 w-4" />}>
              Start All ({startable})
            </Button>
            <Button size="sm" variant="success" onClick={() => runBulk('collect')} disabled={collectable === 0} iconLeft={<Download className="h-4 w-4" />}>
              Collect All ({collectable})
            </Button>
            <Button size="sm" variant="ghost" onClick={reload} iconLeft={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setShowList((v) => !v)} iconLeft={showList ? <MapIcon className="h-4 w-4" /> : <List className="h-4 w-4" />}>
              {showList ? 'Map view' : 'List view'}
            </Button>
          </div>

          {owned.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface-2/40 p-8 text-center">
              <p className="text-sm font-semibold text-ink">Your empire is empty</p>
              <p className="mt-1 text-xs text-muted">Your free Intern CEO is provisioned on first sign-in. Visit the Empire dashboard to claim and start producing.</p>
              <Button size="sm" className="mt-4" onClick={() => navigate('/dashboard')}>Go to Empire</Button>
            </div>
          ) : showList ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {owned.map((ceo) => (
                <button
                  key={ceo.id}
                  type="button"
                  onClick={() => { setShowList(false); setSelected({ kind: 'building', id: `owned-${ceo.id}` }) }}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/50 p-3 text-left transition-colors hover:border-primary/50"
                >
                  <CeoAvatar name={ceo.templateName} slug={ceo.templateSlug} rarity={ceo.rarity} size={44} imageUrl={ceo.templateImageUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{ceo.templateName}</div>
                    <div className="text-[11px] text-muted">{ceo.rarity} - {ceo.equipment}</div>
                  </div>
                  <Badge variant={ceo.canCollect ? 'success' : ceo.cycleEndsAt ? 'demo' : 'default'}>
                    {ceo.archivedAt || ceo.status === 'EXHAUSTED' ? 'Exhausted' : ceo.canCollect ? 'Ready' : ceo.cycleEndsAt ? 'Producing' : 'Idle'}
                  </Badge>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="min-w-0 lg:flex-1">
                <GameCanvas world={world} selected={selected} onSelect={setSelected} />
              </div>
              <div className="lg:w-96 lg:shrink-0">
                <EmpirePanel
                  selected={selected}
                  owned={owned}
                  level={level}
                  now={now}
                  busy={busy}
                  onStart={(ceo) => run(ceo, () => startCycle(ceo.id), 'Cycle started')}
                  onCollect={(ceo) => run(ceo, () => collectCycle(ceo.id), `${ceo.templateName} collected`)}
                  onUpgrade={(ceo, target) => run(ceo, () => upgradeEquipment(ceo.id, target), `Equipment upgraded to ${target}`)}
                  onClose={() => setSelected(null)}
                />
              </div>
            </div>
          )}

          {hidden > 0 && (
            <p className="text-[11px] text-muted">
              Showing {EMPIRE_MAX_UNITS} of {formatNumber(owned.length)} copies on the map. Use List view to reach every copy.
            </p>
          )}
        </>
      )}
    </div>
  )
}
