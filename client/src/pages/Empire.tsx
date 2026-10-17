import { useState } from 'react'
import {
  Building2,
  Server,
  BrainCircuit,
  Database,
  Lock,
  Unlock,
  ArrowRight,
  Sparkles,
  Clock,
  Zap,
  Activity,
  Layers
} from 'lucide-react'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { DEMO_PRODUCTION_CYCLES } from '../data/demo'

type Tab = 'overview' | 'buildings' | 'production'

interface IsoColors {
  top: string
  left: string
  right: string
}

interface EmpireBuilding {
  id: string
  name: string
  purpose: string
  level: number
  unlocked: boolean
  upgrades: string[]
  Icon: React.ComponentType<{ className?: string }>
  cx: number
  cy: number
  a: number
  h: number
  colors: IsoColors
  accent: string
}

const BUILDINGS: EmpireBuilding[] = [
  {
    id: 'hq',
    name: 'Headquarters',
    purpose: 'Central command for your tech empire and executive operations.',
    level: 3,
    unlocked: true,
    upgrades: ['Executive Office', 'Security Wing', 'Neural Command Deck'],
    Icon: Building2,
    cx: 240,
    cy: 176,
    a: 44,
    h: 100,
    colors: { top: '#7aa8ff', left: '#16224a', right: '#2d4fa0' },
    accent: '#3478FF'
  },
  {
    id: 'servers',
    name: 'Server Farm',
    purpose: 'Hosts your compute capacity and keeps production cycles online.',
    level: 2,
    unlocked: true,
    upgrades: ['Edge Nodes', 'Liquid Cooling', 'Autoscale Racks'],
    Icon: Server,
    cx: 132,
    cy: 212,
    a: 34,
    h: 50,
    colors: { top: '#4ad3a0', left: '#0f2f27', right: '#1a6b52' },
    accent: '#16A879'
  },
  {
    id: 'ailab',
    name: 'AI Lab',
    purpose: 'Trains models that automate research and executive decisions.',
    level: 1,
    unlocked: true,
    upgrades: ['GPU Cluster', 'Model Foundry', 'Autonomous Agents'],
    Icon: BrainCircuit,
    cx: 348,
    cy: 212,
    a: 34,
    h: 64,
    colors: { top: '#b39cf7', left: '#241a44', right: '#5b3fb0' },
    accent: '#8B5CF6'
  },
  {
    id: 'datacenter',
    name: 'Data Center',
    purpose: 'Stores and streams your empire data across the network.',
    level: 0,
    unlocked: false,
    upgrades: ['Cold Storage', 'Global CDN', 'Quantum Vault'],
    Icon: Database,
    cx: 240,
    cy: 250,
    a: 38,
    h: 40,
    colors: { top: '#f6c667', left: '#3a2c12', right: '#a97a1f' },
    accent: '#F59E0B'
  }
]

function isoBox(cx: number, cy: number, a: number, h: number) {
  const pt = (x: number, y: number) => `${x},${y}`
  const E = [cx + a, cy]
  const S = [cx, cy + a / 2]
  const W = [cx - a, cy]
  const Np = [cx, cy - h - a / 2]
  const Ep = [cx + a, cy - h]
  const Sp = [cx, cy - h + a / 2]
  const Wp = [cx - a, cy - h]
  return {
    top: [Np, Ep, Sp, Wp].map((p) => pt(p[0], p[1])).join(' '),
    left: [W, S, Sp, Wp].map((p) => pt(p[0], p[1])).join(' '),
    right: [S, E, Ep, Sp].map((p) => pt(p[0], p[1])).join(' ')
  }
}

