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
  Archive,
  Map as MapIcon,
  ChevronRight
} from 'lucide-react'
import { Link } from '../components/router'
import OnboardingGuide from '../components/OnboardingGuide'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Progress, Stat, SectionHeading, EmptyState, CardSkeleton } from '../components/ui/kit'
import { CeoAvatar, RARITY_FRAME, ceoRole, type CeoPortraitState } from '../components/CeoAvatar'
import { rarityStyle } from '../lib/ceos'
import { useApi } from '../lib/useApi'
import { useResources } from '../lib/resources'
import { usePublicSettings } from '../lib/siteSettings'
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

const EQUIP_LABEL: Record<string, string> = { STANDARD: 'Standard · 4h', EXTENDED: 'Extended · 6h', ADVANCED: 'Advanced · 8h' }
const EQUIP_COST: Record<string, number> = { EXTENDED: 500, ADVANCED: 1500 }
const EQUIP_LEVEL: Record<string, number> = { EXTENDED: 5, ADVANCED: 12 }

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

function statusBadge(ceo: OwnedCeo) {
  if (ceo.archivedAt || ceo.status === 'EXHAUSTED') return <Badge variant="warning">Archived</Badge>
  if (ceo.canCollect) return <Badge variant="success">Ready to collect</Badge>
  if (ceo.cycleEndsAt) return <Badge variant="demo">Producing</Badge>
  return <Badge>Idle</Badge>
}

function portraitState(ceo: OwnedCeo): CeoPortraitState {
  if (ceo.archivedAt || ceo.status === 'EXHAUSTED') return 'exhausted'
  if (ceo.canCollect) return 'ready'
  if (ceo.cycleEndsAt) return 'producing'
  return 'idle'
}

/** Elapsed fraction of the current production cycle (0–100). */
function cyclePct(ceo: OwnedCeo, now: number): number {
  if (!ceo.cycleEndsAt) return 0
  const total = Math.max(1, ceo.cycleHours * 3600 * 1000)
  const remaining = new Date(ceo.cycleEndsAt).getTime() - now
  return Math.max(0, Math.min(100, (1 - remaining / total) * 100))
}

export default function Home() {
  const resources = useResources()
  const capabilities = usePublicSettings().data?.capabilities
  const fleet = useApi(() => fetchOwnedCeos(), [])
  const [busy, setBusy] = useState<Record<number, boolean>>({})
  const [now, setNow] = useState(() => Date.now())
  const [notice, setNotice] = useState('')
  const [flash, setFlash] = useState('')
  const [reward, setReward] = useState<{ amount: number; label: string } | null>(null)

  function showReward(amount: number, label: string) {
    if (amount <= 0) return
    setReward({ amount, label })
    window.setTimeout(() => setReward(null), 1700)
  }

  async function collectOne(ceo: OwnedCeo) {
    setBusy((b) => ({ ...b, [ceo.id]: true }))
    setNotice('')
    try {
      const r = await collectCycle(ceo.id)
      if (!r.alreadyCollected) showReward(r.rewardSp, `${ceo.templateName} collected`)
      resources.reload()
      fleet.reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Collect failed')
    } finally {
      setBusy((b) => ({ ...b, [ceo.id]: false }))
    }
  }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const owned = fleet.data ?? []
  const sp = resources.data?.sp
  const progress = resources.data?.progress
  const level = progress?.level ?? 1

  async function run(id: number, fn: () => Promise<unknown>, success?: (r: any) => string) {
    setBusy((b) => ({ ...b, [id]: true }))
    setNotice('')
    setFlash('')
    try {
      const r = await fn()
      if (success) {
        setFlash(success(r))
        window.setTimeout(() => setFlash(''), 4000)
      }
      resources.reload()
      fleet.reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy((b) => ({ ...b, [id]: false }))
    }
  }

  async function runBulk(kind: 'start' | 'collect') {
    const ready = owned.filter((c) => (kind === 'start' ? c.canStart : c.canCollect))
    const ids = ready.map((c) => c.id)
    if (ids.length === 0) return
    setNotice('')
    setFlash('')
    try {
      if (kind === 'start') {
        await bulkStart(ids)
        setFlash(`Started ${ids.length} cycle${ids.length === 1 ? '' : 's'}`)
      } else {
        // Expected total from the server-provided per-copy reward (real data).
        const expected = ready.reduce((sum, c) => sum + (c.cycleRewardSp ?? 0), 0)
        const r = await bulkCollect(ids)
        setFlash(`Collected ${r.summary.succeeded} cycle${r.summary.succeeded === 1 ? '' : 's'}`)
        if (r.summary.succeeded > 0) showReward(expected, `${r.summary.succeeded} cycle${r.summary.succeeded === 1 ? '' : 's'} collected`)
      }
      window.setTimeout(() => setFlash(''), 4000)
      resources.reload()
      fleet.reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Bulk action failed')
    }
  }

  const startable = owned.filter((c) => c.canStart).length
  const collectable = owned.filter((c) => c.canCollect).length
  const activeCycles = owned.filter((c) => c.cycleEndsAt && !c.archivedAt && c.status !== 'EXHAUSTED').length
  const fleetOutput = owned.reduce((sum, c) => sum + (c.nominalSpPer24h ?? 0), 0)

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Empire banner */}
      <Card padding="lg" className="relative overflow-hidden border-line">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip border-primary/40 text-primary">
              <Rocket className="h-3.5 w-3.5" /> Emerald Empire · Command Center
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
            is the only potentially withdrawable balance. {capabilities?.payouts === true
              ? 'Eligible Earned SP withdrawals are available with admin approval.'
              : capabilities?.payouts === false
                ? 'Withdrawals are not open yet.'
                : 'Withdrawal availability is shown in the Wallet.'}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Earned SP" value={sp ? formatNumber(sp.earnedSp) : '—'} Icon={Coins} tone="text-gold" hint="potentially withdrawable" />
            <Stat label="Bonus SP" value={sp ? formatNumber(sp.bonusSp) : '—'} Icon={Gem} tone="text-accent" hint="non-withdrawable" />
            <Stat label="Lifetime XP" value={progress ? formatNumber(progress.xp) : '—'} Icon={Star} tone="text-primary" />
            <Stat label="CEO Fleet" value={owned.length} Icon={Cpu} />
            <Stat label="Fleet output" value={formatNumber(fleetOutput)} Icon={Rocket} tone="text-primary" hint="SP / 24h · gameplay" />
            <Stat label="Active cycles" value={activeCycles} Icon={Clock} hint={collectable > 0 ? `${collectable} ready` : 'in progress'} />
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

      {flash && (
        <div className="flex animate-slide-up items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
          <Download className="h-4 w-4" /> {flash}
        </div>
      )}

      {reward && (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4">
          <div className="motion-safe:animate-reward rounded-2xl border border-gold/40 bg-surface/95 px-5 py-3 text-center shadow-gold backdrop-blur">
            <div className="text-2xl font-black text-gold">+{formatNumber(reward.amount)} SP</div>
            <div className="text-[11px] text-muted">{reward.label}</div>
          </div>
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
              now={now}
              busy={!!busy[ceo.id]}
              onStart={() => run(ceo.id, () => startCycle(ceo.id), (r) => `Cycle started · ${r.cycleHours}h`)}
              onCollect={() => collectOne(ceo)}
              onUpgrade={(target) => run(ceo.id, () => upgradeEquipment(ceo.id, target), () => `Equipment upgraded to ${target}`)}
            />
          ))}
        </div>
      )}

      {/* My Empire */}
      <Card className="flex items-center gap-3 border-line bg-surface-2/40">
        <MapIcon className="h-5 w-5 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">My Empire</p>
          <p className="text-xs text-muted">See your owned CEOs on the interactive empire map.</p>
        </div>
        <Link
          to="/dashboard/world"
          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-white/5"
        >
          Open <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </Card>

      {/* Coming soon */}
      <Card className="flex items-center gap-3 border-dashed border-line bg-surface-2/40">
        <Building2 className="h-5 w-5 text-muted" />
        <div>
          <p className="text-sm font-semibold text-white">Tech Empire</p>
          <p className="text-xs text-muted">Buildings, projects and staff are coming soon.</p>
        </div>
        <Badge variant="warning" className="ml-auto">Coming Soon</Badge>
      </Card>

      <OnboardingGuide />
    </div>
  )
}

