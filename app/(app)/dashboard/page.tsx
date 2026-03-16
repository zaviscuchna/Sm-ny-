'use client'

import { useMemo, useState, useEffect } from 'react'
import { format, addDays, startOfWeek } from 'date-fns'
import { cs } from 'date-fns/locale'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { ShiftStatusBadge } from '@/components/shared/ShiftStatusBadge'
import { WelcomeModal } from '@/components/shared/WelcomeModal'
import { SHIFTS, EMPLOYEES, SHIFT_APPLICATIONS, getDayCoverage } from '@/lib/mock-data'
import { isRegistered, getShiftsForBusiness, getEmployeesForBusiness } from '@/lib/db'
import type { Shift, User } from '@/types'
import { CalendarDays, Users, AlertTriangle, Clock, CheckCircle2, XCircle, ChevronRight, Plus, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const DAYS_CZ = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So']

function getHours(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh + em / 60) - (sh + sm / 60)
}

function computeCoverage(shifts: Shift[], dateStr: string): 'full' | 'partial' | 'empty' {
  const day = shifts.filter(s => s.date === dateStr)
  if (day.length === 0) return 'empty'
  const open = day.filter(s => s.status === 'open').length
  if (open === 0) return 'full'
  if (open < day.length) return 'partial'
  return 'empty'
}

interface FlatApp {
  id: string; shiftId: string; employeeId: string; employeeName: string
  status: string; createdAt: string; shiftDate: string; startTime: string; endTime: string; roleNeeded: string
}

