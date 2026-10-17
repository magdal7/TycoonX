import { useEffect, useState } from 'react'
import {
  Activity,
  Zap,
  TrendingUp,
  Users,
  Building2,
  CheckCircle,
  Target,
  UserPlus,
  Cog,
  ArrowRight,
  Sparkles,
  Clock
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { DEMO_PLAYER, DEMO_PRODUCTION_CYCLES, DEMO_DAILY_TASKS } from '../data/demo'
import { fetchCeos, rarityStyle, type Ceo } from '../lib/ceos'

type Props = { navigate: (p: string) => void }

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function Chip({
  Icon,
  label,
  value
}: {
  Icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700/60 bg-gray-900/50 px-2.5 py-1 text-xs">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="text-gray-400">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </span>
  )
}

function StatusBar({
  Icon,
  label,
  display,
  pct,
  barClass
}: {
  Icon: React.ComponentType<{ className?: string }>
  label: string
  display: string
  pct: number
  barClass: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="flex items-center gap-1.5 text-gray-300">
          <Icon className="h-3.5 w-3.5" /> {label}
        </span>
        <span className="text-gray-400">{display}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-800/70 overflow-hidden">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  )
}

function EmpireHQArt() {
  return (
    <svg
      viewBox="0 0 320 180"
      className="w-full h-auto"
      role="img"
      aria-label="Isometric illustration of your headquarters"
    >
      <defs>
        <linearGradient id="hqTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7aa8ff" />
          <stop offset="100%" stopColor="#3478FF" />
        </linearGradient>
        <linearGradient id="hqLeft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b2a55" />
          <stop offset="100%" stopColor="#121a33" />
        </linearGradient>
        <linearGradient id="hqRight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2d4fa0" />
          <stop offset="100%" stopColor="#1a2c63" />
        </linearGradient>
        <linearGradient id="hqAccent" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b39cf7" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <polygon points="160,120 250,150 160,180 70,150" fill="#0f1730" stroke="#1f2b52" strokeWidth="1" />
      <ellipse cx="160" cy="150" rx="92" ry="26" fill="#3478FF" opacity="0.12" />
      <polygon points="72,98 96,110 96,150 72,138" fill="url(#hqLeft)" />
      <polygon points="120,98 96,110 96,150 120,138" fill="url(#hqRight)" />
      <polygon points="96,86 120,98 96,110 72,98" fill="url(#hqTop)" />
      <polygon points="198,88 224,101 224,150 198,137" fill="url(#hqLeft)" />
      <polygon points="250,88 224,101 224,150 250,137" fill="url(#hqRight)" />
      <polygon points="224,75 250,88 224,101 198,88" fill="url(#hqAccent)" />
      <polygon points="124,66 160,84 160,150 124,132" fill="url(#hqLeft)" />
      <polygon points="196,66 160,84 160,150 196,132" fill="url(#hqRight)" />
      <polygon points="160,48 196,66 160,84 124,66" fill="url(#hqAccent)" />
      <circle cx="160" cy="44" r="9" fill="#8B5CF6" opacity="0.25" />
      <circle cx="160" cy="44" r="4" fill="#8B5CF6" />
      <polygon points="140,140 160,150 160,170 140,160" fill="url(#hqLeft)" />
      <polygon points="180,140 160,150 160,170 180,160" fill="url(#hqRight)" />
      <polygon points="160,130 180,140 160,150 140,140" fill="url(#hqTop)" />
    </svg>
  )
}

export default function Dashboard({ navigate }: Props) {
  const { user, logout } = useAuth()
  const [player, setPlayer] = useState(DEMO_PLAYER)
  const [ceos, setCeos] = useState<Ceo[]>([])
  const [ceosError, setCeosError] = useState('')

  useEffect(() => {
    if (user) {
      setPlayer({
        ...DEMO_PLAYER,
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role
      })
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    let active = true
    fetchCeos()
      .then((data) => {
        if (active) setCeos(data)
      })
      .catch((e: unknown) => {
        if (active) setCeosError(e instanceof Error ? e.message : 'Failed to load the CEO market.')
      })
    return () => {
      active = false
    }
  }, [user])

  if (!user) {
    navigate('/login')
    return null
  }

  const featured = ceos.filter((c) => c.isActive).slice(0, 3)
  const activeCycles = DEMO_PRODUCTION_CYCLES.filter((c) => c.active).length
  const xpPct = Math.round((player.xp / player.xpToNext) * 100)
  const energyPct = player.energy

  const quickActions: {
    id: string
    label: string
    desc: string
    Icon: React.ComponentType<{ className?: string }>
    to?: string
  }[] = [
    { id: 'market', label: 'CEO Market', desc: 'Browse executives', Icon: Users, to: '/dashboard/ceos' },
    { id: 'empire', label: 'Empire', desc: 'Cycles & offices', Icon: Building2, to: '/dashboard/empire' },
    { id: 'missions', label: 'Daily Missions', desc: "Today's objectives", Icon: Target, to: '/dashboard/tasks' },
    { id: 'hire', label: 'Hire CEO', desc: 'Coming soon', Icon: UserPlus },
    { id: 'upgrade', label: 'Upgrade Office', desc: 'Coming soon', Icon: Cog }
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
          <p className="text-sm text-gray-400">Welcome back, {user.username || user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="demo">SIMULATION</Badge>
          <Button variant="outline" onClick={logout} size="sm">
            Sign out
          </Button>
        </div>
      </header>

      {/* Empire HQ hero + game status */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card padding="none" className="relative overflow-hidden border border-gray-800/60 lg:col-span-2">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-bg to-accent/10" />
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, #3478FF 1px, transparent 0)',
              backgroundSize: '22px 22px'
            }}
          />
          <div className="relative z-10 p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary font-semibold">
                <Sparkles className="h-3 w-3" /> Empire HQ
              </span>
              <h2 className="mt-1 text-xl md:text-2xl font-extrabold tracking-tight truncate">
                {user.username || user.email}&apos;s Headquarters
              </h2>
              <p className="mt-1 text-sm text-gray-400 max-w-md">
                Command central for your tech empire. Production, executives and growth — all simulated.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip Icon={Activity} label="Level" value={player.level} />
                <Chip Icon={Zap} label="Energy" value={`${energyPct}%`} />
                <Chip Icon={Users} label="Market" value={`${ceos.length} CEOs`} />
                <Chip Icon={Clock} label="Cycles" value={`${activeCycles} active`} />
              </div>
            </div>
            <div className="w-full md:w-64 lg:w-72 shrink-0">
              <EmpireHQArt />
            </div>
          </div>
        </Card>

        <Card padding="md" className="border border-gray-800/60 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold">Game Status</h2>
            <Badge variant="demo">DEMO VALUES</Badge>
          </div>
          <div className="space-y-4 flex-1">
            <StatusBar
              Icon={Activity}
              label="Level"
              display={`Lv ${player.level}`}
              pct={player.level * 10}
              barClass="bg-gradient-to-r from-primary to-accent"
            />
            <StatusBar
              Icon={TrendingUp}
              label="Experience"
              display={`${player.xp}/${player.xpToNext}`}
              pct={xpPct}
              barClass="bg-gradient-to-r from-accent to-primary"
            />
            <StatusBar
              Icon={Zap}
              label="Office Energy"
              display={`${player.energy}/${player.maxEnergy}`}
              pct={energyPct}
              barClass="bg-gradient-to-r from-success to-primary"
            />
          </div>
          <p className="mt-4 text-[10px] text-gray-500">
            Economy values are simulations only — no real earnings or withdrawals.
          </p>
        </Card>
      </section>

      {/* CEO roster preview */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Executive Roster</h2>
          <a
            href="/dashboard/ceos"
            onClick={(e) => {
              e.preventDefault()
              navigate('/dashboard/ceos')
            }}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Browse market <ArrowRight className="h-3 w-3" />
          </a>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Catalog preview — ownership is not implemented yet.
        </p>
        {ceosError ? (
          <Card padding="sm" className="border border-red-500/30 bg-red-900/10">
            <p className="text-xs text-red-300">{ceosError}</p>
          </Card>
        ) : featured.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border border-gray-800/60 h-32 animate-pulse">
                <div className="h-10 w-10 rounded-lg bg-gray-800/60 mb-3" />
                <div className="h-4 w-1/2 bg-gray-800/60 rounded" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map((ceo) => {
              const style = rarityStyle(ceo.rarity)
              return (
                <Card key={ceo.id} hover padding="sm" className="relative overflow-hidden border border-gray-800/60">
                  <div
                    className={`pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-gradient-to-br ${style.glow} to-transparent blur-2xl`}
                  />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={`h-11 w-11 shrink-0 rounded-xl border border-gray-700/60 bg-gray-800/60 flex items-center justify-center font-bold text-sm ${style.accent}`}
                      >
                        {initials(ceo.name)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white truncate">{ceo.name}</h3>
                        <span
                          className={`inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${style.badge}`}
                        >
                          {ceo.rarity}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">
                        Daily rate <span className={`font-semibold ${style.accent}`}>{ceo.dailyRatePercent}%</span>
                      </span>
                      <span className="text-gray-400">
                        Energy <span className="font-semibold text-white">{ceo.energyCost}</span>
                      </span>
                    </div>
                    <p className="mt-2 text-[10px] text-gray-500">
                      Simulated projection — not purchased, not withdrawable.
                    </p>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Production + Missions */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padding="md" className="border border-gray-800/60">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Production Cycles
            </h2>
            <Badge variant="demo">DEMO</Badge>
          </div>
          <div className="space-y-3">
            {DEMO_PRODUCTION_CYCLES.map((cycle) => (
              <div key={cycle.id} className="rounded-lg border border-gray-800/60 bg-gray-900/30 p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <h3 className="text-sm font-semibold text-white truncate">{cycle.name}</h3>
                  <span
                    className={`text-[10px] font-medium shrink-0 ${
                      cycle.active ? 'text-success' : 'text-gray-400'
                    }`}
                  >
                    {cycle.active ? 'Running' : 'Idle'}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-800/70 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    style={{ width: `${cycle.progress}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                  <span>{cycle.progress}%</span>
                  <span>4h cycle · DEMO</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-gray-500">
            Sample cycles for preview — no real timers or accrual.
          </p>
        </Card>

        <Card padding="md" className="border border-gray-800/60">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Target className="h-4 w-4 text-accent" /> Daily Missions
            </h2>
            <Badge variant="demo">DEMO</Badge>
          </div>
          <div className="space-y-3">
            {DEMO_DAILY_TASKS.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-3 rounded-lg border p-3 ${
                  task.completed ? 'border-success/30 bg-success/5' : 'border-gray-800/60 bg-gray-900/30'
                }`}
              >
                {task.completed ? (
                  <CheckCircle className="h-5 w-5 text-success shrink-0" />
                ) : (
                  <Target className="h-5 w-5 text-gray-500 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <h3
                    className={`text-sm font-semibold truncate ${
                      task.completed ? 'text-gray-400 line-through' : 'text-white'
                    }`}
                  >
                    {task.title}
                  </h3>
                  <p className="text-[10px] text-gray-500">
                    {task.completed ? 'Completed' : 'In progress'}
                  </p>
                </div>
                <span className="text-xs font-bold text-accent shrink-0">+{task.reward} SP</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-gray-500">
            SP = simulated in-game points. Not money, not withdrawable.
          </p>
        </Card>
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="text-lg font-bold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map((action) => {
            const disabled = !action.to
            return (
              <button
                key={action.id}
                type="button"
                disabled={disabled}
                onClick={() => action.to && navigate(action.to)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                  disabled
                    ? 'border-gray-800/60 bg-gray-900/20 opacity-60 cursor-not-allowed'
                    : 'border-gray-800/60 bg-gray-900/30 hover:bg-gray-800/50'
                }`}
              >
                <span className="p-2 rounded-lg bg-gray-800/60 shrink-0">
                  <action.Icon className="h-4 w-4 text-primary" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white truncate">{action.label}</span>
                  <span className="block text-[10px] text-gray-500 truncate">{action.desc}</span>
                </span>
                {disabled ? (
                  <Badge variant="warning">Soon</Badge>
                ) : (
                  <ArrowRight className="h-4 w-4 text-gray-500 shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
