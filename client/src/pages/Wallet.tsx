import {
  Wallet as WalletIcon,
  TrendingUp,
  Coins,
  Banknote,
  Lock,
  ShieldCheck,
  Clock,
  Info
} from 'lucide-react'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { DEMO_PRODUCTION_CYCLES } from '../data/demo'

const SIM_TOTAL = DEMO_PRODUCTION_CYCLES.reduce((s, c) => s + c.reward, 0)

export default function WalletPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary font-semibold">
            <WalletIcon className="h-3 w-3" /> Economy
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Wallet</h1>
          <p className="text-sm text-gray-400">
            Simulated projections, game points and future balances — kept separate.
          </p>
        </div>
        <Badge variant="demo">DEMO / PREVIEW</Badge>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md" className="border border-gray-800/60">
          <div className="flex items-center justify-between mb-3">
            <span className="p-2 rounded-lg bg-gray-800/60">
              <TrendingUp className="h-5 w-5 text-success" />
            </span>
            <Badge variant="demo">SIMULATED</Badge>
          </div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Production projection / batch</p>
          <p className="text-2xl font-bold text-success">{SIM_TOTAL.toLocaleString()} cr</p>
          <p className="mt-1 text-[10px] text-gray-500">
            Simulated output only — non-withdrawable, not money.
          </p>
        </Card>

        <Card padding="md" className="border border-gray-800/60">
          <div className="flex items-center justify-between mb-3">
            <span className="p-2 rounded-lg bg-gray-800/60">
              <Coins className="h-5 w-5 text-accent" />
            </span>
            <Badge variant="demo">DEMO</Badge>
          </div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Game points</p>
          <p className="text-2xl font-bold text-white">
            0 <span className="text-sm font-medium text-gray-400">SP</span> · 0{' '}
            <span className="text-sm font-medium text-gray-400">XP</span>
          </p>
          <p className="mt-1 text-[10px] text-gray-500">
            In-game points only — not currency, not convertible.
          </p>
        </Card>

        <Card padding="md" className="border border-gray-800/60">
          <div className="flex items-center justify-between mb-3">
            <span className="p-2 rounded-lg bg-gray-800/60">
              <Banknote className="h-5 w-5 text-gray-400" />
            </span>
            <Badge variant="warning">Coming Soon</Badge>
          </div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Real-money balance</p>
          <p className="text-2xl font-bold text-gray-500 flex items-center gap-2">
            <Lock className="h-5 w-5" /> Unavailable
          </p>
          <p className="mt-1 text-[10px] text-gray-500">
            No deposits, withdrawals or balances yet.
          </p>
        </Card>
      </section>

      <section>
        <h2 className="text-base font-bold mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Simulated Production Projections
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DEMO_PRODUCTION_CYCLES.map((cycle) => (
            <Card key={cycle.id} padding="sm" className="border border-gray-800/60">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <h3 className="text-sm font-semibold text-white truncate">{cycle.name}</h3>
                <Badge variant={cycle.active ? 'success' : 'default'}>
                  {cycle.active ? 'Running' : 'Idle'}
                </Badge>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-800/70 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  style={{ width: `${cycle.progress}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-500">
                <span>{cycle.progress}%</span>
                <span>{cycle.reward} cr · DEMO</span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-base font-bold mb-3">Transactions</h2>
        <Card padding="md" className="border border-gray-800/60 text-center py-8">
          <Lock className="h-7 w-7 text-gray-500 mx-auto mb-2" />
          <p className="text-sm text-gray-300 mb-1">Transaction history — Coming Soon</p>
          <p className="text-xs text-gray-500">
            No deposits, withdrawals or transactions are available.
          </p>
        </Card>
      </section>

      <Card padding="sm" className="border border-success/30 bg-success/5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-success mt-0.5 shrink-0" />
          <ul className="text-xs text-success/90 space-y-1 list-disc pl-4">
            <li>Simulated production credits are not real and cannot be withdrawn.</li>
            <li>Game points (SP/XP) are in-game only, never convertible to currency.</li>
            <li>Real-money features are not implemented — no payments or payouts.</li>
          </ul>
        </div>
      </Card>

      <p className="text-[10px] text-gray-500 flex items-center gap-1.5">
        <Info className="h-3 w-3" /> Figures shown are DEMO previews, not real balances.
      </p>
    </div>
  )
}
