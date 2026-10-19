import { useState, type ReactNode } from 'react'
import {
  Home,
  Store,
  Boxes,
  Target,
  Trophy,
  Wallet,
  User,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Coins,
  Sparkles,
  ShieldCheck
} from 'lucide-react'
import { Link, useRouter } from './router'
import { useResources } from '../lib/resources'
import { formatNumber } from '../lib/format'
import { useAuth } from '../context/AuthContext'

interface NavItem {
  id: string
  label: string
  href: string
  Icon: React.ComponentType<{ className?: string }>
}

const PRIMARY: NavItem[] = [
  { id: 'home', label: 'Empire', href: '/dashboard', Icon: Home },
  { id: 'market', label: 'Market', href: '/dashboard/market', Icon: Store },
  { id: 'collection', label: 'CEOs', href: '/dashboard/collection', Icon: Boxes },
  { id: 'tasks', label: 'Missions', href: '/dashboard/tasks', Icon: Target },
  { id: 'profile', label: 'Profile', href: '/dashboard/profile', Icon: User }
]

const SECONDARY: NavItem[] = [
  { id: 'achievements', label: 'Achievements', href: '/dashboard/achievements', Icon: Sparkles },
  { id: 'leaderboard', label: 'Leaderboard', href: '/dashboard/leaderboard', Icon: Trophy },
  { id: 'wallet', label: 'Wallet', href: '/dashboard/wallet', Icon: Wallet }
]

function isActive(current: string, href: string): boolean {
  if (href === '/dashboard') return current === '/dashboard'
  return current === href || current.startsWith(href + '/')
}

export interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { currentPath } = useRouter()
  const { user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { data: resources } = useResources()

  const all = [...PRIMARY, ...SECONDARY]
  const activeLabel = all.find((i) => isActive(currentPath, i.href))?.label ?? 'TycoonX'

  return (
    <div className="flex min-h-screen bg-bg text-white">
      {/* Sidebar (md+) */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-line bg-surface-2/60 backdrop-blur md:flex ${
          collapsed ? 'md:w-16' : 'md:w-64'
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-line px-4">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-sm font-black">
            TX
          </div>
          {!collapsed && <span className="text-lg font-black tracking-tighter text-gradient">TycoonX</span>}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="Primary">
          {PRIMARY.map((item) => (
            <SideLink key={item.id} item={item} active={isActive(currentPath, item.href)} collapsed={collapsed} />
          ))}
          <div className="my-2 border-t border-line" />
          {!collapsed && <p className="px-3 pb-1 text-[10px] uppercase tracking-widest text-muted">Progress</p>}
          {SECONDARY.map((item) => (
            <SideLink key={item.id} item={item} active={isActive(currentPath, item.href)} collapsed={collapsed} />
          ))}
        </nav>

        <div className="border-t border-line p-2">
          {user?.role === 'ADMIN' && (
            <Link
              to="/admin"
              className="mb-1 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-primary transition-colors hover:bg-primary/10"
            >
              <ShieldCheck className="h-4 w-4" />
              {!collapsed && <span>Admin console</span>}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-muted transition-colors hover:bg-white/5 hover:text-white"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /><span>Collapse</span></>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="text-white md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2 md:hidden">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-primary to-accent text-xs font-black">TX</div>
          </div>
          <span className="hidden text-sm font-semibold text-white md:block">{activeLabel}</span>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-1.5 rounded-full border border-line bg-surface-2/70 px-3 py-1.5 text-xs font-semibold text-gold sm:flex">
              <Coins className="h-3.5 w-3.5" />
              {resources ? formatNumber(resources.sp.totalSp) : '—'}
              <span className="font-normal text-muted">SP</span>
            </div>
            <Link
              to="/dashboard/profile"
              className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface-2/70 text-xs font-bold text-white"
              title={user?.username ?? 'Profile'}
            >
              {(user?.username ?? 'TX').slice(0, 2).toUpperCase()}
            </Link>
          </div>
        </header>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 pb-[calc(env(safe-area-inset-bottom)_+_5.5rem)] pt-5 md:px-6 md:pb-10 lg:px-8">
            {children}
          </div>
        </main>

        {/* Bottom nav (mobile) */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
          aria-label="Primary"
        >
          <div className="flex h-16 items-stretch">
            {PRIMARY.map((item) => {
              const active = isActive(currentPath, item.href)
              return (
                <Link
                  key={item.id}
                  to={item.href}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                    active ? 'text-primary' : 'text-muted'
                  }`}
                >
                  <item.Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute inset-y-0 left-0 w-72 max-w-[80%] border-r border-line bg-surface-2 p-4 pb-[calc(env(safe-area-inset-bottom)_+_1rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <span className="text-lg font-black tracking-tighter text-gradient">TycoonX</span>
              <button type="button" onClick={() => setMobileOpen(false)} className="text-muted hover:text-white" aria-label="Close menu">
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="space-y-1" aria-label="Mobile">
              {all.map((item) => {
                const active = isActive(currentPath, item.href)
                return (
                  <Link
                    key={item.id}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                      active ? 'bg-primary/15 text-primary' : 'text-muted hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <item.Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                )
              })}
              {user?.role === 'ADMIN' && (
                <Link
                  to="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <ShieldCheck className="h-5 w-5" />
                  Admin console
                </Link>
              )}
            </nav>
            <p className="mt-6 px-3 text-[10px] leading-relaxed text-muted">
              CEO production is a game mechanic. Real-money withdrawals are disabled.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function SideLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  return (
    <Link
      to={item.href}
      title={item.label}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? 'bg-gradient-to-r from-primary/20 to-accent/10 text-white' : 'text-muted hover:bg-white/5 hover:text-white'
      } ${collapsed ? 'justify-center' : ''}`}
    >
      <item.Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )
}
