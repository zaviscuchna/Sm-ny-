'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { isRegistered } from '@/lib/db'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'
import QRCode from 'react-qr-code'
import { RefreshCw, Clock, Users } from 'lucide-react'

interface AttendanceRecord {
  id: string
  employeeId: string
  employeeName: string
  clockIn: string
  clockOut: string | null
  hours: number | null
}

const TOKEN_TTL = 3 * 60 * 1000 // 3 minutes in ms

export default function QrPage() {
  const { activeBusiness } = useAuth()
  const [token,      setToken]      = useState<string | null>(null)
  const [expiresAt,  setExpiresAt]  = useState<Date | null>(null)
  const [timeLeft,   setTimeLeft]   = useState(TOKEN_TTL)
  const [now,        setNow]        = useState(new Date())
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading,    setLoading]    = useState(true)

  const bizIsRegistered = isRegistered(activeBusiness?.id ?? '')

  const fetchToken = useCallback(async () => {
    if (!activeBusiness || !bizIsRegistered) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/qr-token?bizId=${activeBusiness.id}`)
      const data = await res.json()
      setToken(data.token)
      setExpiresAt(new Date(data.expiresAt))
    } finally {
      setLoading(false)
    }
  }, [activeBusiness?.id, bizIsRegistered])

  const fetchAttendance = useCallback(async () => {
    if (!activeBusiness || !bizIsRegistered) return
    const res  = await fetch(`/api/attendance?bizId=${activeBusiness.id}`)
    const data = await res.json()
    setAttendance(data)
  }, [activeBusiness?.id, bizIsRegistered])

  // Initial load
  useEffect(() => {
    fetchToken()
    fetchAttendance()
  }, [fetchToken, fetchAttendance])

  // Countdown + auto-refresh token
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
      if (expiresAt) {
        const left = expiresAt.getTime() - Date.now()
        setTimeLeft(Math.max(0, left))
        if (left <= 0) {
          fetchToken()
          fetchAttendance()
        }
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt, fetchToken, fetchAttendance])

  // Refresh attendance every 30s
  useEffect(() => {
    const interval = setInterval(fetchAttendance, 30_000)
    return () => clearInterval(interval)
  }, [fetchAttendance])

  const scanUrl = token && activeBusiness
    ? `${window.location.origin}/scan?token=${token}&bizId=${activeBusiness.id}`
    : ''

  const secsLeft    = Math.ceil(timeLeft / 1000)
  const inNow       = attendance.filter(a => !a.clockOut)
  const donToday    = attendance.filter(a => a.clockOut)

  if (!bizIsRegistered) {
    return (
      <div className="flex flex-col min-h-full">
        <TopBar title="QR Docházka" />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-slate-500 dark:text-slate-400">QR docházka je dostupná pouze pro registrované podniky.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="QR Docházka" subtitle="Tabletový displej pro zaměstnance" />

      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-8">

          {/* QR kód panel */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-8 flex flex-col items-center gap-6">
            <div className="text-center">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{activeBusiness?.name}</h2>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
                {format(now, 'EEEE d. MMMM', { locale: cs })}
              </p>
              <p className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                {format(now, 'HH:mm:ss')}
              </p>
            </div>

            {loading ? (
              <div className="w-[280px] h-[280px] bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-slate-300 dark:text-slate-600 animate-spin" />
              </div>
            ) : scanUrl ? (
              <div className="p-4 bg-white rounded-2xl shadow-inner border border-slate-100">
                <QRCode value={scanUrl} size={260} />
              </div>
            ) : null}

            {/* Countdown */}
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${secsLeft > 30 ? 'bg-green-400' : secsLeft > 10 ? 'bg-amber-400' : 'bg-red-400'} animate-pulse`} />
              <span className="text-slate-500 dark:text-slate-400">
                Nový kód za <span className="font-bold tabular-nums text-slate-700 dark:text-slate-300">{secsLeft}s</span>
              </span>
              <button
                onClick={() => { fetchToken(); fetchAttendance() }}
                className="ml-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                title="Obnovit"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
              Naskenuj telefonem pro záznam příchodu nebo odchodu
            </p>
          </div>

          {/* Dnešní docházka */}
          <div className="space-y-4">

            {/* Aktuálně v práci */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Aktuálně v práci</h3>
                </div>
                <span className="text-xs font-bold text-green-600 dark:text-green-400">{inNow.length}</span>
              </div>
              {inNow.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-400 dark:text-slate-500 text-center">Nikdo není přihlášen</p>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {inNow.map(r => (
                    <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-green-700 dark:text-green-400">
                          {r.employeeName.split(' ').map((p: string) => p[0]).slice(0, 2).join('')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{r.employeeName}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">od {r.clockIn}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                        <Clock className="w-3 h-3" />
                        {(() => {
                          const [ih, im] = r.clockIn.split(':').map(Number)
                          const mins = Math.floor((Date.now() - new Date().setHours(ih, im, 0, 0)) / 60000)
                          return `${Math.floor(mins / 60)}h ${mins % 60}m`
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dnes odpracovali */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Dnes odpracovali</h3>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500">{donToday.length} zaměstnanců</span>
              </div>
              {donToday.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-400 dark:text-slate-500 text-center">Zatím nikdo neodešel</p>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {donToday.map(r => (
                    <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {r.employeeName.split(' ').map((p: string) => p[0]).slice(0, 2).join('')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{r.employeeName}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{r.clockIn} – {r.clockOut}</p>
                      </div>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{r.hours}h</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
