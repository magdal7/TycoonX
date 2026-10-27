import { Clock, Download, Lock, Play, ArrowUpRight, X, Building2 } from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Progress } from '../../components/ui/kit'
import { CeoAvatar, ceoRole, type CeoPortraitState } from '../../components/CeoAvatar'
import { formatNumber } from '../../lib/format'
import type { OwnedCeo } from '../../lib/game'
import type { Selected } from '../engine/types'

const EQUIP_LABEL: Record<string, string> = {
  STANDARD: 'Standard - 4h',
  EXTENDED: 'Extended - 6h',
  ADVANCED: 'Advanced - 8h',
}
const EQUIP_COST: Record<string, number> = { EXTENDED: 500, ADVANCED: 1500 }
const EQUIP_LEVEL: Record<string, number> = { EXTENDED: 5, ADVANCED: 12 }
const TIER_ORDER = ['STANDARD', 'EXTENDED', 'ADVANCED']

function countdown(iso: string, now: number): string {
  const diff = new Date(iso).getTime() - now
  if (diff <= 0) return 'ready'
  const s = Math.floor(diff / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

function portraitState(ceo: OwnedCeo): CeoPortraitState {
  if (ceo.archivedAt || ceo.status === 'EXHAUSTED') return 'exhausted'
  if (ceo.canCollect) return 'ready'
  if (ceo.cycleEndsAt) return 'producing'
  return 'idle'
}

function statusBadge(ceo: OwnedCeo) {
  if (ceo.archivedAt || ceo.status === 'EXHAUSTED') return <Badge variant="warning">Exhausted</Badge>
  if (ceo.canCollect) return <Badge variant="success">Ready to collect</Badge>
  if (ceo.cycleEndsAt) return <Badge variant="demo">Producing</Badge>
  return <Badge>Idle</Badge>
}

export default function EmpirePanel({
  selected,
  owned,
  level,
  now,
  busy,
  onStart,
  onCollect,
  onUpgrade,
  onClose,
}: {
  selected: Selected
  owned: OwnedCeo[]
  level: number
  now: number
  busy: Record<number, boolean>
  onStart: (ceo: OwnedCeo) => void
  onCollect: (ceo: OwnedCeo) => void
  onUpgrade: (ceo: OwnedCeo, target: 'EXTENDED' | 'ADVANCED') => void
  onClose: () => void
}) {
  const ceo =
    selected?.id?.startsWith('owned-')
      ? owned.find((c) => c.id === Number(selected.id.slice('owned-'.length))) ?? null
      : null

  const body = ceo ? (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted">
            <Building2 className="h-3 w-3" /> Owned CEO
          </span>
          <h2 className="mt-0.5 truncate text-lg font-bold text-ink">{ceo.templateName}</h2>
          <p className="text-[11px] font-semibold text-gold">{ceoRole(ceo.rarity)} - {ceo.rarity}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted hover:text-ink lg:hidden"
          aria-label="Close details"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <CeoAvatar name={ceo.templateName} slug={ceo.templateSlug} rarity={ceo.rarity} size={72} state={portraitState(ceo)} imageUrl={ceo.templateImageUrl} />
        <div className="min-w-0 flex-1">
          {statusBadge(ceo)}
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg border border-line bg-surface-2/60 px-2 py-1.5">
              <div className="text-muted">Yield</div>
              <div className="font-bold text-ink">{ceo.nominalSpPer24h != null ? formatNumber(ceo.nominalSpPer24h) : '-'}<span className="font-normal text-muted"> /24h</span></div>
            </div>
            <div className="rounded-lg border border-line bg-surface-2/60 px-2 py-1.5">
              <div className="text-muted">Equipment</div>
              <div className="truncate font-bold text-ink">{EQUIP_LABEL[ceo.equipment] ?? ceo.equipment}</div>
            </div>
          </div>
        </div>
      </div>

      <Progress
        value={ceo.lifetimeEarnedSp}
        max={ceo.lifetimeCapSp || 1}
        tone="gold"
        label={`Lifetime production ${formatNumber(ceo.lifetimeEarnedSp)} / ${formatNumber(ceo.lifetimeCapSp ?? 0)} SP`}
      />

      <div className="rounded-lg border border-line bg-surface-2/50 p-3 text-xs">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted" />
          {ceo.archivedAt || ceo.status === 'EXHAUSTED' ? (
            <span className="text-muted">Archived - cap reached, ownership retained</span>
          ) : ceo.canCollect ? (
            <span className="font-semibold text-success">Ready - {formatNumber(ceo.cycleRewardSp ?? 0)} SP</span>
          ) : ceo.cycleEndsAt ? (
            <span className="text-muted">Producing - ready in {countdown(ceo.cycleEndsAt, now)}</span>
          ) : (
            <span className="text-muted">Idle - start a cycle to produce</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {ceo.canCollect ? (
          <Button size="sm" variant="success" className="flex-1" onClick={() => onCollect(ceo)} isLoading={!!busy[ceo.id]} iconLeft={<Download className="h-4 w-4" />}>
            Collect
          </Button>
        ) : (
          <Button size="sm" className="flex-1" onClick={() => onStart(ceo)} disabled={!ceo.canStart} isLoading={!!busy[ceo.id]} iconLeft={<Play className="h-4 w-4" />}>
            {ceo.archivedAt || ceo.status === 'EXHAUSTED' ? 'Exhausted' : ceo.cycleEndsAt ? 'Producing' : 'Start cycle'}
          </Button>
        )}
      </div>

      {!(ceo.archivedAt || ceo.status === 'EXHAUSTED') && TIER_ORDER.indexOf(ceo.equipment) < TIER_ORDER.length - 1 && (
        <div className="flex gap-2">
          {TIER_ORDER.slice(TIER_ORDER.indexOf(ceo.equipment) + 1).map((tier) => {
            const t = tier as 'EXTENDED' | 'ADVANCED'
            const locked = level < (EQUIP_LEVEL[t] ?? 1)
            return (
              <button
                key={t}
                type="button"
                disabled={locked || !!busy[ceo.id]}
                onClick={() => onUpgrade(ceo, t)}
                className="flex-1 rounded-lg border border-line bg-surface-2/50 px-2 py-1.5 text-[10px] font-semibold text-muted transition-colors hover:border-primary/50 hover:text-ink disabled:opacity-40"
              >
                {locked ? `Lv ${EQUIP_LEVEL[t]} to unlock ${t}` : `Upgrade ${t} - ${formatNumber(EQUIP_COST[t])} SP`}
              </button>
            )
          })}
        </div>
      )}

      <dl className="mt-1 sr-only">
        <dt>Owned CEO</dt>
        <dd>{ceo.templateName}</dd>
      </dl>
    </div>
  ) : selected ? (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-bold text-ink">Company Headquarters</h2>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:text-ink lg:hidden" aria-label="Close details">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-sm text-muted">Your home base. This is decorative scenery — it has no production, purchase or upgrade action.</p>
      <Button variant="outline" size="sm" disabled className="w-full">
        <Lock className="mr-2 h-3.5 w-3.5" /> Decoration
      </Button>
    </div>
  ) : (
    <div className="py-8 text-center">
      <Building2 className="mx-auto mb-2 h-6 w-6 text-muted" />
      <p className="text-sm text-ink">{owned.length ? 'Select one of your CEOs' : 'Your empire is empty'}</p>
      <p className="text-xs text-muted">
        {owned.length ? 'Tap a unit on the map to view and manage it.' : 'Claim your free Intern CEO to start your empire.'}
      </p>
      {!owned.length && (
        <Button size="sm" className="mt-3" onClick={onClose} iconLeft={<ArrowUpRight className="h-3.5 w-3.5" />}>
          Go to Empire
        </Button>
      )}
    </div>
  )

  return (
    <div className="lg:h-full">
      <aside className="hidden h-full rounded-2xl border border-line bg-surface-2/50 p-4 lg:block">{body}</aside>
      {selected && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)_+_3.5rem)] z-30 mx-3 max-h-[45vh] overflow-y-auto rounded-2xl border border-line bg-surface/95 p-4 backdrop-blur lg:hidden">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" />
          {body}
        </div>
      )}
    </div>
  )
}
