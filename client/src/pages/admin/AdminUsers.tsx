import { useState } from 'react'
import { AlertTriangle, Search, ShieldOff, ShieldCheck, User as UserIcon } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { SectionHeading, EmptyState, Skeleton, Stat } from '../../components/ui/kit'
import { useApi } from '../../lib/useApi'
import {
  fetchAdminUser,
  fetchAdminUsers,
  setAdminUserSuspension,
  type AdminUserDetail,
} from '../../lib/admin'

export default function AdminUsers() {
  const [term, setTerm] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [notice, setNotice] = useState('')

  const users = useApi(() => fetchAdminUsers(query || undefined), [query])
  const detail = useApi(() => (selected ? fetchAdminUser(selected) : Promise.resolve(null)), [selected])

  async function toggleSuspension(d: AdminUserDetail) {
    const suspend = !d.user.isSuspended
    const label = suspend ? 'Suspend' : 'Reactivate'
    if (!window.confirm(`${label} ${d.user.username}? This is a sensitive action.`)) return
    let reason: string | undefined
    if (suspend) {
      reason = window.prompt('Reason (optional)') ?? undefined
    }
    try {
      await setAdminUserSuspension(d.user.id, { suspend, confirm: true, ...(reason ? { reason } : {}) })
      setNotice(`${label}d ${d.user.username}`)
      users.reload()
      detail.reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Action failed')
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading eyebrow="Admin" title="Users" description="Search accounts and inspect balances, progress, ownership and history." />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          setQuery(term.trim())
        }}
        className="flex gap-2"
      >
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search username or email" className="text-sm" />
        <Button type="submit" iconLeft={<Search className="h-4 w-4" />}>Search</Button>
      </form>

      {notice && <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">{notice}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {users.loading ? (
            <Skeleton className="h-40" />
          ) : users.error ? (
            <EmptyState Icon={AlertTriangle} title="Could not load users" description={users.error} action={<Button size="sm" variant="outline" onClick={users.reload}>Retry</Button>} />
          ) : !users.data || users.data.length === 0 ? (
            <EmptyState Icon={UserIcon} title="No users found" description="Try a different search." />
          ) : (
            users.data.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelected(u.id)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  selected === u.id ? 'border-primary/50 bg-primary/10' : 'border-line bg-surface-2/50 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{u.username}</span>
                  <span className="flex items-center gap-1.5">
                    {u.role === 'ADMIN' && <Badge variant="demo">ADMIN</Badge>}
                    {u.isSuspended ? <Badge variant="warning">Suspended</Badge> : <Badge variant="success">Active</Badge>}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[10px] text-muted">{u.email}</p>
                <p className="mt-1 text-[10px] text-muted">
                  L{u.level} · {u.xp} XP · {u.ownedCeos} CEOs · {u.lifetimeEarnedSp} lifetime SP
                </p>
              </button>
            ))
          )}
        </div>

        <div>
          {!selected ? (
            <EmptyState Icon={UserIcon} title="Select a user" description="Choose an account to view its details." />
          ) : detail.loading ? (
            <Skeleton className="h-60" />
          ) : detail.error || !detail.data ? (
            <EmptyState Icon={AlertTriangle} title="Could not load account" description={detail.error} action={<Button size="sm" variant="outline" onClick={detail.reload}>Retry</Button>} />
          ) : (
            <UserDetail detail={detail.data} onToggle={() => toggleSuspension(detail.data!)} />
          )}
        </div>
      </div>
    </div>
  )
}

function UserDetail({ detail, onToggle }: { detail: AdminUserDetail; onToggle: () => void }) {
  const { user, balances, progress, referrals, production, ownedCeos, ledger, withdrawals } = detail
  return (
    <Card padding="md" hover={false} className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold">{user.username}</h2>
          <p className="text-[10px] text-muted">{user.email} · joined {new Date(user.createdAt).toLocaleDateString()}</p>
          {user.isSuspended && user.suspensionReason && (
            <p className="mt-1 text-[10px] text-amber-400">Suspended: {user.suspensionReason}</p>
          )}
        </div>
        {user.role !== 'ADMIN' && (
          <Button
            size="sm"
            variant={user.isSuspended ? 'success' : 'danger'}
            onClick={onToggle}
            iconLeft={user.isSuspended ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
          >
            {user.isSuspended ? 'Reactivate' : 'Suspend'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Earned SP" value={balances.earnedSp} />
        <Stat label="Bonus SP" value={balances.bonusSp} />
        <Stat label="Lifetime SP" value={balances.lifetimeEarnedSp} />
        <Stat label="Level" value={`L${progress.level}`} hint={progress.rank} />
        <Stat label="XP" value={String(progress.xp)} />
        <Stat label="Owned CEOs" value={String(ownedCeos.length)} />
      </div>

      <div className="text-[11px] text-muted">
        Referrals made: {referrals.made} ({referrals.qualified} qualified)
        {referrals.receivedFrom ? ` · referred by ${referrals.receivedFrom.code}` : ''}
        {' · '}Cycles: {production.cyclesClaimed}/{production.cyclesTotal} claimed
      </div>

      {ownedCeos.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-white">Owned CEOs</h3>
          <ul className="mt-1 space-y-1">
            {ownedCeos.map((o) => (
              <li key={o.id} className="flex items-center justify-between text-[11px] text-muted">
                <span className="truncate">{o.templateName} · {o.equipment}</span>
                <span>{o.status} · {o.lifetimeEarnedSp}/{o.lifetimeCapSp ?? '—'} SP</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ledger.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-white">Recent SP ledger</h3>
          <ul className="mt-1 space-y-1">
            {ledger.slice(0, 10).map((l) => (
              <li key={l.id} className="flex items-center justify-between text-[11px] text-muted">
                <span>{l.sourceType}</span>
                <span className={l.amountSp.startsWith('-') ? 'text-red-300' : 'text-success'}>{l.bucket} {l.amountSp}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {withdrawals.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-white">Withdrawals</h3>
          <ul className="mt-1 space-y-1">
            {withdrawals.map((w) => (
              <li key={w.id} className="flex items-center justify-between text-[11px] text-muted">
                <span>#{w.id} · {w.grossSp} SP</span>
                <span>{w.status} · {w.netUsdt} USDT</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
