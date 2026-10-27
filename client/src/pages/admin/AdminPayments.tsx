import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { SectionHeading, EmptyState, Skeleton } from '../../components/ui/kit'
import { useApi } from '../../lib/useApi'
import { fetchAdminPayments, fetchAdminPurchases } from '../../lib/admin'

const STATUS_TONE: Record<string, 'default' | 'demo' | 'success' | 'warning'> = {
  CREATED: 'demo',
  PENDING: 'warning',
  CONFIRMED: 'success',
  PAID: 'success',
  DELIVERED: 'success',
  FAILED: 'default',
  EXPIRED: 'default',
  CANCELLED: 'default',
  REFUNDED: 'default',
}

export default function AdminPayments() {
  const payments = useApi(() => fetchAdminPayments(), [])
  const purchases = useApi(() => fetchAdminPurchases(), [])

  function reload() {
    payments.reload()
    purchases.reload()
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading
        eyebrow="Admin"
        title="Payments & Purchases"
        description={
          payments.data?.paymentsEnabled
            ? 'Deposit invoices and CEO purchases. Payments are ACTIVE — deposit credit and ownership delivery are automated.'
            : 'Deposit invoices and CEO purchases. Payments are not currently active; no deposits are credited and no ownership is delivered.'
        }
        right={<Button size="sm" variant="ghost" onClick={reload} iconLeft={<RefreshCw className="h-4 w-4" />}>Refresh</Button>}
      />

      {payments.data?.paymentsEnabled !== true && (
        <Card padding="sm" className="border border-warning/30 bg-warning/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <p className="text-xs text-amber-200/90">
              Payments are not active. No deposits are credited, no purchases are paid, and no CEO ownership is
              delivered until payments are activated and verified.
            </p>
          </div>
        </Card>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold">Payments (deposit invoices)</h2>
        {payments.loading ? (
          <Skeleton className="h-20" />
        ) : payments.error ? (
          <EmptyState Icon={AlertTriangle} title="Could not load payments" description={payments.error} />
        ) : !payments.data?.payments?.length ? (
          <p className="text-xs text-muted">No payment intents recorded.</p>
        ) : (
          payments.data.payments.map((p) => (
            <Card key={p.id} padding="sm" hover={false}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="flex items-center gap-2">
                  <Badge variant={STATUS_TONE[p.status] ?? 'default'}>{p.status}</Badge>
                  <span>{p.username}</span>
                  <span className="text-muted">{p.purpose} · {p.provider}</span>
                </span>
                <span className="text-muted">{p.amountUsdt} USDT{p.creditedSp ? ` → ${p.creditedSp} SP` : ''} · {new Date(p.createdAt).toLocaleString()}</span>
              </div>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold">CEO purchases</h2>
        {purchases.loading ? (
          <Skeleton className="h-20" />
        ) : purchases.error ? (
          <EmptyState Icon={AlertTriangle} title="Could not load purchases" description={purchases.error} />
        ) : !purchases.data?.purchases?.length ? (
          <p className="text-xs text-muted">No purchases recorded.</p>
        ) : (
          purchases.data.purchases.map((p) => (
            <Card key={p.id} padding="sm" hover={false}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="flex items-center gap-2">
                  <Badge variant={STATUS_TONE[p.status] ?? 'default'}>{p.status}</Badge>
                  <span>{p.username}</span>
                  <span className="text-muted">{p.ceoName}</span>
                </span>
                <span className="text-muted">{p.priceUsd} USDT{p.ownedCeoId ? ` · owned #${p.ownedCeoId}` : ''} · {new Date(p.createdAt).toLocaleString()}</span>
              </div>
            </Card>
          ))
        )}
      </section>
    </div>
  )
}
