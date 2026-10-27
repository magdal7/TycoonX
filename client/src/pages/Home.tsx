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
  Archive,
  Map as MapIcon,
  ChevronRight,
  Sparkles,
  Target,
  Wallet as WalletIcon,
  ChevronDown,
  TrendingUp
} from 'lucide-react'
import { Link } from '../components/router'
import OnboardingGuide from '../components/OnboardingGuide'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Progress, SectionHeading, EmptyState, CardSkeleton, Skeleton } from '../components/ui/kit'
import { CeoAvatar, RARITY_FRAME, ceoRole, type CeoPortraitState } from '../components/CeoAvatar'
import { rarityStyle } from '../lib/ceos'
import { useApi } from '../lib/useApi'
import { useResources } from '../lib/resources'
import { usePublicSettings } from '../lib/siteSettings'
import { useAuth } from '../context/AuthContext'
import {
  bulkCollect,
  bulkStart,
  collectCycle,
  fetchOwnedCeos,
  fetchWalletTransactions,
  startCycle,
  upgradeEquipment,
  type OwnedCeo
} from '../lib/game'
import { formatNumber } from '../lib/format'
import { useI18n, type TranslationKey } from '../i18n'

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

export default function Home() {
  const { t, tp } = useI18n()
  const { user } = useAuth()
  const resources = useResources()
  const fleet = useApi(() => fetchOwnedCeos(), [])
  const activity = useApi(() => fetchWalletTransactions(), [])
  const features = usePublicSettings().data?.features
  const [busy, setBusy] = useState<Record<number, boolean>>({})
  const [now, setNow] = useState(() => Date.now())
  const [notice, setNotice] = useState('')
  const [flash, setFlash] = useState('')
  const [reward, setReward] = useState<{ amount: number; label: string } | null>(null)
  const [showDetails, setShowDetails] = useState(false)

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
      if (!r.alreadyCollected) showReward(r.rewardSp, ceo.templateName)
      resources.reload()
      fleet.reload()
      activity.reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t('dashboard.collectFailed'))
    } finally {
      setBusy((b) => ({ ...b, [ceo.id]: false }))
    }
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
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
      activity.reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t('dashboard.actionFailed'))
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
        setFlash(tp('dashboard.cyclesStarted', ids.length))
      } else {
        const expected = ready.reduce((sum, c) => sum + (c.cycleRewardSp ?? 0), 0)
        const r = await bulkCollect(ids)
        setFlash(tp('dashboard.cyclesCollected', r.summary.succeeded))
        if (r.summary.succeeded > 0) showReward(expected, tp('dashboard.cyclesCollectedLabel', r.summary.succeeded))
      }
      window.setTimeout(() => setFlash(''), 4000)
      resources.reload()
      fleet.reload()
      activity.reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t('dashboard.bulkFailed'))
    }
  }

  const startable = owned.filter((c) => c.canStart).length
  const collectable = owned.filter((c) => c.canCollect).length
  const activeCycles = owned.filter((c) => c.cycleEndsAt && !c.archivedAt && c.status !== 'EXHAUSTED').length
  const production = owned.reduce((sum, c) => sum + (c.nominalSpPer24h ?? 0), 0)
  const recent = (activity.data ?? []).slice(0, 4)

  const statusBadge = (ceo: OwnedCeo) => {
    if (ceo.archivedAt || ceo.status === 'EXHAUSTED') return <Badge variant="warning">{t('common.archived')}</Badge>
    if (ceo.canCollect) return <Badge variant="success">{t('common.ready')}</Badge>
    if (ceo.cycleEndsAt) return <Badge variant="demo">{t('common.producing')}</Badge>
    return <Badge>{t('common.idle')}</Badge>
  }

  function portraitState(ceo: OwnedCeo): CeoPortraitState {
    if (ceo.archivedAt || ceo.status === 'EXHAUSTED') return 'exhausted'
    if (ceo.canCollect) return 'ready'
    if (ceo.cycleEndsAt) return 'producing'
    return 'idle'
  }

  function cyclePct(ceo: OwnedCeo): number {
    if (!ceo.cycleEndsAt) return 0
    const total = Math.max(1, ceo.cycleHours * 3600 * 1000)
    const remaining = new Date(ceo.cycleEndsAt).getTime() - now
    return Math.max(0, Math.min(100, (1 - remaining / total) * 100))
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Greeting + balances */}
      <Card padding="lg" className="relative overflow-hidden border-line">
        <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted">{t('dashboard.greeting', { name: user?.username ?? '' })}</p>
              <h1 className="mt-0.5 text-xl font-black tracking-tight sm:text-2xl">
                <span className="text-gradient">{progress?.rank ?? t('profile.rarity')}</span>
                <span className="text-muted"> · {t('common.level')} {level}</span>
              </h1>
            </div>
            <span className="chip border-primary/40 text-primary">
              <Rocket className="h-3.5 w-3.5" /> {t('brand.empire')}
            </span>
          </div>

          {progress && (
            <div className="mt-3">
              <Progress
                value={progress.intoLevel}
                max={progress.toNext || 1}
                label={t('dashboard.levelToNext', { level: progress.level, current: formatNumber(progress.intoLevel), total: formatNumber(progress.toNext) })}
              />
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gold/25 bg-gold/5 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted">
                <Coins className="h-3.5 w-3.5 text-gold" /> {t('dashboard.earnedSp')}
              </div>
              <div className="mt-1 text-2xl font-black text-gold">{sp ? formatNumber(sp.earnedSp) : '—'}</div>
              <div className="text-[10px] text-muted">{t('stat.potentiallyWithdrawable')}</div>
            </div>
            <div className="rounded-2xl border border-accent/25 bg-accent/5 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted">
                <Gem className="h-3.5 w-3.5 text-accent" /> {t('dashboard.bonusSp')}
              </div>
              <div className="mt-1 text-2xl font-black text-accent">{sp ? formatNumber(sp.bonusSp) : '—'}</div>
              <div className="text-[10px] text-muted">{t('stat.nonWithdrawable')}</div>
            </div>
          </div>
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

      {/* Compact empire overview (secondary metrics grouped / expandable) */}
      <Card padding="md" className="border-line">
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="flex w-full items-center gap-3 text-start"
          aria-expanded={showDetails}
        >
          <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-bold text-white">{t('dashboard.overview')}</span>
          <span className="ms-auto flex items-center gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><Cpu className="h-3.5 w-3.5" /> {owned.length}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {activeCycles}</span>
            {collectable > 0 && <Badge variant="success">{t('dashboard.ready', { count: collectable })}</Badge>}
            <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {showDetails && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <OverviewStat Icon={Cpu} label={t('dashboard.myCeos')} value={String(owned.length)} />
            <OverviewStat Icon={Rocket} label={t('dashboard.production')} value={formatNumber(production)} hint={t('dashboard.productionHint')} />
            <OverviewStat Icon={Clock} label={t('dashboard.activeCycles')} value={String(activeCycles)} />
            <OverviewStat Icon={Star} label={t('dashboard.lifetimeXp')} value={progress ? formatNumber(progress.xp) : '—'} />
          </div>
        )}
      </Card>

      {/* Primary gameplay actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => runBulk('start')} disabled={startable === 0} iconLeft={<Play className="h-4 w-4 rtl:rotate-180" />}>
          {t('dashboard.startAll', { count: startable })}
        </Button>
        <Button size="sm" variant="success" onClick={() => runBulk('collect')} disabled={collectable === 0} iconLeft={<Download className="h-4 w-4" />}>
          {t('dashboard.collectAll', { count: collectable })}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { resources.reload(); fleet.reload(); activity.reload() }} iconLeft={<RefreshCw className="h-4 w-4" />}>
          {t('common.refresh')}
        </Button>
      </div>

      {/* My CEOs */}
      <SectionHeading eyebrow={t('dashboard.section.collection')} title={t('dashboard.fleet.title')} description={t('dashboard.fleet.description')} />

      {fleet.loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : fleet.error ? (
        <EmptyState Icon={AlertTriangle} title={t('dashboard.fleet.error')} description={fleet.error} action={<Button size="sm" variant="outline" onClick={fleet.reload}>{t('common.retry')}</Button>} />
      ) : owned.length === 0 ? (
        <EmptyState Icon={Cpu} title={t('dashboard.fleet.empty.title')} description={t('dashboard.fleet.empty.body')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {owned.map((ceo) => (
            <FleetCard
              key={ceo.id}
              ceo={ceo}
              level={level}
              now={now}
              busy={!!busy[ceo.id]}
              statusBadge={statusBadge(ceo)}
              portrait={portraitState(ceo)}
              pct={cyclePct(ceo)}
              onStart={() => run(ceo.id, () => startCycle(ceo.id), (r) => t('dashboard.cycleStarted', { hours: r.cycleHours }))}
              onCollect={() => collectOne(ceo)}
              onUpgrade={(target) => run(ceo.id, () => upgradeEquipment(ceo.id, target), () => t('dashboard.equipUpgraded', { tier: target }))}
            />
          ))}
        </div>
      )}

      {/* My Empire */}
      <Card className="flex items-center gap-3 border-line bg-surface-2/40">
        <MapIcon className="h-5 w-5 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{t('dashboard.world.title')}</p>
          <p className="text-xs text-muted">{t('dashboard.world.body')}</p>
        </div>
        <Link
          to="/dashboard/world"
          className="ms-auto inline-flex shrink-0 items-center gap-1 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-white/5"
        >
          {t('common.open')} <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
        </Link>
      </Card>

      {/* Missions & progression */}
      <SectionHeading eyebrow={t('nav.progress')} title={t('dashboard.missions.title')} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/dashboard/tasks" className="flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-4 transition-colors hover:border-primary/40">
          <Target className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">{t('dashboard.missions.title')}</p>
            <p className="truncate text-[11px] text-muted">{collectable > 0 ? t('dashboard.missions.body', { count: collectable }) : t('dashboard.missions.none')}</p>
          </div>
        </Link>
        {features?.leaderboard !== false && (
          <Link to="/dashboard/leaderboard" className="flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-4 transition-colors hover:border-primary/40">
            <Trophy className="h-5 w-5 shrink-0 text-gold" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">{t('nav.leaderboard')}</p>
              <p className="truncate text-[11px] text-muted">{t('landing.progress.leaderboard.text')}</p>
            </div>
          </Link>
        )}
        {features?.achievements === true && (
          <Link to="/dashboard/achievements" className="flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-4 transition-colors hover:border-primary/40">
            <Sparkles className="h-5 w-5 shrink-0 text-accent" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">{t('nav.achievements')}</p>
              <p className="truncate text-[11px] text-muted">{t('landing.progress.achievements.text')}</p>
            </div>
          </Link>
        )}
      </div>

      {/* Recent activity */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-white"><WalletIcon className="h-4 w-4 text-muted" /> {t('dashboard.activity.title')}</h2>
        {activity.loading ? (
          <Skeleton className="h-14" />
        ) : recent.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface-2/40 px-3 py-3 text-xs text-muted">{t('dashboard.activity.empty')}</p>
        ) : (
          <Card padding="none" className="overflow-hidden border-line">
            {recent.map((tx, i) => (
              <div key={tx.id} className={`flex items-center gap-3 px-3 py-2.5 ${i !== 0 ? 'border-t border-line' : ''}`}>
                <span className="flex-1 truncate text-xs text-muted">{tx.label}</span>
                <span className={`text-sm font-semibold ${tx.type === 'SP' && tx.amount.startsWith('-') ? 'text-red-300' : 'text-white'}`}>
                  {tx.type === 'SP' && !tx.amount.startsWith('-') ? '+' : ''}{formatNumber(Number(tx.amount))}{tx.type === 'SP' ? ' SP' : tx.type === 'DEPOSIT' || tx.type === 'PURCHASE' ? ' USDT' : ''}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <OnboardingGuide />
    </div>
  )
}

function OverviewStat({
  Icon,
  label,
  value,
  hint
}: {
  Icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-base font-bold text-white">{value}</div>
      {hint && <div className="text-[9px] text-muted">{hint}</div>}
    </div>
  )
}

function FleetCard({
  ceo,
  level,
  now,
  busy,
  statusBadge,
  portrait,
  pct,
  onStart,
  onCollect,
  onUpgrade
}: {
  ceo: OwnedCeo
  level: number
  now: number
  busy: boolean
  statusBadge: React.ReactNode
  portrait: CeoPortraitState
  pct: number
  onStart: () => void
  onCollect: () => void
  onUpgrade: (target: 'EXTENDED' | 'ADVANCED') => void
}) {
  const t = useI18n().t
  const style = rarityStyle(ceo.rarity)
  const cap = ceo.lifetimeCapSp ?? 0
  const earned = ceo.lifetimeEarnedSp
  const archived = !!ceo.archivedAt || ceo.status === 'EXHAUSTED'
  const tierOrder = ['STANDARD', 'EXTENDED', 'ADVANCED']
  const currentIdx = tierOrder.indexOf(ceo.equipment)

  return (
    <Card padding="md" className={`border ${RARITY_FRAME[ceo.rarity] ?? 'border-line'} flex flex-col`}>
      <div className="flex items-start gap-3">
        <CeoAvatar name={ceo.templateName} slug={ceo.templateSlug} rarity={ceo.rarity} size={72} state={portrait} imageUrl={ceo.templateImageUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-white">{ceo.templateName}</h3>
              <p className={`text-[11px] font-semibold ${style.accent}`}>{ceoRole(ceo.rarity)} · {t(`rarity.${ceo.rarity}` as TranslationKey)}</p>
            </div>
            {statusBadge}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg border border-line bg-surface-2/60 px-2 py-1.5">
              <div className="text-muted">{t('dashboard.yield')}</div>
              <div className="font-bold text-white">{ceo.nominalSpPer24h != null ? formatNumber(ceo.nominalSpPer24h) : '—'}<span className="font-normal text-muted"> /24h</span></div>
            </div>
            <div className="rounded-lg border border-line bg-surface-2/60 px-2 py-1.5">
              <div className="text-muted">{t('dashboard.equipment')}</div>
              <div className="truncate font-bold text-white">{t(`equip.${ceo.equipment}` as TranslationKey)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <Progress
          value={earned}
          max={cap || 1}
          tone="gold"
          label={t('dashboard.lifetimeProduction', { earned: formatNumber(earned), cap: formatNumber(cap) })}
        />
        <p className="mt-1 text-[10px] text-muted">
          {archived
            ? t('dashboard.capReached')
            : t('dashboard.capRemaining', { sp: formatNumber(Math.max(0, cap - earned)) })}
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted" />
          {archived ? (
            <span className="inline-flex items-center gap-1.5 text-muted"><Archive className="h-3.5 w-3.5" /> {t('dashboard.archivedNote')}</span>
          ) : ceo.canCollect ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-success motion-safe:animate-pulse-soft"><Download className="h-3.5 w-3.5" /> {t('dashboard.readyToCollect', { sp: formatNumber(ceo.cycleRewardSp ?? 0) })}</span>
          ) : ceo.cycleEndsAt ? (
            <span className="text-muted">{t('dashboard.producingIn', { time: countdown(ceo.cycleEndsAt, now) })}</span>
          ) : (
            <span className="text-muted">{t('dashboard.idleStart')}</span>
          )}
        </div>
        {!archived && ceo.cycleEndsAt && !ceo.canCollect && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5" role="progressbar" aria-label={t('dashboard.cycleProgress')}>
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {ceo.canCollect ? (
          <Button size="sm" variant="success" className="flex-1" onClick={onCollect} isLoading={busy} iconLeft={<Download className="h-4 w-4" />}>
            {t('dashboard.collect.collectBtn')}
          </Button>
        ) : (
          <Button size="sm" className="flex-1" onClick={onStart} disabled={!ceo.canStart} isLoading={busy} iconLeft={<Play className="h-4 w-4 rtl:rotate-180" />}>
            {archived ? t('common.exhausted') : ceo.cycleEndsAt ? t('common.producing') : t('dashboard.collect.startBtn')}
          </Button>
        )}
      </div>

      {!archived && currentIdx < tierOrder.length - 1 && (
        <>
          <div className="mt-2 flex gap-2">
            {tierOrder.slice(currentIdx + 1).map((tier) => {
              const target = tier as 'EXTENDED' | 'ADVANCED'
              const locked = level < (EQUIP_LEVEL[target] ?? 1)
              return (
                <button
                  key={target}
                  type="button"
                  disabled={locked || busy}
                  onClick={() => onUpgrade(target)}
                  className="flex-1 rounded-lg border border-line bg-surface-2/50 px-2 py-1.5 text-[10px] font-semibold text-muted transition-colors hover:border-primary/50 hover:text-white disabled:opacity-40"
                  title={locked ? t('dashboard.unlockAt', { level: EQUIP_LEVEL[target] }) : t('dashboard.upgradeTo', { tier: target, cost: EQUIP_COST[target] })}
                >
                  {locked ? t('dashboard.lvToUnlock', { level: EQUIP_LEVEL[target], tier: target }) : t('dashboard.upgradeBtn', { tier: target, cost: formatNumber(EQUIP_COST[target]) })}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[10px] text-muted">{t('dashboard.equipNote')}</p>
        </>
      )}
    </Card>
  )
}
