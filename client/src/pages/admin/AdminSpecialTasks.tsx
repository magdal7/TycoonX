import { useState } from 'react'
import { AlertTriangle, Plus, RefreshCw, Pencil, Archive, Play, Pause, Clock, CheckCircle2, XCircle, ClipboardList } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { SectionHeading, EmptyState, Skeleton } from '../../components/ui/kit'
import { useApi } from '../../lib/useApi'
import {
  applyAdminTaskAction,
  createAdminTask,
  fetchAdminSubmissions,
  fetchAdminTasks,
  reviewAdminSubmission,
  updateAdminTask,
  type AdminSubmission,
  type AdminTask,
  type AdminTaskInput,
  type SpecialTaskAction,
  type SpecialTaskStatus
} from '../../lib/admin'

type Notice = { kind: 'success' | 'error'; text: string } | null

const STATUS_VARIANT: Record<SpecialTaskStatus, 'default' | 'demo' | 'success' | 'warning'> = {
  DRAFT: 'default',
  PUBLISHED: 'success',
  PAUSED: 'warning',
  EXPIRED: 'default',
  ARCHIVED: 'default'
}

const EMPTY_FORM = {
  title: '',
  description: '',
  link: '',
  proofInstructions: '',
  rewardXp: '0',
  rewardBonusSp: '0',
  verification: 'MANUAL' as 'MANUAL' | 'AUTO',
  minLevel: '1',
  maxCompletions: '',
  startsAt: '',
  expiresAt: '',
  confirmHighReward: false
}
type FormState = typeof EMPTY_FORM

function toInput(f: FormState): AdminTaskInput {
  return {
    title: f.title.trim(),
    description: f.description.trim(),
    link: f.link.trim() || null,
    proofInstructions: f.proofInstructions.trim() || null,
    rewardXp: Number(f.rewardXp) || 0,
    rewardBonusSp: Number(f.rewardBonusSp) || 0,
    verification: f.verification,
    minLevel: Number(f.minLevel) || 1,
    maxCompletions: f.maxCompletions ? Number(f.maxCompletions) : null,
    startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null,
    expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : null,
    confirmHighReward: f.confirmHighReward
  }
}

function fromTask(t: AdminTask): FormState {
  return {
    title: t.title,
    description: t.description,
    link: t.link ?? '',
    proofInstructions: t.proofInstructions ?? '',
    rewardXp: String(t.rewardXp),
    rewardBonusSp: t.rewardBonusSp,
    verification: t.verification,
    minLevel: String(t.minLevel),
    maxCompletions: t.maxCompletions ? String(t.maxCompletions) : '',
    startsAt: t.startsAt ? t.startsAt.slice(0, 16) : '',
    expiresAt: t.expiresAt ? t.expiresAt.slice(0, 16) : '',
    confirmHighReward: false
  }
}

const selectClass =
  'w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors'

