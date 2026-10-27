import { useState } from 'react'
import { Gift, Clock, CheckCircle2, AlertTriangle, Sparkles, ExternalLink, RefreshCw } from 'lucide-react'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { EmptyState, SectionHeading, Skeleton } from './ui/kit'
import { useApi } from '../lib/useApi'
import { notifyResourcesChanged } from '../lib/resources'
import { formatDate } from '../lib/format'
import { useI18n, type TranslationKey } from '../i18n'
import {
  claimSpecialTaskReward,
  fetchSpecialTasks,
  submitSpecialTask,
  type PlayerSpecialTask,
  type PlayerSpecialTaskState
} from '../lib/game'

const STATE_VARIANT: Record<PlayerSpecialTaskState, 'default' | 'demo' | 'success' | 'warning'> = {
  AVAILABLE: 'demo',
  PENDING: 'warning',
  APPROVED: 'success',
  COMPLETED: 'success',
  REJECTED: 'warning',
  EXPIRED: 'default',
  INELIGIBLE: 'default',
  FULL: 'default'
}

function rewards(task: PlayerSpecialTask): string {
  const parts: string[] = []
  if (task.rewardXp > 0) parts.push(`+${task.rewardXp} XP`)
  if (Number(task.rewardBonusSp) > 0) parts.push(`+${task.rewardBonusSp} Bonus SP`)
  return parts.join(' · ')
}

function TaskCard({ task, onChanged }: { task: PlayerSpecialTask; onChanged: () => void }) {
  const t = useI18n().t
  const [proofText, setProofText] = useState('')
  const [proofUrl, setProofUrl] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const stateLabel = t(`specialState.${task.state}` as TranslationKey)
  const rewardText = rewards(task) || t('special.noReward')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!proofText.trim() && !proofUrl.trim()) {
      setError(t('special.needProof'))
      return
    }
    setBusy(true)
    setError('')
    try {
      await submitSpecialTask(task.id, {
        ...(proofText.trim() ? { proofText: proofText.trim() } : {}),
        ...(proofUrl.trim() ? { proofUrl: proofUrl.trim() } : {})
      })
      setProofText('')
      setProofUrl('')
      setOpen(false)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('special.submissionFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function claim() {
    if (!task.submissionId) return
    setBusy(true)
    setError('')
    try {
      await claimSpecialTaskReward(task.submissionId)
      notifyResourcesChanged()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('special.claimFailed'))
    } finally {
      setBusy(false)
    }
  }

  const canRetry = task.state === 'REJECTED' && task.attemptsUsed < task.maxAttempts

  return (
    <Card padding="md" hover={false} className="border border-line">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATE_VARIANT[task.state]}>{stateLabel}</Badge>
            {task.expiresAt && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted">
                <Clock className="h-3 w-3" /> {t('special.ends', { date: formatDate(task.expiresAt) })}
              </span>
            )}
          </div>
          <h3 className="mt-1.5 truncate text-sm font-bold text-white">{task.title}</h3>
          <p className="mt-0.5 text-xs text-muted">{task.description}</p>
          <p className="mt-1 text-[11px] font-semibold text-primary">{rewardText}</p>
          {task.link && (
            <a href={task.link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent underline">
              {t('special.openLink')} <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {task.proofInstructions && <p className="mt-1 text-[10px] text-muted">{t('special.proofLabel')}: {task.proofInstructions}</p>}
          {task.state === 'INELIGIBLE' && <p className="mt-1 text-[10px] text-muted">{t('special.requiresLevel', { level: task.minLevel })}</p>}
          {task.state === 'REJECTED' && task.reviewNote && <p className="mt-1 text-[10px] text-amber-400">{t('special.reviewer', { note: task.reviewNote })}</p>}
          {task.state === 'REJECTED' && (
            <p className="mt-1 text-[10px] text-muted">{t('special.attempt', { used: task.attemptsUsed, max: task.maxAttempts })}{canRetry ? t('special.resubmitNote') : t('special.noAttempts')}</p>
          )}
          {error && <p className="mt-1 text-[10px] text-red-300">{error}</p>}
        </div>

        <div className="shrink-0">
          {task.state === 'APPROVED' && (
            <Button size="sm" variant="success" isLoading={busy} onClick={claim} iconLeft={<Gift className="h-4 w-4" />}>{t('special.claim')}</Button>
          )}
          {task.state === 'COMPLETED' && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> {t('common.done')}</span>
          )}
          {task.state === 'PENDING' && <span className="text-xs text-muted">{t('special.underReview')}</span>}
          {(task.state === 'AVAILABLE' || canRetry) && (
            <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)} iconLeft={canRetry ? <RefreshCw className="h-4 w-4" /> : undefined}>
              {canRetry ? t('special.resubmit') : t('special.submit')}
            </Button>
          )}
        </div>
      </div>

      {open && (task.state === 'AVAILABLE' || canRetry) && (
        <form onSubmit={submit} className="mt-3 space-y-2 border-t border-line pt-3">
          <Input value={proofText} onChange={(e) => setProofText(e.target.value)} placeholder={t('special.proofText')} maxLength={2000} className="text-xs" />
          <Input value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} type="url" placeholder={t('special.proofUrl')} className="text-xs" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" isLoading={busy} iconLeft={<Sparkles className="h-4 w-4" />}>{t('special.submitProof')}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          </div>
        </form>
      )}
    </Card>
  )
}

export function SpecialTasksPanel() {
  const t = useI18n().t
  const { data, loading, error, reload } = useApi(() => fetchSpecialTasks(), [])

  return (
    <section className="space-y-3">
      <SectionHeading eyebrow={t('special.eyebrow')} title={t('special.title')} description={t('special.description')} />
      {loading ? (
        <Skeleton className="h-24" />
      ) : error ? (
        <EmptyState Icon={AlertTriangle} title={t('special.error')} description={error} action={<Button size="sm" variant="outline" onClick={reload}>{t('common.retry')}</Button>} />
      ) : !data || data.length === 0 ? (
        <EmptyState Icon={Gift} title={t('special.empty.title')} description={t('special.empty.body')} />
      ) : (
        <div className="space-y-2">
          {data.map((task) => (
            <TaskCard key={task.id} task={task} onChanged={reload} />
          ))}
        </div>
      )}
    </section>
  )
}