function IsoBuilding({
  building,
  selected,
  onSelect
}: {
  building: EmpireBuilding
  selected: boolean
  onSelect: (id: string) => void
}) {
  const geo = isoBox(building.cx, building.cy, building.a, building.h)
  const stroke = selected ? building.accent : 'rgba(148,163,184,0.25)'
  const topY = building.cy - building.h - building.a / 2

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${building.name} — ${building.unlocked ? `level ${building.level} preview` : 'locked preview'}`}
      aria-pressed={selected}
      onClick={() => onSelect(building.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(building.id)
        }
      }}
      className={`cursor-pointer transition-opacity ${building.unlocked ? '' : 'opacity-60'} outline-none`}
    >
      {selected && (
        <ellipse
          cx={building.cx}
          cy={topY + 6}
          rx={building.a + 16}
          ry={building.a / 2 + 10}
          fill={building.accent}
          opacity="0.16"
        />
      )}
      <polygon points={geo.left} fill={building.colors.left} stroke={stroke} strokeWidth={selected ? 2 : 1} />
      <polygon points={geo.right} fill={building.colors.right} stroke={stroke} strokeWidth={selected ? 2 : 1} />
      <polygon points={geo.top} fill={building.colors.top} stroke={stroke} strokeWidth={selected ? 2 : 1} />
      {selected && (
        <circle
          cx={building.cx}
          cy={topY - 8}
          r="4"
          fill={building.accent}
          className="motion-safe:animate-pulse"
        />
      )}
      <text
        x={building.cx}
        y={building.cy + building.a / 2 + 15}
        textAnchor="middle"
        fontSize="9"
        fill={selected ? building.accent : '#94a3b8'}
        className="select-none"
      >
        {building.name}
      </text>
    </g>
  )
}

export default function Empire() {
  const [tab, setTab] = useState<Tab>('overview')
  const [selectedId, setSelectedId] = useState<string>('hq')

  const selected = BUILDINGS.find((b) => b.id === selectedId) ?? BUILDINGS[0]
  const unlockedCount = BUILDINGS.filter((b) => b.unlocked).length
  const avgLevel = Math.round((BUILDINGS.reduce((s, b) => s + b.level, 0) / BUILDINGS.length) * 10) / 10
  const activeCycles = DEMO_PRODUCTION_CYCLES.filter((c) => c.active).length

  function selectBuilding(id: string, goToOverview = false) {
    setSelectedId(id)
    if (goToOverview) setTab('overview')
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'buildings', label: 'Buildings' },
    { id: 'production', label: 'Production' }
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary font-semibold">
            <Sparkles className="h-3 w-3" /> Empire Management
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Empire</h1>
          <p className="text-sm text-gray-400">Build and upgrade your futuristic tech headquarters.</p>
        </div>
        <Badge variant="demo">DEMO / PREVIEW</Badge>
      </header>

      <div role="tablist" aria-label="Empire sections" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-primary/10 text-primary border border-primary/40'
                : 'text-gray-300 border border-gray-800/60 hover:bg-gray-800/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4" role="tabpanel">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Buildings', value: BUILDINGS.length, Icon: Layers, color: 'text-primary' },
              { label: 'Unlocked', value: unlockedCount, Icon: Unlock, color: 'text-success' },
              { label: 'Avg level', value: avgLevel, Icon: Activity, color: 'text-accent' },
              { label: 'Active cycles', value: activeCycles, Icon: Clock, color: 'text-amber-400' }
            ].map((s) => (
              <Card key={s.label} padding="sm" className="border border-gray-800/60">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">{s.label}</p>
                    <p className="text-lg font-bold text-white">{s.value}</p>
                  </div>
                  <s.Icon className={`h-4 w-4 ${s.color}`} />
                </div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card padding="none" className="relative overflow-hidden border border-gray-800/60 lg:col-span-2">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/12 via-bg to-accent/10" />
              <div
                className="absolute inset-0 opacity-[0.12]"
                style={{
                  backgroundImage: 'radial-gradient(circle at 1px 1px, #3478FF 1px, transparent 0)',
                  backgroundSize: '22px 22px'
                }}
              />
              <div className="relative z-10 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold">Empire HQ Scene</h2>
                  <span className="text-[10px] text-gray-400">Tap a building to inspect</span>
                </div>
                <svg
                  viewBox="0 0 480 320"
                  className="w-full h-auto"
                  role="group"
                  aria-label="Isometric empire scene"
                >
                  <defs>
                    <linearGradient id="isoGround" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#101a36" />
                      <stop offset="100%" stopColor="#0b1020" />
                    </linearGradient>
                  </defs>
                  <polygon points="240,123 425,215 240,307 55,215" fill="url(#isoGround)" stroke="#1f2b52" strokeWidth="1" />
                  <polygon points="240,150 360,210 240,270 120,210" fill="none" stroke="#1b2547" strokeWidth="1" />
                  <polygon points="240,174 302,205 240,236 178,205" fill="none" stroke="#1b2547" strokeWidth="1" />
                  <ellipse cx="240" cy="215" rx="170" ry="80" fill="#3478FF" opacity="0.08" />

                  {BUILDINGS.slice()
                    .sort((a, b) => a.cy - b.cy)
                    .map((b) => (
                      <IsoBuilding
                        key={b.id}
                        building={b}
                        selected={b.id === selectedId}
                        onSelect={selectBuilding}
                      />
                    ))}
                </svg>
              </div>
            </Card>

            <Card padding="md" className="border border-gray-800/60 flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <span className="p-2 rounded-lg bg-gray-800/60 shrink-0">
                  <selected.Icon className="h-5 w-5 text-primary" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-bold text-white truncate">{selected.name}</h2>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                      selected.unlocked ? 'text-success' : 'text-amber-400'
                    }`}
                  >
                    {selected.unlocked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {selected.unlocked ? 'Unlocked preview' : 'Locked preview'}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-400">{selected.purpose}</p>

              <div className="mt-4 flex items-center gap-2">
                <Badge variant="demo">Level {selected.level} (demo)</Badge>
                <Badge variant="warning">Preview</Badge>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-accent" /> Future upgrades
                </p>
                <ul className="space-y-2">
                  {selected.upgrades.map((u) => (
                    <li
                      key={u}
                      className="flex items-center justify-between rounded-lg border border-gray-800/60 bg-gray-900/30 px-3 py-2"
                    >
                      <span className="text-xs text-gray-300 truncate">{u}</span>
                      <Lock className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                    </li>
                  ))}
                </ul>
              </div>

              <p className="mt-auto pt-4 text-[10px] text-gray-500">
                Ownership, levels, unlocks and upgrades are DEMO previews — not real.
              </p>
            </Card>
          </div>
        </div>
      )}

      {tab === 'buildings' && (
        <div className="space-y-4" role="tabpanel">
          <p className="text-xs text-gray-500">
            {unlockedCount} of {BUILDINGS.length} buildings unlocked (DEMO).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {BUILDINGS.map((b) => {
              const isSelected = b.id === selectedId
              return (
                <Card
                  key={b.id}
                  padding="none"
                  className={`relative overflow-hidden border flex flex-col transition-colors ${
                    isSelected ? 'border-primary/50' : 'border-gray-800/60'
                  }`}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `radial-gradient(120px 80px at 80% 0%, ${b.accent}22, transparent)`
                    }}
                  />
                  <div className="relative z-10 p-4 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className="p-2 rounded-lg bg-gray-800/60">
                        <b.Icon className="h-5 w-5 text-primary" />
                      </span>
                      <Badge variant={b.unlocked ? 'success' : 'warning'}>
                        {b.unlocked ? 'Unlocked' : 'Locked'}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-white">{b.name}</h3>
                    <p className="mt-1 text-xs text-gray-400">{b.purpose}</p>

                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="demo">Level {b.level} (demo)</Badge>
                    </div>

                    <ul className="mt-3 space-y-1.5">
                      {b.upgrades.map((u) => (
                        <li key={u} className="flex items-center gap-2 text-[11px] text-gray-400">
                          <Lock className="h-3 w-3 text-gray-500 shrink-0" /> {u}
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() => selectBuilding(b.id, true)}
                      className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-gray-800/60"
                    >
                      Inspect <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'production' && (
        <div className="space-y-4" role="tabpanel">
          <Card padding="sm" className="border border-success/30 bg-success/5">
            <p className="text-xs text-success/90">
              Compact previews only — no real timers, no earnings accrual.
            </p>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DEMO_PRODUCTION_CYCLES.map((cycle) => (
              <Card key={cycle.id} padding="sm" className="border border-gray-800/60">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <h3 className="text-sm font-semibold text-white truncate">{cycle.name}</h3>
                  <Badge variant={cycle.active ? 'success' : 'default'}>
                    {cycle.active ? 'Running' : 'Idle'}
                  </Badge>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-800/70 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    style={{ width: `${cycle.progress}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-500">
                  <span>{cycle.progress}%</span>
                  <span>4h cycle · DEMO</span>
                </div>
              </Card>
            ))}
          </div>
          <p className="text-[10px] text-gray-500">
            Production rewards are simulated in-game values — not money, not withdrawable.
          </p>
        </div>
      )}
    </div>
  )
}