function FleetCard({
  ceo,
  level,
  now,
  busy,
  onStart,
  onCollect,
  onUpgrade
}: {
  ceo: OwnedCeo
  level: number
  now: number
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
        <CeoAvatar name={ceo.templateName} slug={ceo.templateSlug} rarity={ceo.rarity} size={72} state={portraitState(ceo)} imageUrl={ceo.templateImageUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-white">{ceo.templateName}</h3>
              <p className={`text-[11px] font-semibold ${style.accent}`}>{ceoRole(ceo.rarity)} · {ceo.rarity}</p>
            </div>
            {statusBadge(ceo)}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg border border-line bg-surface-2/60 px-2 py-1.5">
              <div className="text-muted">Yield</div>
              <div className="font-bold text-white">{ceo.nominalSpPer24h != null ? formatNumber(ceo.nominalSpPer24h) : '—'}<span className="font-normal text-muted"> /24h</span></div>
            </div>
            <div className="rounded-lg border border-line bg-surface-2/60 px-2 py-1.5">
              <div className="text-muted">Equipment</div>
              <div className="truncate font-bold text-white">{EQUIP_LABEL[ceo.equipment] ?? ceo.equipment}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <Progress
          value={earned}
          max={cap || 1}
          tone="gold"
          label={`Lifetime production ${formatNumber(earned)} / ${formatNumber(cap)} SP`}
        />
        <p className="mt-1 text-[10px] text-muted">
          {archived
            ? 'Lifetime cap reached — this copy is archived; ownership is retained.'
            : `${formatNumber(Math.max(0, cap - earned))} SP of lifetime capacity remaining before this copy archives.`}
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted" />
          {archived ? (
            <span className="inline-flex items-center gap-1.5 text-muted"><Archive className="h-3.5 w-3.5" /> Archived — cap reached, ownership retained</span>
          ) : ceo.canCollect ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-success motion-safe:animate-pulse-soft"><Download className="h-3.5 w-3.5" /> Ready · {formatNumber(ceo.cycleRewardSp ?? 0)} SP</span>
          ) : ceo.cycleEndsAt ? (
            <span className="text-muted">Producing · ready in {countdown(ceo.cycleEndsAt, now)}</span>
          ) : (
            <span className="text-muted">Idle — start a cycle to produce</span>
          )}
        </div>
        {!archived && ceo.cycleEndsAt && !ceo.canCollect && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5" role="progressbar" aria-label="Cycle progress">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-1000 ease-linear" style={{ width: `${cyclePct(ceo, now)}%` }} />
          </div>
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
        <>
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
          <p className="mt-1.5 text-[10px] text-muted">
            Longer equipment yields proportionally more SP per collection — the hourly rate is unchanged. Upgrades
            cost SP once and apply to future cycles, not one already running.
          </p>
        </>
      )}
    </Card>
  )
}
