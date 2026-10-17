import {
  Wallet as WalletIcon,
  Settings,
  Gift,
  HelpCircle,
  LogOut,
  Mail,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Hash
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { useAuth } from '../context/AuthContext'
import { Link } from '../components/router'
import { DEMO_PLAYER } from '../data/demo'

interface MenuItem {
  id: string
  label: string
  desc: string
  Icon: React.ComponentType<{ className?: string }>
  to?: string
  soon?: boolean
}

const MENU: MenuItem[] = [
  { id: 'wallet', label: 'Wallet', desc: 'Simulated projections & points', Icon: WalletIcon, to: '/dashboard/wallet' },
  { id: 'settings', label: 'Settings', desc: 'Preferences & security', Icon: Settings, soon: true },
  { id: 'referrals', label: 'Referrals', desc: 'Invite friends to TycoonX', Icon: Gift, soon: true },
  { id: 'help', label: 'Help & Support', desc: 'Guides and answers', Icon: HelpCircle, soon: true }
]

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || 'TX'
  )
}

export default function Profile() {
  const { user, logout } = useAuth()
  const displayName = user?.username || user?.email || 'Tycoon'
  const xpPct = Math.round((DEMO_PLAYER.xp / DEMO_PLAYER.xpToNext) * 100)

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary font-semibold">
            <Sparkles className="h-3 w-3" /> Account
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Profile</h1>
          <p className="text-sm text-gray-400">Your account, preferences and support.</p>
        </div>
        <Badge variant="demo">DEMO / PREVIEW</Badge>
      </header>

      <Card padding="md" className="border border-gray-800/60">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-16 w-16 shrink-0 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white text-lg">
              {initials(displayName)}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-white truncate">{displayName}</h2>
              <p className="mt-0.5 text-sm text-gray-400 flex items-center gap-1.5 truncate">
                <Mail className="h-3.5 w-3.5 shrink-0" /> {user?.email || '—'}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-accent/30 text-accent bg-accent/5">
                  Role: {user?.role || '—'}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-gray-700 text-gray-400 bg-gray-800/30">
                  <Hash className="h-3 w-3" /> {user?.id ?? '—'}
                </span>
              </div>
            </div>
          </div>
          <div className="sm:ml-auto">
            <Button variant="outline" onClick={logout} className="w-full sm:w-auto">
              Sign out <LogOut className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Card padding="md" className="border border-gray-800/60">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">Progress</h2>
          <Badge variant="demo">DEMO VALUES</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-300">Tycoon Level</span>
              <span className="text-gray-400">Lv {DEMO_PLAYER.level}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-800/70 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: '50%' }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-300">Experience</span>
              <span className="text-gray-400">
                {DEMO_PLAYER.xp}/{DEMO_PLAYER.xpToNext}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-800/70 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-accent to-primary" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </div>
        <p className="mt-3 text-[10px] text-gray-500">
          Level and XP are simulated placeholders — not real account statistics.
        </p>
      </Card>

      <section>
        <h2 className="text-base font-bold mb-3">Account &amp; More</h2>
        <div className="rounded-xl border border-gray-800/60 overflow-hidden divide-y divide-gray-800/60">
          {MENU.map((item) => {
            const inner = (
              <>
                <span className="p-2 rounded-lg bg-gray-800/60 shrink-0">
                  <item.Icon className="h-4 w-4 text-gray-300" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white truncate">{item.label}</span>
                  <span className="block text-[11px] text-gray-400 truncate">{item.desc}</span>
                </span>
                {item.soon ? (
                  <Badge variant="warning">Coming Soon</Badge>
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
                )}
              </>
            )

            return item.to ? (
              <Link
                key={item.id}
                to={item.to}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-800/40"
              >
                {inner}
              </Link>
            ) : (
              <div key={item.id} aria-disabled="true" className="flex items-center gap-3 px-4 py-3.5 opacity-70">
                {inner}
              </div>
            )
          })}
        </div>
      </section>

      <Card padding="sm" className="border border-gray-800/60">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-success mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-white">Secure sign out</h3>
            <p className="text-xs text-gray-400">
              Your session runs on a secure httpOnly cookie. Sign out above to end it safely.
            </p>
          </div>
        </div>
      </Card>

      <p className="text-[10px] text-gray-500">
        Account details below are provided by the authenticated API. Level and XP are demo previews.
      </p>
    </div>
  )
}
