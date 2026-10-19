import { AlertTriangle, RefreshCw, ScrollText } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { SectionHeading, EmptyState, Skeleton } from '../../components/ui/kit'
import { useApi } from '../../lib/useApi'
import { fetchAdminAudit } from '../../lib/admin'

export default function AdminAudit() {
  const { data, loading, error, reload } = useApi(() => fetchAdminAudit(), [])

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading
        eyebrow="Admin"
        title="Audit Log"
        description="Immutable record of administrative actions."
        right={<Button size="sm" variant="ghost" onClick={reload} iconLeft={<RefreshCw className="h-4 w-4" />}>Refresh</Button>}
      />

      {loading ? (
        <Skeleton className="h-40" />
      ) : error ? (
        <EmptyState Icon={AlertTriangle} title="Could not load audit log" description={error} action={<Button size="sm" variant="outline" onClick={reload}>Retry</Button>} />
      ) : !data || data.length === 0 ? (
        <EmptyState Icon={ScrollText} title="No audit entries" description="Admin actions will appear here." />
      ) : (
        <div className="space-y-2">
          {data.map((a) => (
            <Card key={a.id} padding="sm" hover={false}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2">
                  <Badge>{a.action}</Badge>
                  <span className="text-muted">{a.targetType} #{a.targetId}</span>
                </span>
                <span className="text-muted">actor #{a.actorId} · {new Date(a.createdAt).toLocaleString()}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
