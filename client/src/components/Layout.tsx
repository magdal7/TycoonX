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
  UserPlus,
  ShieldCheck,
  Map,
  HelpCircle
} from 'lucide-react'
import { Link, useRouter } from './router'
import { Logo, LogoMark } from './Logo'
import { useResources } from '../lib/resources'
import { usePublicSettings, type FeatureSettings } from '../lib/siteSettings'
import { formatNumber } from '../lib/format'
import { useAuth } from '../context/AuthContext'

interface NavItem {
  id: string
  label: string
  href: string
  Icon: React.ComponentType<{ className?: string }>
  feature?: keyof FeatureSettings
}

const PRIMARY: NavItem[] = [
  { id: 'home', label: 'Empire', href: '/dashboard', Icon: Home },
  { id: 'market', label: 'Market', href: '/dashboard/market', Icon: Store, feature: 'market' },
  { id: 'collection', label: 'CEOs', href: '/dashboard/collection', Icon: Boxes, feature: 'collection' },
  { id: 'tasks', label: 'Missions', href: '/dashboard/tasks', Icon: Target, feature: 'tasks' },
  { id: 'profile', label: 'Profile', href: '/dashboard/profile', Icon: User }
]

const SECONDARY: NavItem[] = [
  { id: 'world', label: 'My Empire', href: '/dashboard/world', Icon: Map },
  { id: 'achievements', label: 'Achievements', href: '/dashboard/achievements', Icon: Sparkles, feature: 'achievements' },
  { id: 'leaderboard', label: 'Leaderboard', href: '/dashboard/leaderboard', Icon: Trophy, feature: 'leaderboard' },
  { id: 'referrals', label: 'Referrals', href: '/dashboard/referrals', Icon: UserPlus },
  { id: 'wallet', label: 'Wallet', href: '/dashboard/wallet', Icon: Wallet, feature: 'wallet' },
  { id: 'help', label: 'Help', href: '/dashboard/help', Icon: HelpCircle }
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
  const settings = usePublicSettings()
  const features = settings.data?.features
  const payoutsAvailable = settings.data?.capabilities?.payouts

  const allowed = (item: NavItem) => !item.feature || !features || features[item.feature]
  const primaryItems = PRIMARY.filter(allowed)
  const secondaryItems = SECONDARY.filter(allowed)
  const all = [...primaryItems, ...secondaryItems]
  const activeLabel = all.find((i) => isActive(currentPath, i.href))?.label ?? 'TycoonX'

  return (
    <div className="theme-emerald flex min-h-screen bg-bg text-ink">
      {/* Sidebar (md+) */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-line bg-surface-2/60 backdrop-blur md:flex ${
          collapsed ? 'md:w-16' : 'md:w-64'
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-line px-4">
          <LogoMark size={32} className="shrink-0" />
          {!collapsed && <span className="text-lg font-black tracking-tighter text-gradient">TycoonX</span>}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="Primary">
          {primaryItems.map((item) => (
            <SideLink key={item.id} item={item} active={isActive(currentPath, item.href)} collapsed={collapsed} />
          ))}
          <div className="my-2 border-t border-line" />
          {!collapsed && <p className="px-3 pb-1 text-[10px] uppercase tracking-widest text-muted">Progress</p>}
          {secondaryItems.map((item) => (
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
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-muted transition-colors hover:bg-white/5 hover:text-ink"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /><span>Collapse</span></>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {settings.data?.announcement.enabled && settings.data.announcement.message && (
          <div
            className={`px-4 py-2 text-center text-xs font-medium ${
              settings.data.announcement.level === 'critical'
                ? 'bg-red-900/40 text-red-200'
                : settings.data.announcement.level === 'warning'
                  ? 'bg-amber-500/20 text-amber-200'
                  : 'bg-primary/15 text-primary'
            }`}
          >
            {settings.data.announcement.message}
          </div>
        )}
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="text-ink md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2 md:hidden">
            <LogoMark size={28} />
          </div>
          <span className="hidden text-sm font-semibold text-ink md:block">{activeLabel}</span>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-1.5 rounded-full border border-line bg-surface-2/70 px-3 py-1.5 text-xs font-semibold text-gold sm:flex">
              <Coins className="h-3.5 w-3.5" />
              {resources ? formatNumber(resources.sp.totalSp) : '—'}
              <span className="font-normal text-muted">SP</span>
            </div>
            <Link
              to="/dashboard/profile"
              className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface-2/70 text-xs font-bold text-ink"
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
            {primaryItems.map((item) => {
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
              <Logo size={32} />
              <button type="button" onClick={() => setMobileOpen(false)} className="text-muted hover:text-ink" aria-label="Close menu">
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
                      active ? 'bg-primary/15 text-primary' : 'text-muted hover:bg-white/5 hover:text-ink'
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
            <a
              href="https://t.me/tycoonX_official"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-ink"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              Community · Telegram
            </a>
            <p className="mt-4 px-3 text-[10px] leading-relaxed text-muted">
              CEO production is a game mechanic. {payoutsAvailable === true
                ? 'Eligible Earned SP withdrawals are available with admin approval; nominal rates are not guaranteed returns.'
                : payoutsAvailable === false
                  ? 'Withdrawals are not open yet; nominal rates are not guaranteed returns.'
                  : 'Financial feature availability is shown in the Wallet.'}
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
        active ? 'bg-gradient-to-r from-primary/25 to-gold/10 text-ink shadow-[inset_2px_0_0_0_rgb(var(--c-gold))]' : 'text-muted hover:bg-white/5 hover:text-ink'
      } ${collapsed ? 'justify-center' : ''}`}
    >
      <item.Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )
}