export default function DashboardPage() {
  const { user, activeBusiness } = useAuth()
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const bizIsRegistered = isRegistered(activeBusiness?.id ?? '')

  // ── Real data state ───────────────────────────────────────────────────────
  const [realShifts,    setRealShifts]    = useState<Shift[]>([])
  const [realEmployees, setRealEmployees] = useState<User[]>([])
  const [realApps,      setRealApps]      = useState<FlatApp[]>([])
  const [loading,       setLoading]       = useState(false)

  useEffect(() => {
    if (!activeBusiness) return
    if (!bizIsRegistered) return
    setLoading(true)
    Promise.all([
      getShiftsForBusiness(activeBusiness.id),
      getEmployeesForBusiness(activeBusiness.id),
      fetch(`/api/shift-applications?bizId=${activeBusiness.id}`).then(r => r.json()).catch(() => []),
    ]).then(([shifts, emps, apps]) => {
      setRealShifts(shifts)
      setRealEmployees(emps)
      setRealApps((apps as FlatApp[]).filter(a => a.status === 'pending'))
    }).finally(() => setLoading(false))
  }, [activeBusiness?.id])

  // ── Source data (real vs mock) ────────────────────────────────────────────
  const shifts    = bizIsRegistered ? realShifts    : SHIFTS
  const employees = bizIsRegistered ? realEmployees : EMPLOYEES
  const [pendingApps, setPendingApps] = useState<FlatApp[]>([])

  useEffect(() => {
    if (bizIsRegistered) {
      setPendingApps(realApps)
    } else {
      setPendingApps(SHIFT_APPLICATIONS.filter(a => a.status === 'pending').map(a => ({
        id: a.id, shiftId: a.shift.id, employeeId: a.employee.id, employeeName: a.employee.name,
        status: a.status, createdAt: a.createdAt, shiftDate: a.shift.date,
        startTime: a.shift.startTime, endTime: a.shift.endTime, roleNeeded: a.shift.roleNeeded,
      })))
    }
  }, [realApps, bizIsRegistered])

  const todayShifts = shifts.filter(s => s.date === todayStr)
  const openShifts  = shifts.filter(s => s.status === 'open')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // ── Weekly coverage bar ───────────────────────────────────────────────────
  const coverageBar = useMemo(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i)
      const dateStr = format(d, 'yyyy-MM-dd')
      const coverage = bizIsRegistered
        ? computeCoverage(shifts, dateStr)
        : getDayCoverage(dateStr).coverage
      return { day: DAYS_CZ[d.getDay()], coverage, dateStr }
    })
  }, [shifts, bizIsRegistered])

  const shortDays = coverageBar.filter(d => d.coverage !== 'full').length

  const employeeHoursMap = useMemo(() => {
    return employees.reduce<Record<string, number>>((acc, e) => {
      acc[e.id] = shifts.filter(s => s.assignedEmployee?.id === e.id)
        .reduce((h, s) => h + getHours(s.startTime, s.endTime), 0)
      return acc
    }, {})
  }, [shifts, employees])

  // ── Approve / Reject ──────────────────────────────────────────────────────
  const handleApprove = async (app: FlatApp) => {
    if (bizIsRegistered) {
      await fetch('/api/shift-applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: app.id, status: 'approved', shiftId: app.shiftId, employeeId: app.employeeId }),
      })
      // Refresh shifts to reflect new assignment
      getShiftsForBusiness(activeBusiness!.id).then(setRealShifts)
      setPendingApps(prev => prev.filter(a => a.shiftId !== app.shiftId))
    } else {
      setPendingApps(prev => prev.filter(a => a.id !== app.id))
    }
    toast.success('Přihláška schválena')
  }

  const handleReject = async (id: string) => {
    if (bizIsRegistered) {
      await fetch('/api/shift-applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'rejected' }),
      })
    }
    setPendingApps(prev => prev.filter(a => a.id !== id))
    toast.error('Přihláška zamítnuta')
  }

  // ── Empty state for new registered businesses ─────────────────────────────
  const isEmpty = bizIsRegistered && !loading && shifts.length === 0 && employees.length === 0

  if (isEmpty) {
    return (
      <div className="flex flex-col min-h-full">
        <WelcomeModal />
        <TopBar title="Dashboard" subtitle={`Dobrý den, ${user?.name?.split(' ')[0]}`} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center space-y-8">
            <div>
              <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                <CalendarDays className="w-8 h-8 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Začni plánovat</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                Podnik <strong>{activeBusiness?.name}</strong> je připraven.<br />
                Vytvoř první směnu nebo pozvi zaměstnance.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/shifts" className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-indigo-100 hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div className="text-sm font-semibold text-slate-800">Nová směna</div>
                <div className="text-xs text-slate-400">Naplánuj první den</div>
              </Link>
              <Link href="/employees" className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-slate-100 hover:border-indigo-200 hover:bg-slate-50 transition-all">
                <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-slate-600" />
                </div>
                <div className="text-sm font-semibold text-slate-800">Pozvat tým</div>
                <div className="text-xs text-slate-400">Sdílej kód podniku</div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const stats = [
    { label: 'Dnešní směny',     value: todayShifts.length, sub: `${todayShifts.filter(s => s.status !== 'open').length} obsazeno`, icon: CalendarDays, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Otevřené směny',   value: openShifts.length,  sub: 'čeká na obsazení',  icon: Clock,         color: 'text-amber-600',  bg: 'bg-amber-50'  },
    { label: 'Dny s nedostatkem',value: shortDays,           sub: 'tento týden',        icon: AlertTriangle,  color: 'text-red-500',    bg: 'bg-red-50'    },
    { label: 'Zaměstnanci',      value: employees.length,    sub: 'aktivní',            icon: Users,          color: 'text-green-600',  bg: 'bg-green-50'  },
  ]

  return (
    <div className="flex flex-col min-h-full">
      <WelcomeModal />
      <TopBar title="Dashboard" subtitle={`Dobrý den, ${user?.name?.split(' ')[0]} 👋`} />

      <div className="flex-1 p-4 md:p-8 space-y-6 md:space-y-8 max-w-6xl">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-medium text-slate-500">{s.label}</p>
                <div className={`${s.bg} ${s.color} p-1.5 rounded-lg`}>
                  <s.icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900 leading-none">{s.value}</p>
              <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Weekly coverage */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Pokrytí tento týden</h2>
          <div className="flex gap-2">
            {coverageBar.map(({ day, coverage, dateStr }) => {
              const isToday    = dateStr === todayStr
              const isSelected = selectedDay === dateStr
              return (
                <button key={dateStr} onClick={() => setSelectedDay(isSelected ? null : dateStr)} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <div className={`w-full rounded-lg h-10 transition-all ${
                    coverage === 'full'    ? 'bg-green-400 group-hover:bg-green-500' :
                    coverage === 'partial' ? 'bg-amber-400 group-hover:bg-amber-500' :
                                             'bg-red-300 group-hover:bg-red-400'
                  } ${isSelected ? 'ring-2 ring-offset-1 ring-indigo-500 scale-105' : ''}`} />
                  <span className={`text-[11px] font-semibold ${isSelected ? 'text-indigo-600' : isToday ? 'text-indigo-500' : 'text-slate-400'}`}>
                    {day}
                    {isToday && <span className="block w-1 h-1 rounded-full bg-indigo-500 mx-auto mt-0.5" />}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex gap-4 mt-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-400 inline-block" /> Plné</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" /> Částečné</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-300 inline-block" /> Chybí pokrytí</span>
          </div>

          {selectedDay && (() => {
            const dayShifts = shifts.filter(s => s.date === selectedDay)
            const { day: dayLabel } = coverageBar.find(d => d.dateStr === selectedDay)!
            return (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-600">
                    {dayLabel} — {format(new Date(selectedDay + 'T12:00:00'), 'd. MMMM', { locale: cs })}
                  </p>
                  <button onClick={() => setSelectedDay(null)} className="text-slate-300 hover:text-slate-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {dayShifts.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">Žádné směny tento den.</p>
                ) : (
                  <div className="space-y-2">
                    {dayShifts.map(shift => (
                      <div key={shift.id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2">
                        {shift.assignedEmployee ? (
                          <UserAvatar name={shift.assignedEmployee.name} color={shift.assignedEmployee.color} size="sm" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                            <Users className="w-3 h-3 text-slate-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {shift.assignedEmployee?.name ?? <span className="text-slate-400 font-normal">Volná pozice</span>}
                          </p>
                          <p className="text-[11px] text-slate-400">{shift.roleNeeded} · {shift.startTime}–{shift.endTime}</p>
                        </div>
                        <ShiftStatusBadge status={shift.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Today's shifts */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Dnešní směny</h2>
              <span className="text-xs text-slate-400">{format(new Date(), 'd. M. yyyy', { locale: cs })}</span>
            </div>
            {todayShifts.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400">Dnes žádné směny.</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {todayShifts.map(shift => (
                  <div key={shift.id} className="flex items-center gap-3 px-6 py-3.5">
                    {shift.assignedEmployee ? (
                      <UserAvatar name={shift.assignedEmployee.name} color={shift.assignedEmployee.color} size="md" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {shift.assignedEmployee?.name ?? 'Volná pozice'}
                      </p>
                      <p className="text-xs text-slate-400">{shift.roleNeeded} · {shift.startTime}–{shift.endTime}</p>
                    </div>
                    <ShiftStatusBadge status={shift.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending applications */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Čekající přihlášky</h2>
              {pendingApps.length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {pendingApps.length}
                </span>
              )}
            </div>
            {pendingApps.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400">Žádné čekající přihlášky.</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {pendingApps.map(app => (
                  <div key={app.id} className="flex items-center gap-3 px-6 py-3.5">
                    <UserAvatar name={app.employeeName} color="#6366f1" size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{app.employeeName}</p>
                      <p className="text-xs text-slate-400">
                        {app.roleNeeded} · {app.shiftDate} {app.startTime}–{app.endTime}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleApprove(app)} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="Schválit">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleReject(app.id)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors" title="Zamítnout">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Employee overview */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">Přehled zaměstnanců</h2>
            <a href="/employees" className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              Zobrazit vše <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
          {employees.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-400">
              Zatím žádní zaměstnanci.{' '}
              <Link href="/employees" className="text-indigo-500 hover:text-indigo-700">Pozvi tým →</Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {employees.map(emp => {
                const hours = employeeHoursMap[emp.id] ?? 0
                const shiftsCount = shifts.filter(s => s.assignedEmployee?.id === emp.id).length
                return (
                  <div key={emp.id} className="flex items-center gap-3 px-6 py-3">
                    <UserAvatar name={emp.name} color={emp.color} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{emp.name}</p>
                      <p className="text-xs text-slate-400">{shiftsCount} směn</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-800">{hours}h</p>
                      <p className="text-[10px] text-slate-400">hodin</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