export default function AdminSpecialTasks() {
  const tasks = useApi(() => fetchAdminTasks(), [])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AdminTask | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
    setNotice(null)
  }
  function openEdit(t: AdminTask) {
    setEditing(t)
    setForm(fromTask(t))
    setShowForm(true)
    setNotice(null)
  }
  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setNotice(null)
    try {
      const input = toInput(form)
      if (editing) await updateAdminTask(editing.id, input)
      else await createAdminTask(input)
      setShowForm(false)
      setNotice({ kind: 'success', text: editing ? 'Campaign updated' : 'Campaign created' })
      tasks.reload()
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  async function act(t: AdminTask, action: SpecialTaskAction) {
    setNotice(null)
    try {
      await applyAdminTaskAction(t.id, action)
      tasks.reload()
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Action failed' })
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading
        eyebrow="Admin"
        title="Special Tasks"
        description="Create and manage time-boxed special campaigns and review player submissions."
        right={
          <Button size="sm" variant="outline" onClick={openCreate} iconLeft={<Plus className="h-4 w-4" />}>
            New campaign
          </Button>
        }
      />

      {notice && (
        <div
          className={`rounded-xl border px-3 py-2 text-xs ${
            notice.kind === 'success' ? 'border-success/30 bg-success/10 text-success' : 'border-red-500/30 bg-red-900/20 text-red-300'
          }`}
        >
          {notice.text}
        </div>
      )}

      {showForm && (
        <Card padding="lg" hover={false}>
          <h2 className="text-sm font-bold">{editing ? `Edit: ${editing.title}` : 'New campaign'}</h2>
          <form onSubmit={save} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-gray-300">Title</label>
                <Input value={form.title} onChange={(e) => set('title', e.target.value)} required minLength={3} maxLength={120} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-300">Link (optional)</label>
                <Input value={form.link} onChange={(e) => set('link', e.target.value)} type="url" placeholder="https://..." className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-300">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                required
                maxLength={2000}
                rows={3}
                className="mt-1 w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-300">Proof instructions (optional)</label>
              <textarea
                value={form.proofInstructions}
                onChange={(e) => set('proofInstructions', e.target.value)}
                maxLength={2000}
                rows={2}
                className="mt-1 w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-medium text-gray-300">Reward XP</label>
                <Input type="number" min={0} value={form.rewardXp} onChange={(e) => set('rewardXp', e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-300">Reward Bonus SP</label>
                <Input type="number" min={0} value={form.rewardBonusSp} onChange={(e) => set('rewardBonusSp', e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-300">Verification</label>
                <select value={form.verification} onChange={(e) => set('verification', e.target.value as 'MANUAL' | 'AUTO')} className={`${selectClass} mt-1`}>
                  <option value="MANUAL">Manual review</option>
                  <option value="AUTO">Auto-approve (internal)</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-medium text-gray-300">Minimum level</label>
                <Input type="number" min={1} max={50} value={form.minLevel} onChange={(e) => set('minLevel', e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-300">Max completions (optional)</label>
                <Input type="number" min={1} value={form.maxCompletions} onChange={(e) => set('maxCompletions', e.target.value)} placeholder="Unlimited" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-300">Expires at (optional)</label>
                <Input type="datetime-local" value={form.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-gray-300">Starts at (optional)</label>
                <Input type="datetime-local" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} className="mt-1" />
              </div>
              <label className="mt-6 flex items-center gap-2 text-xs text-gray-300">
                <input type="checkbox" checked={form.confirmHighReward} onChange={(e) => set('confirmHighReward', e.target.checked)} className="h-4 w-4 rounded border-gray-600 bg-gray-800/50 text-primary" />
                Confirm if this reward is unusually high (&gt; 5,000)
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" isLoading={saving}>{editing ? 'Save changes' : 'Create campaign'}</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {tasks.loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : tasks.error ? (
        <EmptyState Icon={AlertTriangle} title="Could not load campaigns" description={tasks.error} action={<Button size="sm" variant="outline" onClick={tasks.reload}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>} />
      ) : !tasks.data || tasks.data.length === 0 ? (
        <EmptyState Icon={ClipboardList} title="No campaigns yet" description="Create your first special task campaign." action={<Button size="sm" onClick={openCreate}>New campaign</Button>} />
      ) : (
        <div className="space-y-3">
          {tasks.data.map((t) => (
            <Card key={t.id} padding="md" hover={false}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[t.status]}>{t.status}</Badge>
                    <span className="text-[10px] text-muted">{t.verification === 'AUTO' ? 'Auto' : 'Manual'}</span>
                  </div>
                  <h3 className="mt-1.5 truncate text-sm font-bold">{t.title}</h3>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{t.description}</p>
                  <p className="mt-1 text-[10px] text-muted">
                    +{t.rewardXp} XP · +{t.rewardBonusSp} Bonus SP · min L{t.minLevel} ·{' '}
                    {t.completionsCount}{t.maxCompletions ? `/${t.maxCompletions}` : ''} reserved · {t.submissionCount} submissions
                    {t.expiresAt ? ` · expires ${new Date(t.expiresAt).toLocaleString()}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(t)} iconLeft={<Pencil className="h-3.5 w-3.5" />}>Edit</Button>
                  {(t.status === 'DRAFT' || t.status === 'PAUSED') && (
                    <Button size="sm" variant="success" onClick={() => act(t, 'publish')} iconLeft={<Play className="h-3.5 w-3.5" />}>Publish</Button>
                  )}
                  {t.status === 'PUBLISHED' && (
                    <Button size="sm" variant="outline" onClick={() => act(t, 'pause')} iconLeft={<Pause className="h-3.5 w-3.5" />}>Pause</Button>
                  )}
                  {(t.status === 'PUBLISHED' || t.status === 'PAUSED') && (
                    <Button size="sm" variant="ghost" onClick={() => act(t, 'expire')} iconLeft={<Clock className="h-3.5 w-3.5" />}>Expire</Button>
                  )}
                  {t.status !== 'ARCHIVED' && (
                    <Button size="sm" variant="ghost" onClick={() => act(t, 'archive')} iconLeft={<Archive className="h-3.5 w-3.5" />}>Archive</Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SubmissionsPanel />
    </div>
  )
}

function SubmissionsPanel() {
  const submissions = useApi(() => fetchAdminSubmissions({ status: 'PENDING' }), [])
  const [busyId, setBusyId] = useState<number | null>(null)
  const [note, setNote] = useState('')

  async function review(s: AdminSubmission, decision: 'APPROVE' | 'REJECT') {
    setBusyId(s.id)
    try {
      await reviewAdminSubmission(s.id, decision, note.trim() || undefined)
      setNote('')
      submissions.reload()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Pending submissions</h2>
        <Button size="sm" variant="ghost" onClick={submissions.reload} iconLeft={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button>
      </div>
      {submissions.loading ? (
        <Skeleton className="h-20" />
      ) : submissions.error ? (
        <EmptyState Icon={AlertTriangle} title="Could not load submissions" description={submissions.error} />
      ) : !submissions.data || submissions.data.length === 0 ? (
        <EmptyState Icon={CheckCircle2} title="No pending submissions" description="Everything is reviewed." />
      ) : (
        <div className="space-y-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional review note (applied to the next decision)" className="text-xs" />
          {submissions.data.map((s) => (
            <Card key={s.id} padding="md" hover={false}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{s.username} · <span className="text-muted">{s.taskTitle}</span></p>
                  <p className="mt-1 text-[10px] text-muted">attempt {s.attempt} · +{s.rewardXpSnap} XP · +{s.rewardBonusSpSnap} Bonus SP · {new Date(s.createdAt).toLocaleString()}</p>
                  {s.proofUrl && <a href={s.proofUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs text-accent underline">{s.proofUrl}</a>}
                  {s.proofText && <p className="mt-1 whitespace-pre-wrap text-xs text-gray-300">{s.proofText}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="success" isLoading={busyId === s.id} onClick={() => review(s, 'APPROVE')} iconLeft={<CheckCircle2 className="h-3.5 w-3.5" />}>Approve</Button>
                  <Button size="sm" variant="danger" disabled={busyId === s.id} onClick={() => review(s, 'REJECT')} iconLeft={<XCircle className="h-3.5 w-3.5" />}>Reject</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
