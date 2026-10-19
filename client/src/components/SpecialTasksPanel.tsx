import { useState } from 'react'
import { Gift, Clock, CheckCircle2, AlertTriangle, Sparkles, ExternalLink, RefreshCw } from 'lucide-react'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { EmptyState, SectionHeading, Skeleton } from './ui/kit'
import { useApi } from '../lib/useApi'
import { notifyResourcesChanged } from '../lib/resources'
import {
  claimSpecialTaskReward,
  fetchSpecialTasks,
  submitSpecialTask,
  type PlayerSpecialTask,
  type PlayerSpecialTaskState
} from '../lib/game'

const STATE_META: Record<PlayerSpecialTaskState, { label: string; variant: 'default' | 'demo' | 'success' | 'warning' }> = {
  AVAILABLE: { label: 'Available', variant: 'demo' },
  PENDING: { label: 'Pending review', variant: 'warning' },
  APPROVED: { label: 'Ready to claim', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'warning' },
  EXPIRED: { label: 'Expired', variant: 'default' },
  INELIGIBLE: { label: 'Locked', variant: 'default' },
  FULL: { label: 'Full', variant: 'default' }
}

function rewards(task: PlayerSpecialTask): string {
  const parts: string[] = []
  if (task.rewardXp > 0) parts.push(`+${task.rewardXp} XP`)
  if (Number(task.rewardBonusSp) > 0) parts.push(`+${task.rewardBonusSp} Bonus SP`)
  return parts.join(' · ') || 'No reward'
}

function TaskCard({ task, onChanged }: { task: PlayerSpecialTask; onChanged: () => void }) {
  const [proofText, setProofText] = useState('')
  const [proofUrl, setProofUrl] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const meta = STATE_META[task.state]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!proofText.trim() && !proofUrl.trim()) {
      setError('Provide proof text or a link.')
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
      setError(err instanceof Error ? err.message : 'Submission failed')
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
      setError(err instanceof Error ? err.message : 'Claim failed')
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
            <Badge variant={meta.variant}>{meta.label}</Badge>
            {task.expiresAt && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted">
                <Clock className="h-3 w-3" /> ends {new Date(task.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <h3 className="mt-1.5 truncate text-sm font-bold text-white">{task.title}</h3>
          <p className="mt-0.5 text-xs text-muted">{task.description}</p>
          <p className="mt-1 text-[11px] font-semibold text-primary">{rewards(task)}</p>
          {task.link && (
            <a href={task.link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent underline">
              Open link <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {task.proofInstructions && <p className="mt-1 text-[10px] text-muted">Proof: {task.proofInstructions}</p>}
          {task.state === 'INELIGIBLE' && <p className="mt-1 text-[10px] text-muted">Requires level {task.minLevel}.</p>}
          {task.state === 'REJECTED' && task.reviewNote && <p className="mt-1 text-[10px] text-amber-400">Reviewer: {task.reviewNote}</p>}
          {task.state === 'REJECTED' && (
            <p className="mt-1 text-[10px] text-muted">Attempt {task.attemptsUsed} of {task.maxAttempts}{canRetry ? ' · you can resubmit' : ' · no attempts left'}</p>
          )}
          {error && <p className="mt-1 text-[10px] text-red-300">{error}</p>}
        </div>

        <div className="shrink-0">
          {task.state === 'APPROVED' && (
            <Button size="sm" variant="success" isLoading={busy} onClick={claim} iconLeft={<Gift className="h-4 w-4" />}>Claim</Button>
          )}
          {task.state === 'COMPLETED' && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Done</span>
          )}
          {task.state === 'PENDING' && <span className="text-xs text-muted">Under review</span>}
          {(task.state === 'AVAILABLE' || canRetry) && (
            <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)} iconLeft={canRetry ? <RefreshCw className="h-4 w-4" /> : undefined}>
              {canRetry ? 'Resubmit' : 'Submit'}
            </Button>
          )}
        </div>
      </div>

      {open && (task.state === 'AVAILABLE' || canRetry) && (
        <form onSubmit={submit} className="mt-3 space-y-2 border-t border-line pt-3">
          <Input value={proofText} onChange={(e) => setProofText(e.target.value)} placeholder="Proof details (optional if link provided)" maxLength={2000} className="text-xs" />
          <Input value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} type="url" placeholder="Proof link (optional if text provided)" className="text-xs" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" isLoading={busy} iconLeft={<Sparkles className="h-4 w-4" />}>Submit proof</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </Card>
  )
}

export function SpecialTasksPanel() {
  const { data, loading, error, reload } = useApi(() => fetchSpecialTasks(), [])

  return (
    <section className="space-y-3">
      <SectionHeading eyebrow="Special" title="Special Tasks" description="Time-boxed campaigns with reviewable rewards." />
      {loading ? (
        <Skeleton className="h-24" />
      ) : error ? (
        <EmptyState Icon={AlertTriangle} title="Could not load special tasks" description={error} action={<Button size="sm" variant="outline" onClick={reload}>Retry</Button>} />
      ) : !data || data.length === 0 ? (
        <EmptyState Icon={Gift} title="No special tasks right now" description="Check back soon for campaigns." />
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
