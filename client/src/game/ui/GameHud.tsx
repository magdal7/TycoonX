import { Activity, Zap, TrendingUp, Sparkles, LayoutDashboard } from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { DEMO_PLAYER } from '../../data/demo'

export default function GameHud({ onClassic }: { onClassic: () => void }) {
  const xpPct = Math.round((DEMO_PLAYER.xp / DEMO_PLAYER.xpToNext) * 100)

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-800/60 bg-gray-900/40 px-3 py-2">
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
        <Activity className="h-3.5 w-3.5" /> Lv {DEMO_PLAYER.level}
      </span>
      <div className="flex min-w-[120px] flex-1 items-center gap-2">
        <TrendingUp className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800/70">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${xpPct}%` }} />
        </div>
        <span className="shrink-0 text-[10px] text-gray-400">
          {DEMO_PLAYER.xp}/{DEMO_PLAYER.xpToNext}
        </span>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-800/70 bg-gray-900/40 px-2 py-1 text-xs text-gray-300">
        <Zap className="h-3.5 w-3.5 text-success" /> {DEMO_PLAYER.energy}/{DEMO_PLAYER.maxEnergy}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-800/70 bg-gray-900/40 px-2 py-1 text-xs text-gray-300">
        <Sparkles className="h-3.5 w-3.5 text-accent" /> 0 SP
      </span>
      <Badge variant="demo">PREVIEW</Badge>
      <button
        type="button"
        onClick={onClassic}
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-800/70 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-800/60"
      >
        <LayoutDashboard className="h-3.5 w-3.5" /> Classic view
      </button>
    </div>
  )
}
