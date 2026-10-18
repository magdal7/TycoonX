import { useEffect, useState } from 'react'
import {
  Play,
  Download,
  Rocket,
  Coins,
  Gem,
  Star,
  Clock,
  Cpu,
  AlertTriangle,
  RefreshCw,
  Trophy,
  Building2,
  Archive
} from 'lucide-react'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Progress, Stat, SectionHeading, EmptyState, CardSkeleton } from '../components/ui/kit'
import { CeoAvatar, RARITY_FRAME } from '../components/CeoAvatar'
import { rarityStyle } from '../lib/ceos'
import { useApi } from '../lib/useApi'
import {
  bulkCollect,
  bulkStart,
  collectCycle,
  fetchOwnedCeos,
  fetchResources,
  startCycle,
  upgradeEquipment,
  type OwnedCeo
} from '../lib/game'
import { formatNumber, timeUntil } from '../lib/format'

const EQUIP_LABEL: Record<string, string> = { STANDARD: 'Standard · 4h', EXTENDED: 'Extended · 6h', ADVANCED: 'Advanced · 8h' }
const EQUIP_COST: Record<string, number> = { EXTENDED: 500, ADVANCED: 1500 }
const EQUIP_LEVEL: Record<string, number> = { EXTENDED: 5, ADVANCED: 12 }

function statusBadge(ceo: OwnedCeo) {
  if (ceo.archivedAt || ceo.status === 'EXHAUSTED') return <Badge variant="warning">Archived</Badge>
  if (ceo.canCollect) return <Badge variant="success">Ready to collect</Badge>
  if (ceo.cycleEndsAt) return <Badge variant="demo">Producing</Badge>
  return <Badge>Idle</Badge>
}

export default function Home() {
  const resources = useApi(() => fetchResources(), [])
  const fleet = useApi(() => fetchOwnedCeos(), [])
  const [busy, setBusy] = useState<Record<number, boolean>>({})
  const [, setTick] = useState(0)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const owned = fleet.data ?? []
  const sp = resources.data?.sp
  const progress = resources.data?.progress
  const level = progress?.level ?? 1

  async function run(id: number, fn: () => Promise<unknown>) {
    setBusy((b) => ({ ...b, [id]: true }))
    setNotice('')
    try {
      await fn()
      resources.reload()
      fleet.reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy((b) => ({ ...b, [id]: false }))
    }
  }

  async function runBulk(kind: 'start' | 'collect') {
    const ids = owned.filter((c) => (kind === 'start' ? c.canStart : c.canCollect)).map((c) => c.id)
    if (ids.length === 0) return
    setNotice('')
    try {
      if (kind === 'start') await bulkStart(ids)
      else await bulkCollect(ids)
      resources.reload()
      fleet.reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Bulk action failed')
    }
  }

  const startable = owned.filter((c) => c.canStart).length
  const collectable = owned.filter((c) => c.canCollect).length

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Empire banner */}
      <Card padding="lg" className="relative overflow-hidden border-line">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip border-primary/40 text-primary">
              <Rocket className="h-3.5 w-3.5" /> Command Center
            </span>
            <span className="chip">
              <Trophy className="h-3.5 w-3.5" /> {progress?.rank ?? 'Rookie'} · Level {level}
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
            Build your <span className="text-gradient">technology empire</span>
          </h1>
          <p className="mt-1 max-w-lg text-sm text-muted">
            Recruit CEOs, run production cycles, and climb the ranks. Production is a game mechanic — Earned SP
            is the only potentially withdrawable balance, and withdrawals are currently disabled.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Earned SP" value={sp ? formatNumber(sp.earnedSp) : '—'} Icon={Coins} tone="text-gold" />
            <Stat label="Bonus SP" value={sp ? formatNumber(sp.bonusSp) : '—'} Icon={Gem} tone="text-accent" />
            <Stat label="Lifetime XP" value={progress ? formatNumber(progress.xp) : '—'} Icon={Star} tone="text-primary" />
            <Stat label="CEO Fleet" value={owned.length} Icon={Cpu} />
          </div>

          {progress && (
            <div className="mt-3">
              <Progress
                value={progress.intoLevel}
                max={progress.toNext || 1}
                label={`Level ${progress.level} · ${formatNumber(progress.intoLevel)} / ${formatNumber(progress.toNext)} XP to next`}
              />
            </div>
          )}
        </div>
      </Card>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-red-300">
          <AlertTriangle className="h-4 w-4" /> {notice}
        </div>
      )}

      {/* Bulk actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => runBulk('start')} disabled={startable === 0} iconLeft={<Play className="h-4 w-4" />}>
          Start All ({startable})
        </Button>
        <Button size="sm" variant="success" onClick={() => runBulk('collect')} disabled={collectable === 0} iconLeft={<Download className="h-4 w-4" />}>
          Collect All ({collectable})
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { resources.reload(); fleet.reload() }} iconLeft={<RefreshCw className="h-4 w-4" />}>
          Refresh
        </Button>
      </div>

      {/* Fleet */}
      <SectionHeading eyebrow="Your collection" title="CEO Fleet" description="Each copy has a finite lifetime production cap and archives when exhausted." />

      {fleet.loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : fleet.error ? (
        <EmptyState Icon={AlertTriangle} title="Could not load your fleet" description={fleet.error} action={<Button size="sm" variant="outline" onClick={fleet.reload}>Retry</Button>} />
      ) : owned.length === 0 ? (
        <EmptyState Icon={Cpu} title="No CEOs yet" description="Your free Intern CEO is provisioned on first sign-in." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {owned.map((ceo) => (
            <FleetCard
              key={ceo.id}
              ceo={ceo}
              level={level}
              busy={!!busy[ceo.id]}
              onStart={() => run(ceo.id, () => startCycle(ceo.id))}
              onCollect={() => run(ceo.id, () => collectCycle(ceo.id))}
              onUpgrade={(target) => run(ceo.id, () => upgradeEquipment(ceo.id, target))}
            />
          ))}
        </div>
      )}

      {/* Coming soon */}
      <Card className="flex items-center gap-3 border-dashed border-line bg-surface-2/40">
        <Building2 className="h-5 w-5 text-muted" />
        <div>
          <p className="text-sm font-semibold text-white">Tech Empire</p>
          <p className="text-xs text-muted">Buildings, projects and staff are coming soon.</p>
        </div>
        <Badge variant="warning" className="ml-auto">Coming Soon</Badge>
      </Card>
    </div>
  )
}

