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
import { AdminLayout } from './components/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminSpecialTasks from './pages/admin/AdminSpecialTasks'
import AdminAudit from './pages/admin/AdminAudit'
import AdminUsers from './pages/admin/AdminUsers'
import AdminCatalog from './pages/admin/AdminCatalog'
import AdminEconomy from './pages/admin/AdminEconomy'
import AdminWithdrawals from './pages/admin/AdminWithdrawals'
import AdminSettingsPage from './pages/admin/AdminSettings'
import { RouterProvider } from './components/router'
import { Layout } from './components/Layout'

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
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-extrabold text-gradient">404</p>
      <h1 className="mt-4 text-xl font-bold text-white">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">The page you are looking for does not exist or has moved.</p>
      <button
        onClick={() => navigate('/')}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
      >
        <HomeIcon className="h-4 w-4" /> Back to home
      </button>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()
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
      <div className="flex min-h-screen items-center justify-center bg-bg font-sans text-white">
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading TycoonX...
        </div>
      </div>
    )
  }

  const authed = !!user
  const wrap = (el: ReactNode) => <Layout>{el}</Layout>

  return (
    <div className="min-h-screen bg-bg font-sans text-white">
      {page === '/login' ? (
        <Login navigate={navigate} />
      ) : page === '/register' ? (
        <Register navigate={navigate} />
      ) : page === '/terms' ? (
        <Policy kind="terms" navigate={navigate} />
      ) : page === '/privacy' ? (
        <Policy kind="privacy" navigate={navigate} />
      ) : (
        <RouterProvider
          fallback={<NotFound navigate={navigate} />}
          routes={[
            { path: '/', element: <Landing navigate={navigate} authed={authed} /> },
            { path: '/dashboard', element: wrap(<Home />) },
            { path: '/dashboard/market', element: wrap(<Market />) },
            { path: '/dashboard/collection', element: wrap(<Collection />) },
            { path: '/dashboard/tasks', element: wrap(<Tasks />) },
            { path: '/dashboard/achievements', element: wrap(<Achievements />) },
            { path: '/dashboard/leaderboard', element: wrap(<Leaderboard />) },
            { path: '/dashboard/wallet', element: wrap(<Wallet />) },
            { path: '/dashboard/profile', element: wrap(<Profile />) },
            { path: '/dashboard/world', element: wrap(<GameHome navigate={navigate} />) },
            { path: '/admin', element: <AdminLayout><AdminDashboard /></AdminLayout> },
            { path: '/admin/users', element: <AdminLayout><AdminUsers /></AdminLayout> },
            { path: '/admin/catalog', element: <AdminLayout><AdminCatalog /></AdminLayout> },
            { path: '/admin/economy', element: <AdminLayout><AdminEconomy /></AdminLayout> },
            { path: '/admin/withdrawals', element: <AdminLayout><AdminWithdrawals /></AdminLayout> },
            { path: '/admin/special-tasks', element: <AdminLayout><AdminSpecialTasks /></AdminLayout> },
            { path: '/admin/settings', element: <AdminLayout><AdminSettingsPage /></AdminLayout> },
            { path: '/admin/audit', element: <AdminLayout><AdminAudit /></AdminLayout> }
          ]}
        />
      )}
    </div>
  )
}
