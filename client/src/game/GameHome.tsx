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
import { useI18n, type TranslationKey } from '../i18n'

/** Interactive "My Empire": a visualisation of the player's real owned CEOs. */
export default function GameHome({ navigate }: { navigate: (p: string) => void }) {
  const { t, tp } = useI18n()
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
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
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
      setNotice(e instanceof Error ? e.message : t('dashboard.actionFailed'))
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
        setFlash(tp('dashboard.cyclesStarted', ids.length))
      } else {
        const r = await bulkCollect(ids)
        setFlash(tp('dashboard.cyclesCollected', r.summary.succeeded))
      }
      window.setTimeout(() => setFlash(''), 4000)
      reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t('dashboard.bulkFailed'))
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
          {t('game.error')} <button className="text-primary underline" onClick={fleet.reload}>{t('common.retry')}</button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => runBulk('start')} disabled={startable === 0} iconLeft={<Play className="h-4 w-4 rtl:rotate-180" />}>
              {t('dashboard.startAll', { count: startable })}
            </Button>
            <Button size="sm" variant="success" onClick={() => runBulk('collect')} disabled={collectable === 0} iconLeft={<Download className="h-4 w-4" />}>
              {t('dashboard.collectAll', { count: collectable })}
            </Button>
            <Button size="sm" variant="ghost" onClick={reload} iconLeft={<RefreshCw className="h-4 w-4" />}>{t('common.refresh')}</Button>
            <Button size="sm" variant="outline" className="ms-auto" onClick={() => setShowList((v) => !v)} iconLeft={showList ? <MapIcon className="h-4 w-4" /> : <List className="h-4 w-4" />}>
              {showList ? t('game.mapView') : t('game.listView')}
            </Button>
          </div>

          {owned.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface-2/40 p-8 text-center">
              <p className="text-sm font-semibold text-ink">{t('game.emptyTitle')}</p>
              <p className="mt-1 text-xs text-muted">{t('game.emptyBody')}</p>
              <Button size="sm" className="mt-4" onClick={() => navigate('/dashboard')}>{t('game.goToEmpire')}</Button>
            </div>
          ) : showList ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {owned.map((ceo) => (
                <button
                  key={ceo.id}
                  type="button"
                  onClick={() => { setShowList(false); setSelected({ kind: 'building', id: `owned-${ceo.id}` }) }}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/50 p-3 text-start transition-colors hover:border-primary/50"
                >
                  <CeoAvatar name={ceo.templateName} slug={ceo.templateSlug} rarity={ceo.rarity} size={44} imageUrl={ceo.templateImageUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{ceo.templateName}</div>
                    <div className="text-[11px] text-muted">{t(`rarity.${ceo.rarity}` as TranslationKey)} · {t(`equip.${ceo.equipment}` as TranslationKey)}</div>
                  </div>
                  <Badge variant={ceo.canCollect ? 'success' : ceo.cycleEndsAt ? 'demo' : 'default'}>
                    {ceo.archivedAt || ceo.status === 'EXHAUSTED' ? t('common.exhausted') : ceo.canCollect ? t('common.ready') : ceo.cycleEndsAt ? t('common.producing') : t('common.idle')}
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
                  onStart={(ceo) => run(ceo, () => startCycle(ceo.id), t('game.cycleStarted'))}
                  onCollect={(ceo) => run(ceo, () => collectCycle(ceo.id), t('game.collected', { name: ceo.templateName }))}
                  onUpgrade={(ceo, target) => run(ceo, () => upgradeEquipment(ceo.id, target), t('dashboard.equipUpgraded', { tier: target }))}
                  onClose={() => setSelected(null)}
                />
              </div>
            </div>
          )}

          {hidden > 0 && (
            <p className="text-[11px] text-muted">
              {t('game.hiddenNote', { max: EMPIRE_MAX_UNITS, total: formatNumber(owned.length) })}
            </p>
          )}
        </>
      )}
    </div>
  )
}