function FleetCard({
  ceo,
  level,
  busy,
  onStart,
  onCollect,
  onUpgrade
}: {
  ceo: OwnedCeo
  level: number
  busy: boolean
  onStart: () => void
  onCollect: () => void
  onUpgrade: (target: 'EXTENDED' | 'ADVANCED') => void
}) {
  const style = rarityStyle(ceo.rarity)
  const cap = ceo.lifetimeCapSp ?? 0
  const earned = ceo.lifetimeEarnedSp
  const archived = !!ceo.archivedAt || ceo.status === 'EXHAUSTED'
  const tierOrder = ['STANDARD', 'EXTENDED', 'ADVANCED']
  const currentIdx = tierOrder.indexOf(ceo.equipment)

  return (
    <Card padding="md" className={`border ${RARITY_FRAME[ceo.rarity] ?? 'border-line'} flex flex-col`}>
      <div className="flex items-start gap-3">
        <CeoAvatar name={ceo.templateName} slug={ceo.templateSlug} rarity={ceo.rarity} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-bold text-white">{ceo.templateName}</h3>
            {statusBadge(ceo)}
          </div>
          <p className={`mt-0.5 text-[11px] font-semibold ${style.accent}`}>
            {ceo.rarity} · {EQUIP_LABEL[ceo.equipment] ?? ceo.equipment}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {ceo.nominalSpPer24h != null ? `${formatNumber(ceo.nominalSpPer24h)} SP / 24h` : 'Rate pending'}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <Progress
          value={earned}
          max={cap || 1}
          tone="gold"
          label={`Lifetime production ${formatNumber(earned)} / ${formatNumber(cap)} SP`}
        />
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs">
        <Clock className="h-3.5 w-3.5 text-muted" />
        {archived ? (
          <span className="inline-flex items-center gap-1.5 text-muted"><Archive className="h-3.5 w-3.5" /> Archived — cap reached, ownership retained</span>
        ) : ceo.canCollect ? (
          <span className="text-success">Cycle complete · {formatNumber(ceo.cycleRewardSp ?? 0)} SP ready</span>
        ) : ceo.cycleEndsAt ? (
          <span className="text-muted">Producing · ready in {timeUntil(ceo.cycleEndsAt)}</span>
        ) : (
          <span className="text-muted">Idle — start a cycle to produce</span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {ceo.canCollect ? (
          <Button size="sm" variant="success" className="flex-1" onClick={onCollect} isLoading={busy} iconLeft={<Download className="h-4 w-4" />}>
            Collect
          </Button>
        ) : (
          <Button size="sm" className="flex-1" onClick={onStart} disabled={!ceo.canStart} isLoading={busy} iconLeft={<Play className="h-4 w-4" />}>
            {archived ? 'Exhausted' : ceo.cycleEndsAt ? 'Producing' : 'Start cycle'}
          </Button>
        )}
      </div>

      {!archived && currentIdx < tierOrder.length - 1 && (
        <div className="mt-2 flex gap-2">
          {tierOrder.slice(currentIdx + 1).map((tier) => {
            const t = tier as 'EXTENDED' | 'ADVANCED'
            const locked = level < (EQUIP_LEVEL[t] ?? 1)
            return (
              <button
                key={t}
                type="button"
                disabled={locked || busy}
                onClick={() => onUpgrade(t)}
                className="flex-1 rounded-lg border border-line bg-surface-2/50 px-2 py-1.5 text-[10px] font-semibold text-muted transition-colors hover:border-primary/50 hover:text-white disabled:opacity-40"
                title={locked ? `Unlocks at player level ${EQUIP_LEVEL[t]}` : `Upgrade to ${t} for ${EQUIP_COST[t]} SP`}
              >
                {locked ? `Lv ${EQUIP_LEVEL[t]} to unlock ${t}` : `Upgrade ${t} · ${formatNumber(EQUIP_COST[t])} SP`}
              </button>
            )
          })}
        </div>
      )}
    </Card>
  )
}
