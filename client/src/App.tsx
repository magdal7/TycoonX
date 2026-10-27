import { useState, useEffect, type ReactNode } from 'react'
import { Home as HomeIcon } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Policy from './pages/Policy'
import Landing from './pages/Landing'
import GameHome from './game/GameHome'
import Home from './pages/Home'
import Market from './pages/Market'
import Collection from './pages/Collection'
import Tasks from './pages/Tasks'
import Achievements from './pages/Achievements'
import Leaderboard from './pages/Leaderboard'
import Wallet from './pages/Wallet'
import Profile from './pages/Profile'
import Referrals from './pages/Referrals'
import Help from './pages/Help'
import { AdminLayout } from './components/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminSpecialTasks from './pages/admin/AdminSpecialTasks'
import AdminAudit from './pages/admin/AdminAudit'
import AdminUsers from './pages/admin/AdminUsers'
import AdminCatalog from './pages/admin/AdminCatalog'
import AdminEconomy from './pages/admin/AdminEconomy'
import AdminWithdrawals from './pages/admin/AdminWithdrawals'
import AdminPayments from './pages/admin/AdminPayments'
import AdminSettingsPage from './pages/admin/AdminSettings'
import AdminReferrals from './pages/admin/AdminReferrals'
import { RouterProvider } from './components/router'
import { Layout } from './components/Layout'
import { useT } from './i18n'

type Page = '/' | '/login' | '/register' | '/terms' | '/privacy'

function getPath(): Page {
  const p = window.location.pathname.replace(/\/+$/, '')
  if (p === '/login') return '/login'
  if (p === '/register') return '/register'
  if (p === '/terms') return '/terms'
  if (p === '/privacy') return '/privacy'
  return '/'
}

function NotFound({ navigate }: { navigate: (p: string) => void }) {
  const t = useT()
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-extrabold text-gradient">404</p>
      <h1 className="mt-4 text-xl font-bold text-white">{t('auth.notFound.title')}</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">{t('auth.notFound.body')}</p>
      <button
        onClick={() => navigate('/')}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
      >
        <HomeIcon className="h-4 w-4" /> {t('auth.notFound.home')}
      </button>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  const t = useT()
  const [page, setPage] = useState<Page>(getPath())

  useEffect(() => {
    const onPop = () => setPage(getPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (loading) return
    const p = window.location.pathname
    const isDashboard = p === '/dashboard' || p.startsWith('/dashboard/')
    const isAdmin = p === '/admin' || p.startsWith('/admin/')
    if (!user && (isDashboard || isAdmin)) {
      window.history.replaceState(null, '', '/login')
      setPage('/login')
    } else if (user && isAdmin && user.role !== 'ADMIN') {
      window.history.replaceState(null, '', '/dashboard')
      setPage('/')
    } else if (user && (p === '/login' || p === '/register')) {
      window.history.replaceState(null, '', '/dashboard')
      setPage('/')
    }
  }, [loading, user])

  function navigate(p: string) {
    const path = p.replace(/\/+$/, '') || '/'
    window.history.pushState(null, '', path)
    setPage(getPath())
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  if (loading) {
    return (
      <div className="theme-emerald flex min-h-screen items-center justify-center bg-bg font-sans text-ink">
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          {t('auth.loading')}
        </div>
      </div>
    )
  }

  const authed = !!user
  const wrap = (el: ReactNode) => <Layout>{el}</Layout>

  return (
    <div className="min-h-screen bg-bg font-sans text-ink">
      {page === '/login' ? (
        <div className="theme-emerald min-h-screen bg-bg text-ink"><Login navigate={navigate} /></div>
      ) : page === '/register' ? (
        <div className="theme-emerald min-h-screen bg-bg text-ink"><Register navigate={navigate} /></div>
      ) : page === '/terms' ? (
        <div className="theme-emerald min-h-screen bg-bg text-ink"><Policy kind="terms" navigate={navigate} /></div>
      ) : page === '/privacy' ? (
        <div className="theme-emerald min-h-screen bg-bg text-ink"><Policy kind="privacy" navigate={navigate} /></div>
      ) : (
        <RouterProvider
          fallback={<div className="theme-emerald"><NotFound navigate={navigate} /></div>}
          routes={[
            { path: '/', element: <div className="theme-emerald min-h-screen bg-bg text-ink"><Landing navigate={navigate} authed={authed} /></div> },
            { path: '/dashboard', element: wrap(<Home />) },
            { path: '/dashboard/market', element: wrap(<Market />) },
            { path: '/dashboard/collection', element: wrap(<Collection />) },
            { path: '/dashboard/tasks', element: wrap(<Tasks />) },
            { path: '/dashboard/achievements', element: wrap(<Achievements />) },
            { path: '/dashboard/leaderboard', element: wrap(<Leaderboard />) },
            { path: '/dashboard/wallet', element: wrap(<Wallet />) },
            { path: '/dashboard/profile', element: wrap(<Profile />) },
            { path: '/dashboard/referrals', element: wrap(<Referrals />) },
            { path: '/dashboard/help', element: wrap(<Help />) },
            { path: '/dashboard/world', element: wrap(<GameHome navigate={navigate} />) },
            { path: '/admin', element: <AdminLayout><AdminDashboard /></AdminLayout> },
            { path: '/admin/users', element: <AdminLayout><AdminUsers /></AdminLayout> },
            { path: '/admin/referrals', element: <AdminLayout><AdminReferrals /></AdminLayout> },
            { path: '/admin/catalog', element: <AdminLayout><AdminCatalog /></AdminLayout> },
            { path: '/admin/economy', element: <AdminLayout><AdminEconomy /></AdminLayout> },
            { path: '/admin/withdrawals', element: <AdminLayout><AdminWithdrawals /></AdminLayout> },
            { path: '/admin/payments', element: <AdminLayout><AdminPayments /></AdminLayout> },
            { path: '/admin/special-tasks', element: <AdminLayout><AdminSpecialTasks /></AdminLayout> },
            { path: '/admin/settings', element: <AdminLayout><AdminSettingsPage /></AdminLayout> },
            { path: '/admin/audit', element: <AdminLayout><AdminAudit /></AdminLayout> }
          ]}
        />
      )}
    </div>
  )
}
