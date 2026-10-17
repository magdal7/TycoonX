import { useState } from 'react'
import {
  Sparkles,
  CalendarDays,
  Flag,
  Trophy,
  Target,
  CheckCircle,
  Zap,
  TrendingUp
} from 'lucide-react'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'

type Tab = 'daily' | 'weekly' | 'achievements'

interface Mission {
  id: string
  title: string
  desc: string
  sp: number
  xp: number
  progress: number
  target: number
}

const MISSIONS: Record<Tab, Mission[]> = {
  daily: [
    { id: 'd1', title: 'Log in today', desc: 'Check in to your command center', sp: 50, xp: 20, progress: 1, target: 1 },
    { id: 'd2', title: 'Hire your first CEO', desc: 'Recruit an executive from the market', sp: 100, xp: 40, progress: 0, target: 1 },
    { id: 'd3', title: 'Complete a production cycle', desc: 'Finish one 4-hour cycle', sp: 150, xp: 60, progress: 1, target: 2 }
  ],
  weekly: [
    { id: 'w1', title: 'Expand your empire', desc: 'Unlock 2 buildings', sp: 400, xp: 150, progress: 1, target: 2 },
    { id: 'w2', title: 'Executive roster', desc: 'Review 5 executives', sp: 300, xp: 120, progress: 3, target: 5 },
    { id: 'w3', title: 'Production streak', desc: 'Keep cycles running 3 days', sp: 600, xp: 250, progress: 2, target: 3 }
  ],
  achievements: [
    { id: 'a1', title: 'First Steps', desc: 'Sign in for the first time', sp: 100, xp: 50, progress: 1, target: 1 },
    { id: 'a2', title: 'Market Scout', desc: 'Browse the CEO market', sp: 150, xp: 60, progress: 1, target: 1 },
    { id: 'a3', title: 'Tower Builder', desc: 'Reach Empire level 5', sp: 500, xp: 200, progress: 3, target: 5 },
    { id: 'a4', title: 'Serial Founder', desc: 'Own 10 executives', sp: 1000, xp: 400, progress: 0, target: 10 }
  ]
}

const TAB_META: Record<Tab, { label: string; blurb: string; Icon: React.ComponentType<{ className?: string }> }> = {
  daily: { label: 'Daily', blurb: 'Resets every day (demo)', Icon: CalendarDays },
  weekly: { label: 'Weekly', blurb: 'Bigger goals for the week (demo)', Icon: Flag },
  achievements: { label: 'Achievements', blurb: 'Milestones of your journey (demo)', Icon: Trophy }
}

function MissionCard({ mission }: { mission: Mission }) {
  const done = mission.progress >= mission.target
  const pct = Math.min(100, Math.round((mission.progress / mission.target) * 100))
  return (
    <Card padding="sm" className={`border ${done ? 'border-success/30 bg-success/5' : 'border-gray-800/60'}`}>
      <div className="flex items-start gap-3">
        <span className="p-2 rounded-lg bg-gray-800/60 shrink-0">
          {done ? (
            <CheckCircle className="h-4 w-4 text-success" />
          ) : (
            <Target className="h-4 w-4 text-primary" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className={`text-sm font-semibold truncate ${done ? 'text-gray-400 line-through' : 'text-white'}`}>
              {mission.title}
            </h3>
            <Badge variant={done ? 'success' : 'default'}>{done ? 'Completed' : 'In progress'}</Badge>
          </div>
          <p className="text-[11px] text-gray-400 truncate">{mission.desc}</p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-gray-800/70 overflow-hidden">
            <div
              className={`h-full rounded-full ${done ? 'bg-success' : 'bg-gradient-to-r from-primary to-accent'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
            <span>
              {Math.min(mission.progress, mission.target)}/{mission.target}
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-accent">
                <Zap className="h-3 w-3" />+{mission.sp} SP
              </span>
              <span className="inline-flex items-center gap-1 text-primary">
                <TrendingUp className="h-3 w-3" />+{mission.xp} XP
              </span>
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function Tasks() {
  const [tab, setTab] = useState<Tab>('daily')
  const missions = MISSIONS[tab]
  const completed = missions.filter((m) => m.progress >= m.target).length
  const totalSp = missions.reduce((s, m) => s + m.sp, 0)
  const totalXp = missions.reduce((s, m) => s + m.xp, 0)
  const pct = Math.round((completed / missions.length) * 100)
  const meta = TAB_META[tab]

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary font-semibold">
            <Sparkles className="h-3 w-3" /> Missions Center
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-gray-400">{meta.blurb}</p>
        </div>
        <Badge variant="demo">DEMO / PREVIEW</Badge>
      </header>

      <div role="tablist" aria-label="Mission categories" className="flex flex-wrap gap-2">
        {(Object.keys(TAB_META) as Tab[]).map((id) => {
          const TabIcon = TAB_META[id].Icon
          const active = tab === id
          return (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary/10 text-primary border border-primary/40'
                  : 'text-gray-300 border border-gray-800/60 hover:bg-gray-800/50'
              }`}
            >
              <TabIcon className="h-4 w-4" />
              {TAB_META[id].label}
            </button>
          )
        })}
      </div>

      <Card padding="md" className="border border-gray-800/60">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold">{meta.label} progress</h2>
            <p className="text-xs text-gray-400">
              {completed} of {missions.length} completed
            </p>
          </div>
          <span className="text-lg font-bold text-success">{pct}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-gray-800/70 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-success to-primary"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: 'Completed', value: completed, color: 'text-success' },
            { label: 'SP pool', value: totalSp, color: 'text-accent' },
            { label: 'XP pool', value: totalXp, color: 'text-primary' }
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-gray-800/60 bg-gray-900/30 p-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">{s.label}</p>
              <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <section className="space-y-3" role="tabpanel">
        {missions.map((m) => (
          <MissionCard key={m.id} mission={m} />
        ))}
      </section>

      <p className="text-[10px] text-gray-500">
        Missions, XP and SP are simulated previews — no real completion or reward logic.
      </p>
    </div>
  )
}
