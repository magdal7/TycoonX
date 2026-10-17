import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type User = { id: number; email: string; username: string; role: string } | null

type AuthCtx = {
  user: User
  loading: boolean
  login: (email: string, password: string) => Promise<{ error?: string }>
  register: (email: string, username: string, password: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth used outside AuthProvider')
  return c
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (r) => {
        if (r.ok) setUser((((await r.json()) as { user?: User }).user) ?? null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    })
    const j = (await r.json().catch(() => ({}))) as { error?: string; user?: User }
    if (!r.ok) return { error: j.error || 'login failed' }
    setUser(j.user ?? null)
    return {}
  }

  async function register(email: string, username: string, password: string) {
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
      credentials: 'include',
    })
    const j = (await r.json().catch(() => ({}))) as { error?: string; user?: User }
    if (!r.ok) return { error: j.error || 'register failed' }
    setUser(j.user ?? null)
    return {}
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
  }

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </Ctx.Provider>
  )
}
