import { useState } from 'react'
import { Mail, Lock, ArrowLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card } from '../components/ui/card'
import { LogoMark } from '../components/Logo'

type Props = { navigate: (p: string) => void }

export default function Login({ navigate }: Props) {
  const { login } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    const email = fd.get('email') as string
    const password = fd.get('password') as string
    setLoading(true)
    setError('')
    const res = await login(email, password)
    setLoading(false)
    if (res.error) setError(res.error || 'Sign in failed')
    else navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-bg text-white font-sans px-4 py-6 pb-[calc(env(safe-area-inset-bottom)_+_2rem)]">
      <a
        href="/"
        onClick={(e) => { e.preventDefault(); navigate('/') }}
        className="flex items-center gap-2 text-accent/70 hover:text-accent transition mb-6"
        aria-label="Back to home"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </a>

      <div className="max-w-sm mx-auto">
        <div className="text-center mb-8">
          <LogoMark size={48} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-gray-400 text-sm mt-2">Sign in to your TycoonX empire</p>
        </div>

        <Card padding="lg" hover={false} className="border border-gray-800/50">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-gray-500" />
                <label className="text-sm font-medium text-gray-300">Email address</label>
              </div>
              <Input name="email" type="email" required autoComplete="email" className="mt-1" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-gray-500" />
                <label className="text-sm font-medium text-gray-300">Password</label>
              </div>
              <Input name="password" type="password" required minLength={8} autoComplete="current-password" showPasswordToggle className="mt-1" />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/20 border border-red-500/30">
                <span className="text-red-400">!</span>
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full" isLoading={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-800/50">
            <p className="text-center text-sm text-gray-400 mb-4">Don&apos;t have an account?</p>
            <a
              href="/register"
              onClick={(e) => { e.preventDefault(); navigate('/register') }}
              className="w-full flex items-center justify-center gap-2 text-sm text-accent underline"
            >
              Create account <span aria-hidden="true">→</span>
            </a>
          </div>

          <div className="mt-4">
            <p className="text-[10px] text-gray-500 text-center">Free to play · Production is a game mechanic</p>
          </div>
        </Card>
      </div>

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)_+_1rem)] left-4 right-4 text-center pointer-events-none">
        <p className="text-[10px] text-gray-400">TycoonX &bull; Premium UI Preview</p>
      </div>
    </div>
  )
}
