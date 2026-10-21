import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ensureOnboarding } from '../lib/ceos'
import { apiUrl } from '../lib/api'

type User = { id: number; email: string; username: string; role: string } | null

type RegisterInput = {
  email: string
  username: string
  password: string
  ref?: string
  acceptTerms: boolean
}

type AuthCtx = {
  user: User
  loading: boolean
  login: (email: string, password: string) => Promise<{ error?: string }>
  register: (input: RegisterInput) => Promise<{ error?: string }>
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
    fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
      .then(async (r) => {
        if (r.ok) setUser((((await r.json()) as { user?: User }).user) ?? null)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user) return
    ensureOnboarding().catch(() => {})
  }, [user?.id])

  async function login(email: string, password: string) {
    const r = await fetch(apiUrl('/api/auth/login'), {
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

  async function register(input: RegisterInput) {
    const { email, username, password, ref, acceptTerms } = input
    const r = await fetch(apiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password, acceptTerms, ...(ref ? { ref } : {}) }),
      credentials: 'include',
    })
    const j = (await r.json().catch(() => ({}))) as { error?: string; user?: User }
    if (!r.ok) return { error: j.error || 'register failed' }
    setUser(j.user ?? null)
    return {}
  }

  async function logout() {
    await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' })
    setUser(null)
  }

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </Ctx.Provider>
  )
}
