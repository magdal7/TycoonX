import { useState, useEffect, type ReactNode } from 'react'
import { Home as HomeIcon } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
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
import { RouterProvider } from './components/router'
import { Layout } from './components/Layout'

type Page = '/' | '/login' | '/register'

function getPath(): Page {
  const p = window.location.pathname.replace(/\/+$/, '')
  if (p === '/login') return '/login'
  if (p === '/register') return '/register'
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
    if (!user && isDashboard) {
      window.history.replaceState(null, '', '/login')
      setPage('/login')
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
            { path: '/dashboard/world', element: wrap(<GameHome navigate={navigate} />) }
          ]}
        />
      )}
    </div>
  )
}
