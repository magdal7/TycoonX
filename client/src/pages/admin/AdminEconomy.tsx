import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { SectionHeading, EmptyState, Skeleton, Stat } from '../../components/ui/kit'
import { useApi } from '../../lib/useApi'
import { fetchAdminEconomy } from '../../lib/admin'

export default function AdminEconomy() {
  const { data, loading, error, reload } = useApi(() => fetchAdminEconomy(), [])

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading
        eyebrow="Admin"
        title="Economy Monitoring"
        description="Aggregate SP, ledger sources, production stats and anomaly watch."
        right={<Button size="sm" variant="ghost" onClick={reload} iconLeft={<RefreshCw className="h-4 w-4" />}>Refresh</Button>}
      />

      {loading ? (
        <Skeleton className="h-60" />
      ) : error || !data ? (
        <EmptyState Icon={AlertTriangle} title="Could not load economy data" description={error} action={<Button size="sm" variant="outline" onClick={reload}>Retry</Button>} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Earned SP (total)" value={data.totals.earnedSp} />
            <Stat label="Bonus SP (total)" value={data.totals.bonusSp} />
            <Stat label="Lifetime SP" value={data.totals.lifetimeEarnedSp} />
            <Stat label="SP accounts" value={String(data.totals.accounts)} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card padding="md" hover={false}>
              <h2 className="text-sm font-bold">Ledger by source</h2>
              {data.ledgerBySource.length === 0 ? <p className="mt-2 text-xs text-muted">No ledger entries.</p> : (
                <ul className="mt-2 space-y-1">
                  {data.ledgerBySource.map((l) => (
                    <li key={l.sourceType} className="flex items-center justify-between text-[11px] text-muted">
                      <span>{l.sourceType}</span>
                      <span>{l.count} entries · {l.amountSp} SP</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card padding="md" hover={false}>
              <h2 className="text-sm font-bold">Production & ownership</h2>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted">
                <div>
                  <p className="font-semibold text-white">Cycles</p>
                  {data.cyclesByStatus.map((c) => <p key={c.status}>{c.status}: {c.count}</p>)}
                  {data.cyclesByStatus.length === 0 && <p>—</p>}
                </div>
                <div>
                  <p className="font-semibold text-white">Owned CEOs</p>
                  {data.ownedByStatus.map((o) => <p key={o.status}>{o.status}: {o.count}</p>)}
                  {data.ownedByStatus.length === 0 && <p>—</p>}
                </div>
              </div>
            </Card>
          </div>

          <Card padding="md" hover={false}>
            <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-warning" /><h2 className="text-sm font-bold">Suspicious activity</h2></div>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold text-white">Unusually large credits</h3>
                {data.suspicious.largeCredits.length === 0 ? (
                  <p className="mt-1 text-[11px] text-muted">None above threshold.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {data.suspicious.largeCredits.map((l) => (
                      <li key={l.id} className="flex items-center justify-between text-[11px] text-muted">
                        <span>{l.username} · {l.bucket}</span>
                        <span className="text-amber-400">{l.amountSp} SP · {l.sourceType}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white">Highest cycle volume</h3>
                {data.suspicious.highVolumeUsers.length === 0 ? (
                  <p className="mt-1 text-[11px] text-muted">No production recorded.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {data.suspicious.highVolumeUsers.map((u) => (
                      <li key={u.userId} className="flex items-center justify-between text-[11px] text-muted">
                        <span>{u.username}</span>
                        <span className="flex items-center gap-2">{u.flagged && <Badge variant="warning">flag</Badge>}{u.cycles} cycles</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
