import { useState } from 'react'
import { Sparkles, Award, AlertTriangle, RefreshCw, CheckCircle2, Lock } from 'lucide-react'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Progress, SectionHeading, EmptyState, CardSkeleton } from '../components/ui/kit'
import { useApi } from '../lib/useApi'
import { claimAchievement, fetchAchievements, type AchievementStage } from '../lib/game'
import { formatNumber } from '../lib/format'
import { useT } from '../i18n'

const STAGE_TONE: Record<string, string> = {
  BRONZE: 'text-amber-600 border-amber-600/40 bg-amber-600/10',
  SILVER: 'text-slate-300 border-slate-300/40 bg-slate-300/10',
  GOLD: 'text-gold border-gold/40 bg-gold/10',
  DIAMOND: 'text-cyan-300 border-cyan-300/40 bg-cyan-300/10'
}

function StageChip({ stage, onClick, busy }: { stage: AchievementStage; onClick: () => void; busy: boolean }) {
  const t = useT()
  const tone = STAGE_TONE[stage.stage] ?? 'text-muted border-line bg-white/5'
  return (
    <button
      type="button"
      disabled={!stage.achieved || stage.claimed || busy}
      onClick={onClick}
      className={`flex-1 rounded-lg border px-2 py-2 text-start transition-colors ${tone} ${
        stage.achieved && !stage.claimed ? 'hover:brightness-125' : ''
      } ${!stage.achieved ? 'opacity-50' : ''}`}
      title={t('achievements.stageTitle', { stage: stage.stage, threshold: formatNumber(stage.threshold), xp: stage.xp })}
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
  const t = useT()
  const { data, loading, error, reload } = useApi(() => fetchAchievements(), [])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const claimable = (data ?? []).flatMap((track) => track.stages).filter((s) => s.achieved && !s.claimed).length

  async function claim(trackKey: string, stage: string) {
    setBusy(true)
    setNotice('')
    try {
      await claimAchievement(trackKey, stage)
      reload()
    } catch {
      setNotice(t('achievements.couldNotClaim'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading
        eyebrow={t('achievements.eyebrow')}
        title={t('achievements.title')}
        description={t('achievements.description')}
        right={
          <div className="flex items-center gap-2">
            {claimable > 0 && <Badge variant="success">{t('achievements.ready', { count: claimable })}</Badge>}
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
        }
      />

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-red-300">
          <AlertTriangle className="h-4 w-4" /> {notice}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : error ? (
        <EmptyState Icon={AlertTriangle} title={t('achievements.error')} description={error} action={<Button size="sm" variant="outline" onClick={reload}><RefreshCw className="me-2 h-4 w-4" />{t('common.retry')}</Button>} />
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
