import { useState, type ReactNode } from 'react'
import {
  LayoutDashboard,
  Users,
  Building2,
  CheckCircle,
  MoreHorizontal,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'
import { Link, useRouter } from './router'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', Icon: LayoutDashboard },
  { id: 'market', label: 'Market', href: '/dashboard/ceos', Icon: Users },
  { id: 'empire', label: 'Empire', href: '/dashboard/empire', Icon: Building2 },
  { id: 'tasks', label: 'Tasks', href: '/dashboard/tasks', Icon: CheckCircle },
  { id: 'profile', label: 'Profile', href: '/dashboard/profile', Icon: MoreHorizontal }
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const activeLabel = NAV_ITEMS.find((i) => isActive(currentPath, i.href))?.label ?? 'TycoonX'

  return (
    <div className="min-h-screen bg-bg text-white flex">
      {/* Sidebar: md (768px) and up */}
      <aside
        className={`hidden md:flex md:flex-col shrink-0 border-r border-gray-800 bg-gray-900/40 transition-[width] duration-200 ${
          collapsed ? 'md:w-16' : 'md:w-60 lg:w-64'
        }`}
      >
        <div className="h-14 flex items-center px-4 border-b border-gray-800">
          <span className="font-bold tracking-tighter bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent text-lg">
            {collapsed ? 'TX' : 'TycoonX'}
          </span>
        </div>
        <nav className="flex-1 p-2 space-y-1" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = isActive(currentPath, item.href)
            return (
              <Link
                key={item.id}
                to={item.href}
                title={item.label}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-300 hover:bg-gray-800/60 hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <item.Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            )
          })}
        </nav>
        <div className="p-2 border-t border-gray-800">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-400 hover:bg-gray-800/60 hover:text-white transition-colors"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
          {!collapsed && (
            <p className="px-3 pt-2 text-[10px] text-gray-400">
              CEO rates are simulations
            </p>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header (all breakpoints) */}
        <header className="sticky top-0 z-30 h-14 flex items-center gap-3 border-b border-gray-800 bg-gray-900/70 backdrop-blur px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden text-gray-200 hover:text-white"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="md:hidden text-lg font-bold tracking-tighter bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            TycoonX
          </span>
          <span className="hidden md:block text-sm font-medium text-gray-200">{activeLabel}</span>
          <span className="ml-auto text-[10px] px-2 py-1 rounded border border-accent/30 text-accent bg-accent/5">
            SIMULATION
          </span>
        </header>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-6 lg:px-8 pt-5 md:pt-6 pb-[calc(env(safe-area-inset-bottom)_+_5rem)] md:pb-8">
            {children}
          </div>
        </main>

        {/* Bottom nav: below md (mobile) */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-800 bg-gray-900/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
          aria-label="Primary"
        >
          <div className="flex justify-around items-stretch h-14">
            {NAV_ITEMS.map((item) => {
              const active = isActive(currentPath, item.href)
              return (
                <Link
                  key={item.id}
                  to={item.href}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                    active ? 'text-primary' : 'text-gray-400 hover:text-white'
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
        <div
          className="md:hidden fixed inset-0 z-50 bg-gray-950/80 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[80%] bg-gray-900 border-r border-gray-800 p-4 pb-[calc(env(safe-area-inset-bottom)_+_1rem)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <span className="text-lg font-bold tracking-tighter bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                TycoonX
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="space-y-1" aria-label="Mobile">
              {NAV_ITEMS.map((item) => {
                const active = isActive(currentPath, item.href)
                return (
                  <Link
                    key={item.id}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-300 hover:bg-gray-800/60 hover:text-white'
                    }`}
                  >
                    <item.Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <p className="mt-6 px-3 text-[10px] text-gray-400">
              CEO rates are simulations — non-withdrawable.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
