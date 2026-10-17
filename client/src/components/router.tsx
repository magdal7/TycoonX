import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type Route = { path: string; element: ReactNode }

type RouterCtx = {
  routes: Route[]
  currentPath: string
  navigate: (to: string) => void
}

const Ctx = createContext<RouterCtx | null>(null)

export function useRouter() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useRouter used outside RouterProvider')
  return c
}

export function normalizePath(path: string): string {
  if (!path) return '/'
  const stripped = path.replace(/\/+$/, '')
  return stripped === '' ? '/' : stripped
}

export function Link({
  to,
  children,
  className,
  onClick,
  title
}: {
  to: string
  children: ReactNode
  className?: string
  onClick?: () => void
  title?: string
}) {
  const { navigate } = useRouter()
  return (
    <a
      href={to}
      title={title}
      onClick={(e) => {
        e.preventDefault()
        onClick?.()
        navigate(to)
      }}
      className={className}
    >
      {children}
    </a>
  )
}

export function RouterProvider({
  routes,
  fallback
}: {
  routes: Route[]
  fallback?: ReactNode
}) {
  const [currentPath, setCurrentPath] = useState(normalizePath(window.location.pathname))

  const navigate = (to: string) => {
    const path = normalizePath(to)
    window.history.pushState(null, '', path)
    setCurrentPath(path)
  }

  useEffect(() => {
    const onPop = () => setCurrentPath(normalizePath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const match = routes.find((r) => normalizePath(r.path) === currentPath)

  return (
    <Ctx.Provider value={{ routes, currentPath, navigate }}>
      {match ? match.element : fallback ?? null}
    </Ctx.Provider>
  )
}
