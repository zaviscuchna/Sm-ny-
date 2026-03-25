'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarDays, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

const DEMO_ACCOUNTS = [
  { label: 'Manažer',       email: 'manager@demo.cz',  role: 'Kavárna Aroma · manažer' },
  { label: 'Zaměstnanec',   email: 'tereza@demo.cz',   role: 'Kavárna Aroma · barista' },
  { label: 'Super admin',   email: 'admin@demo.cz',    role: 'Všechny podniky' },
]

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    const demoEmail = searchParams.get('demo')
    if (demoEmail) {
      setEmail(demoEmail)
      setPassword('123456')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email) { setError('Zadej e-mail.'); return }

    setLoading(true)
    await new Promise(r => setTimeout(r, 400))

    const result = await login(email, password)
    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Přihlášení selhalo.')
      return
    }

    toast.success('Přihlášení proběhlo úspěšně')

    const redirect = searchParams.get('redirect')
    if (redirect) { router.push(redirect); return }

    if (result.role === 'superadmin') router.push('/admin')
    else if (result.role === 'manager') router.push('/dashboard')
    else router.push('/my-shifts')
  }

  const fillDemo = (e: string) => {
    setEmail(e)
    setPassword('123456')
    setError('')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      {/* Card */}
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 px-8 py-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-white/15 rounded-xl mb-3">
            <CalendarDays className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-white font-bold text-xl tracking-tight">Směny</h1>
          <p className="text-indigo-200 text-sm mt-0.5">Přihlaste se do svého účtu</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-7 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="vas@email.cz"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              className="border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus-visible:ring-indigo-500"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">Heslo</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPass ? 'text' : 'password'}
                placeholder="••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus-visible:ring-indigo-500 pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 font-semibold"
          >
            {loading ? 'Přihlašuji…' : 'Přihlásit se'}
          </Button>
        </form>

        {/* Demo accounts */}
        <div className="px-8 pb-7">
          <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-3 uppercase tracking-wide">Demo přístupy</p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc.email)}
                  className="w-full text-left px-3 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 leading-tight">
                        {acc.label}
                      </div>
                      <div className="text-[11px] text-slate-400">{acc.role}</div>
                    </div>
                    <div className="text-[10px] text-indigo-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Vyplnit →
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-300 mt-3 text-center">Heslo: 123456 (pro všechny demo účty)</p>
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Nemáš účet?{' '}
        <Link href="/register" className="text-indigo-400 hover:text-indigo-300">Zaregistrovat se zdarma</Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
