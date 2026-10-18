import { useState } from 'react'
import { Sparkles, Award, AlertTriangle, RefreshCw, CheckCircle2, Lock } from 'lucide-react'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Progress, SectionHeading, EmptyState, CardSkeleton } from '../components/ui/kit'
import { useApi } from '../lib/useApi'
import { claimAchievement, fetchAchievements, type AchievementStage } from '../lib/game'
import { formatNumber } from '../lib/format'

const STAGE_TONE: Record<string, string> = {
  BRONZE: 'text-amber-600 border-amber-600/40 bg-amber-600/10',
  SILVER: 'text-slate-300 border-slate-300/40 bg-slate-300/10',
  GOLD: 'text-gold border-gold/40 bg-gold/10',
  DIAMOND: 'text-cyan-300 border-cyan-300/40 bg-cyan-300/10'
}

function StageChip({ stage, onClick, busy }: { stage: AchievementStage; onClick: () => void; busy: boolean }) {
  const tone = STAGE_TONE[stage.stage] ?? 'text-muted border-line bg-white/5'
  return (
    <button
      type="button"
      disabled={!stage.achieved || stage.claimed || busy}
      onClick={onClick}
      className={`flex-1 rounded-lg border px-2 py-2 text-left transition-colors ${tone} ${
        stage.achieved && !stage.claimed ? 'hover:brightness-125' : ''
      } ${!stage.achieved ? 'opacity-50' : ''}`}
      title={`${stage.stage} · ${formatNumber(stage.threshold)} · +${stage.xp} XP`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide">{stage.stage}</span>
        {stage.claimed ? <CheckCircle2 className="h-3.5 w-3.5" /> : !stage.achieved ? <Lock className="h-3.5 w-3.5" /> : <Award className="h-3.5 w-3.5" />}
      </div>
      <div className="mt-0.5 text-[10px] text-muted">{formatNumber(stage.threshold)} · +{stage.xp} XP</div>
    </button>
  )
}

export default function Achievements() {
  const { data, loading, error, reload } = useApi(() => fetchAchievements(), [])
  const [busy, setBusy] = useState(false)

  async function claim(trackKey: string, stage: string) {
    setBusy(true)
    try {
      await claimAchievement(trackKey, stage)
      reload()
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading eyebrow="Trophies" title="Achievements" description="Permanent, cumulative milestones. Rewards are XP only." right={<Sparkles className="h-5 w-5 text-accent" />} />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : error ? (
        <EmptyState Icon={AlertTriangle} title="Could not load achievements" description={error} action={<Button size="sm" variant="outline" onClick={reload}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(data ?? []).map((track) => (
            <Card key={track.key} padding="md" className="border-line">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">{track.title}</h3>
                <span className="text-xs font-bold text-primary">{formatNumber(track.value)}</span>
              </div>
              <Progress className="mt-2" value={track.value} max={track.stages[3]?.threshold || 1} tone="accent" />
              <div className="mt-3 flex gap-1.5">
                {track.stages.map((s) => (
                  <StageChip key={s.stage} stage={s} busy={busy} onClick={() => claim(track.key, s.stage)} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
