import { useEffect, useState } from 'react'
import { Target, CheckCircle2, Gift, RefreshCw, AlertTriangle, Sparkles, Star } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Progress, SectionHeading, EmptyState, Skeleton, Stat } from '../components/ui/kit'
import { useApi } from '../lib/useApi'
import { useResources, notifyResourcesChanged } from '../lib/resources'
import { SpecialTasksPanel } from '../components/SpecialTasksPanel'
import { claimAllTasks, claimTask, fetchTasks, type TaskBoard, type TaskState } from '../lib/game'
import { formatNumber } from '../lib/format'
import { useI18n } from '../i18n'

type Notice = { kind: 'success' | 'info' | 'error'; text: string } | null

const NOTICE_CLASS: Record<'success' | 'info' | 'error', string> = {
  success: 'border-success/30 bg-success/10 text-success',
  info: 'border-primary/30 bg-primary/10 text-primary',
  error: 'border-red-500/30 bg-red-900/20 text-red-300'
}

function TaskRow({
  task,
  busy,
  disabled,
  onClaim
}: {
  task: TaskState
  busy: boolean
  disabled: boolean
  onClaim: (key: string) => void
}) {
  const t = useI18n().t
  const done = task.claimed
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/50 p-3">
      <div
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
          done ? 'bg-success/15 text-success' : task.completed ? 'bg-primary/15 text-primary' : 'bg-white/5 text-muted'
        }`}
      >
        {done ? <CheckCircle2 className="h-5 w-5" /> : <Target className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-white">{task.title}</p>
          <span className="shrink-0 text-xs font-bold text-primary">+{task.xp} XP</span>
        </div>
        <Progress className="mt-1.5" value={task.progress} max={task.goal} tone={done || task.completed ? 'success' : 'primary'} />
        <p className="mt-1 text-[10px] text-muted">{t('tasks.progress', { progress: task.progress, goal: task.goal })}{done ? t('tasks.claimedSuffix') : ''}</p>
      </div>
      <Button
        size="sm"
        variant={done || task.completed ? 'success' : 'outline'}
        disabled={disabled || !task.completed || done}
        isLoading={busy}
        onClick={() => onClaim(task.key)}
        className="shrink-0"
      >
        {done ? t('common.done') : t('common.claim')}
      </Button>
    </div>
  )
}

function BonusRow({
  label,
  xp,
  completed,
  claimed,
  busy,
  disabled,
  onClaim
}: {
  label: string
  xp: number
  completed: boolean
  claimed: boolean
  busy: boolean
  disabled: boolean
  onClaim: () => void
}) {
  const t = useI18n().t
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${claimed ? 'border-success/40 bg-success/10' : completed ? 'border-gold/40 bg-gold/10' : 'border-line bg-surface-2/40'}`}>
      <Gift className={`h-5 w-5 ${claimed || completed ? 'text-gold' : 'text-muted'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{t('tasks.bonusSuffix', { label })}</p>
        <p className="text-[10px] text-muted">+{formatNumber(xp)} XP{claimed ? t('tasks.claimedSuffix') : ''}</p>
      </div>
      <Button
        size="sm"
        variant={completed ? 'success' : 'outline'}
        disabled={disabled || !completed || claimed}
        isLoading={busy}
        onClick={onClaim}
        className="shrink-0"
      >
        {claimed ? t('common.done') : t('common.claim')}
      </Button>
    </div>
  )
}

export default function Tasks() {
  const { t, tp } = useI18n()
  const { data, loading, error, reload } = useApi(() => fetchTasks(), [])
  const resources = useResources()
  const [board, setBoard] = useState<TaskBoard | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [claimingAll, setClaimingAll] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  useEffect(() => {
    if (data) setBoard(data)
  }, [data])

  const allBusy = busyKey !== null || claimingAll
  const claimableCount = board
    ? [...board.daily, ...board.weekly, board.dailyBonus, board.weeklyBonus].filter((x) => x.completed && !x.claimed).length
    : 0

  async function claim(key: string) {
    if (allBusy) return
    setBusyKey(key)
    setNotice(null)
    try {
      const res = await claimTask(key)
      setBoard(res.board)
      if (res.claimed) {
        setNotice({ kind: 'success', text: t('tasks.claimedNotice', { xp: res.xpAwarded }) })
        notifyResourcesChanged()
      } else if (res.alreadyClaimed) {
        setNotice({ kind: 'info', text: t('tasks.alreadyClaimed') })
      } else {
        setNotice({ kind: 'info', text: t('tasks.notCompleted') })
      }
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : t('tasks.claimFailed') })
    } finally {
      setBusyKey(null)
    }
  }

  async function claimAll() {
    if (allBusy) return
    setClaimingAll(true)
    setNotice(null)
    try {
      const r = await claimAllTasks()
      setBoard(r.board)
      if (r.xpAwarded > 0) {
        setNotice({ kind: 'success', text: tp('tasks.claimedTasks', r.claimed.length, { xp: r.xpAwarded }) })
        notifyResourcesChanged()
      } else {
        setNotice({ kind: 'info', text: t('tasks.nothingToClaim') })
      }
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : t('tasks.claimFailed') })
    } finally {
      setClaimingAll(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SpecialTasksPanel />

      <SectionHeading
        eyebrow={t('tasks.eyebrow')}
        title={t('tasks.title')}
        description={t('tasks.description')}
        right={
          <Button
            size="sm"
            variant="outline"
            onClick={claimAll}
            disabled={loading || allBusy || claimableCount === 0}
            isLoading={claimingAll}
            iconLeft={claimingAll ? undefined : <Gift className="h-4 w-4" />}
          >
            {claimableCount > 0 ? t('tasks.claimAllCount', { count: claimableCount }) : t('tasks.claimAll')}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label={t('dashboard.lifetimeXp')}
          value={resources.data ? formatNumber(resources.data.progress.xp) : '—'}
          Icon={Star}
          tone="text-primary"
        />
        <Stat label={t('stat.readyToClaim')} value={String(claimableCount)} Icon={Gift} tone="text-gold" />
      </div>

      {notice && (
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${NOTICE_CLASS[notice.kind]}`} role="status">
          <Sparkles className="h-4 w-4 shrink-0" /> {notice.text}
        </div>
      )}

      {loading && !board ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : error && !board ? (
        <EmptyState
          Icon={AlertTriangle}
          title={t('tasks.error')}
          description={error}
          action={<Button size="sm" variant="outline" onClick={reload}><RefreshCw className="me-2 h-4 w-4" />{t('common.retry')}</Button>}
        />
      ) : !board ? null : (
        <>
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">{t('tasks.daily')}</h2>
              <Badge>{board.day} UTC</Badge>
            </div>
            {board.daily.map((x) => (
              <TaskRow key={x.key} task={x} busy={busyKey === x.key} disabled={allBusy} onClaim={claim} />
            ))}
            <BonusRow
              label={t('tasks.allDaily')}
              xp={board.dailyBonus.xp}
              completed={board.dailyBonus.completed}
              claimed={board.dailyBonus.claimed}
              busy={busyKey === board.dailyBonus.key}
              disabled={allBusy}
              onClaim={() => claim(board.dailyBonus.key)}
            />
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">{t('tasks.weekly')}</h2>
              <Badge>{board.week}</Badge>
            </div>
            {board.weekly.map((x) => (
              <TaskRow key={x.key} task={x} busy={busyKey === x.key} disabled={allBusy} onClaim={claim} />
            ))}
            <BonusRow
              label={t('tasks.allWeekly')}
              xp={board.weeklyBonus.xp}
              completed={board.weeklyBonus.completed}
              claimed={board.weeklyBonus.claimed}
              busy={busyKey === board.weeklyBonus.key}
              disabled={allBusy}
              onClaim={() => claim(board.weeklyBonus.key)}
            />
          </section>
        </>
      )}
    </div>
  )
}
