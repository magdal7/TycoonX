import { Activity, Sparkles, TrendingUp, LayoutDashboard } from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { useResources } from '../../lib/resources'
import { formatNumber } from '../../lib/format'
import { useT } from '../../i18n'

export default function GameHud({ onEmpire }: { onEmpire: () => void }) {
  const t = useT()
  const resources = useResources()
  const progress = resources.data?.progress
  const sp = resources.data?.sp
  const xpPct = progress ? Math.round((progress.intoLevel / (progress.toNext || 1)) * 100) : 0

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface-2/60 px-3 py-2 backdrop-blur">
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
        <Activity className="h-3.5 w-3.5" /> {t('game.hud.level', { level: progress?.level ?? 1 })}
      </span>
      <div className="flex min-w-[120px] flex-1 items-center gap-2">
        <TrendingUp className="h-3.5 w-3.5 shrink-0 text-muted" />
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${xpPct}%` }} />
        </div>
        <span className="shrink-0 text-[10px] text-muted">
          {progress ? `${formatNumber(progress.intoLevel)}/${formatNumber(progress.toNext)}` : '—'}
        </span>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2/60 px-2 py-1 text-xs text-muted">
        <Sparkles className="h-3.5 w-3.5 text-gold" /> {sp ? formatNumber(sp.totalSp) : '—'} SP
      </span>
      <Badge variant="demo">{t('game.hud.mapPreview')}</Badge>
      <button
        type="button"
        onClick={onEmpire}
        className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-xs text-muted transition-colors hover:bg-white/5 hover:text-white"
      >
        <LayoutDashboard className="h-3.5 w-3.5" /> {t('nav.empire')}
      </button>
    </div>
  )
}
