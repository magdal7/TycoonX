import { useState } from 'react'
import { Target, CheckCircle2, Gift, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Progress, SectionHeading, EmptyState, Skeleton } from '../components/ui/kit'
import { useApi } from '../lib/useApi'
import { claimAllTasks, claimTask, fetchTasks, type TaskState } from '../lib/game'
import { formatNumber } from '../lib/format'

function TaskRow({ task, onClaim, busy }: { task: TaskState; onClaim: (key: string) => void; busy: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/50 p-3">
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${task.completed ? 'bg-success/15 text-success' : 'bg-white/5 text-muted'}`}>
        {task.completed ? <CheckCircle2 className="h-5 w-5" /> : <Target className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-white">{task.title}</p>
          <span className="shrink-0 text-xs font-bold text-primary">+{task.xp} XP</span>
        </div>
        <Progress className="mt-1.5" value={task.progress} max={task.goal} tone={task.completed ? 'success' : 'primary'} />
        <p className="mt-1 text-[10px] text-muted">{task.progress} / {task.goal}</p>
      </div>
      <Button size="sm" variant={task.completed ? 'success' : 'outline'} disabled={!task.completed || busy} onClick={() => onClaim(task.key)}>
        Claim
      </Button>
    </div>
  )
}

export default function Tasks() {
  const { data, loading, error, reload } = useApi(() => fetchTasks(), [])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  async function claim(key: string) {
    setBusy(true)
    setNotice('')
    try {
      await claimTask(key)
      reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Claim failed')
    } finally {
      setBusy(false)
    }
  }

  async function claimAll() {
    setBusy(true)
    setNotice('')
    try {
      const r = await claimAllTasks()
      setNotice(r.xpAwarded > 0 ? `Claimed ${r.claimed.length} tasks · +${r.xpAwarded} XP` : 'Nothing to claim')
      reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Claim failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading
        eyebrow="Missions"
        title="Daily & Weekly Tasks"
        description="Complete tasks to earn XP. Progress resets on UTC boundaries; unclaimed rewards persist."
        right={
          <Button size="sm" variant="outline" onClick={claimAll} disabled={busy} iconLeft={<Gift className="h-4 w-4" />}>
            Claim All
          </Button>
        }
      />

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
          <Sparkles className="h-4 w-4" /> {notice}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : error ? (
        <EmptyState Icon={AlertTriangle} title="Could not load missions" description={error} action={<Button size="sm" variant="outline" onClick={reload}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>} />
      ) : !data ? null : (
        <>
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">Daily</h2>
              <Badge>{data.day} UTC</Badge>
            </div>
            {data.daily.map((t) => <TaskRow key={t.key} task={t} onClaim={claim} busy={busy} />)}
            <BonusRow label="All daily tasks" xp={data.dailyBonus.xp} completed={data.dailyBonus.completed} onClaim={() => claim(data.dailyBonus.key)} busy={busy} />
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">Weekly</h2>
              <Badge>{data.week}</Badge>
            </div>
            {data.weekly.map((t) => <TaskRow key={t.key} task={t} onClaim={claim} busy={busy} />)}
            <BonusRow label="All weekly tasks" xp={data.weeklyBonus.xp} completed={data.weeklyBonus.completed} onClaim={() => claim(data.weeklyBonus.key)} busy={busy} />
          </section>
        </>
      )}
    </div>
  )
}

function BonusRow({ label, xp, completed, onClaim, busy }: { label: string; xp: number; completed: boolean; onClaim: () => void; busy: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${completed ? 'border-gold/40 bg-gold/10' : 'border-line bg-surface-2/40'}`}>
      <Gift className={`h-5 w-5 ${completed ? 'text-gold' : 'text-muted'}`} />
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">{label} completion bonus</p>
        <p className="text-[10px] text-muted">+{formatNumber(xp)} XP</p>
      </div>
      <Button size="sm" variant={completed ? 'success' : 'outline'} disabled={!completed || busy} onClick={onClaim}>Claim</Button>
    </div>
  )
}
