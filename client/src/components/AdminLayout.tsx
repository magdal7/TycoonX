import type { ReactNode } from 'react'
import {
  LayoutDashboard,
  ClipboardList,
  ScrollText,
  ArrowLeft,
  ShieldCheck,
  Users,
  UserPlus,
  Boxes,
  Activity,
  ArrowDownToLine,
  CreditCard,
  Settings
} from 'lucide-react'
import { Link, useRouter } from './router'

const NAV = [
  { href: '/admin', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', Icon: Users },
  { href: '/admin/referrals', label: 'Referrals', Icon: UserPlus },
  { href: '/admin/catalog', label: 'CEO Catalog', Icon: Boxes },
  { href: '/admin/economy', label: 'Economy', Icon: Activity },
  { href: '/admin/withdrawals', label: 'Withdrawals', Icon: ArrowDownToLine },
  { href: '/admin/payments', label: 'Payments', Icon: CreditCard },
  { href: '/admin/special-tasks', label: 'Special Tasks', Icon: ClipboardList },
  { href: '/admin/settings', label: 'Site Settings', Icon: Settings },
  { href: '/admin/audit', label: 'Audit Log', Icon: ScrollText }
]

function isActive(current: string, href: string): boolean {
  if (href === '/admin') return current === '/admin'
  return current === href || current.startsWith(href + '/')
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { currentPath } = useRouter()

  return (
    <div className="flex min-h-screen bg-bg text-white">
      <aside className="hidden shrink-0 flex-col border-r border-line bg-surface-2/60 backdrop-blur md:flex md:w-60">
        <div className="flex h-16 items-center gap-2 border-b border-line px-4">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-sm font-black">
            TX
          </div>
          <span className="text-sm font-black tracking-tight">Admin Console</span>
        </div>
        <nav className="flex-1 space-y-1 p-2" aria-label="Admin">
          {NAV.map((item) => {
            const active = isActive(currentPath, item.href)
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'bg-gradient-to-r from-primary/20 to-accent/10 text-white' : 'text-muted hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.Icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-line p-2">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted transition-colors hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to game
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">Admin</span>
          <nav className="ml-auto flex items-center gap-1 overflow-x-auto no-scrollbar md:hidden" aria-label="Admin mobile">
            {NAV.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isActive(currentPath, item.href) ? 'bg-primary/20 text-primary' : 'text-muted hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 pb-[calc(env(safe-area-inset-bottom)_+_3rem)] pt-5 md:px-6 md:pb-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
