import { useState, useEffect } from 'react'
import { Home as HomeIcon } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Landing from './pages/Landing'
import GameHome from './game/GameHome'
import Dashboard from './pages/Dashboard'
import CEOs from './pages/CEOs'
import Empire from './pages/Empire'
import Tasks from './pages/Tasks'
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
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <p className="text-6xl font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
        404
      </p>
      <h1 className="mt-4 text-xl font-bold text-white">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-gray-400">
        The page you are looking for does not exist or has moved.
      </p>
      <button
        onClick={() => navigate('/')}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
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
      <div className="min-h-screen bg-bg text-white font-sans flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <span className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          Loading TycoonX...
        </div>
      </div>
    )
  }

  const authed = !!user

  return (
    <div className="min-h-screen bg-bg text-white font-sans">
      {page === '/login' ? (
        <Login navigate={navigate} />
      ) : page === '/register' ? (
        <Register navigate={navigate} />
      ) : (
        <RouterProvider
          fallback={<NotFound navigate={navigate} />}
          routes={[
            {
              path: '/',
              element: <Landing navigate={navigate} authed={authed} />
            },
            {
              path: '/dashboard',
              element: <Layout><GameHome navigate={navigate} /></Layout>
            },
            {
              path: '/dashboard/classic',
              element: <Layout><Dashboard navigate={navigate} /></Layout>
            },
            {
              path: '/dashboard/ceos',
              element: <Layout><CEOs /></Layout>
            },
            {
              path: '/dashboard/empire',
              element: <Layout><Empire /></Layout>
            },
            {
              path: '/dashboard/tasks',
              element: <Layout><Tasks /></Layout>
            },
            {
              path: '/dashboard/wallet',
              element: <Layout><Wallet /></Layout>
            },
            {
              path: '/dashboard/profile',
              element: <Layout><Profile /></Layout>
            }
          ]}
        />
      )}
    </div>
  )
}
