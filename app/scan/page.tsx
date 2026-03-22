'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Coffee, CheckCircle2, LogIn, Clock, XCircle } from 'lucide-react'
import { format } from 'date-fns'

type State = 'loading' | 'login_required' | 'ready_in' | 'ready_out' | 'success_in' | 'success_out' | 'error'

function ScanContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const { user, activeBusiness, loading: authLoading } = useAuth()

  const token = searchParams.get('token')
  const bizId = searchParams.get('bizId')

  const [state,     setState]     = useState<State>('loading')
  const [clockIn,   setClockIn]   = useState<string | null>(null)
  const [resultTime, setResultTime] = useState<string>('')
  const [resultHours, setResultHours] = useState<number | null>(null)
  const [error,     setError]     = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Check current clock status
  useEffect(() => {
    if (authLoading) return
    if (!user) { setState('login_required'); return }
    if (!token || !bizId) { setError('Neplatný QR kód.'); setState('error'); return }

    fetch(`/api/clock?bizId=${bizId}&employeeId=${user.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.status === 'clocked_in') {
          setClockIn(data.clockIn)
          setState('ready_out')
        } else {
          setState('ready_in')
        }
      })
      .catch(() => { setError('Chyba připojení.'); setState('error') })
  }, [authLoading, user, token, bizId])

  const handleClock = async () => {
    if (!user || !token || !bizId || submitting) return
    setSubmitting(true)
    try {
      const res  = await fetch('/api/clock', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, bizId, employeeId: user.id, employeeName: user.name }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Chyba'); setState('error'); return }

      setResultTime(data.time)
      if (data.action === 'clock_in') {
        setState('success_in')
      } else {
        setResultHours(data.hours)
        setState('success_out')
      }
    } catch {
      setError('Chyba připojení.')
      setState('error')
    } finally {
      setSubmitting(false)
    }
  }

  const goToLogin = () => {
    const returnUrl = `/scan?token=${token}&bizId=${bizId}`
    router.push(`/login?redirect=${encodeURIComponent(returnUrl)}`)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Coffee className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Směny</div>
            <div className="text-[10px] text-slate-400">organizátor</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-8">

          {/* Loading */}
          {(state === 'loading' || authLoading) && (
            <div className="text-center py-4">
              <div className="w-10 h-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-400 dark:text-slate-500">Načítám…</p>
            </div>
          )}

          {/* Login required */}
          {state === 'login_required' && (
            <div className="text-center space-y-5">
              <div className="w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mx-auto">
                <LogIn className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-lg">Přihlás se</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Pro záznam docházky se musíš přihlásit.</p>
              </div>
              <button
                onClick={goToLogin}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Přihlásit se
              </button>
            </div>
          )}

          {/* Ready to clock IN */}
          {state === 'ready_in' && user && (
            <div className="text-center space-y-5">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Přihlášen/a jako</p>
                <p className="font-bold text-slate-900 dark:text-slate-100">{user.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 tabular-nums">
                  {format(new Date(), 'HH:mm · d. M. yyyy')}
                </p>
              </div>
              <button
                onClick={handleClock}
                disabled={submitting}
                className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-bold py-4 rounded-xl transition-colors text-lg flex items-center justify-center gap-2"
              >
                <Clock className="w-5 h-5" />
                {submitting ? 'Zaznamenávám…' : 'Zaznamenat příchod'}
              </button>
              <p className="text-xs text-slate-400 dark:text-slate-500">Stiskni tlačítko pro příchod do práce</p>
            </div>
          )}

          {/* Ready to clock OUT */}
          {state === 'ready_out' && user && (
            <div className="text-center space-y-5">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Přihlášen/a jako</p>
                <p className="font-bold text-slate-900 dark:text-slate-100">{user.name}</p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                  Příchod zaznamenán v {clockIn}
                </p>
              </div>
              <button
                onClick={handleClock}
                disabled={submitting}
                className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white font-bold py-4 rounded-xl transition-colors text-lg flex items-center justify-center gap-2"
              >
                <Clock className="w-5 h-5" />
                {submitting ? 'Zaznamenávám…' : 'Zaznamenat odchod'}
              </button>
              <p className="text-xs text-slate-400 dark:text-slate-500">Stiskni tlačítko při odchodu z práce</p>
            </div>
          )}

          {/* Success IN */}
          {state === 'success_in' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-xl">Příchod zaznamenán</p>
                <p className="text-3xl font-black text-green-500 mt-1 tabular-nums">{resultTime}</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">Hezkou směnu! 👋</p>
              </div>
            </div>
          )}

          {/* Success OUT */}
          {state === 'success_out' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-xl">Odchod zaznamenán</p>
                <p className="text-3xl font-black text-indigo-500 dark:text-indigo-400 mt-1 tabular-nums">{resultTime}</p>
                {resultHours !== null && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    Odpracováno: <span className="font-bold text-slate-800 dark:text-slate-200">{resultHours}h</span>
                  </p>
                )}
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Dobrou! 🎉</p>
              </div>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                <XCircle className="w-7 h-7 text-red-500" />
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">Chyba</p>
                <p className="text-sm text-red-500 mt-1">{error}</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Zkusit znovu
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default function ScanPage() {
  return (
    <Suspense>
      <ScanContent />
    </Suspense>
  )
}
