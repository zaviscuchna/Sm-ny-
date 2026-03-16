'use client'

import { useState, useMemo, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { cs } from 'date-fns/locale'
import { TopBar } from '@/components/layout/TopBar'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { ShiftStatusBadge } from '@/components/shared/ShiftStatusBadge'
import { SHIFTS, getWeeklyHours } from '@/lib/mock-data'
import { getEmployeesForBusiness, getLogsForBusiness, isRegistered, getShiftsForBusiness } from '@/lib/db'
import { sumHours, seedDemoLogs } from '@/lib/work-logs'
import type { WorkLog } from '@/lib/work-logs'
import type { Shift, User } from '@/types'
import {
  Search, Phone, Mail, Copy, Check, Clock, CalendarDays,
  ChevronLeft, ChevronRight, Banknote, ChevronDown, ChevronUp, X,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

type SortKey = 'name' | 'hours'

function getHours(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh + em / 60) - (sh + sm / 60)
}

export default function EmployeesPage() {
  const { activeBusiness, joinCode: authJoinCode } = useAuth()
  const [search, setSearch]   = useState('')
  const [sortBy, setSortBy]   = useState<SortKey>('name')
  const [copied, setCopied]   = useState(false)
  const bizIsRegistered = isRegistered(activeBusiness?.id ?? '')

  const [baseEmployees, setBaseEmployees] = useState<User[]>([])
  const [bizShifts,     setBizShifts]     = useState<Shift[]>([])
  const [expandedEmp,   setExpandedEmp]   = useState<string | null>(null)

  // Load employees + shifts
  useEffect(() => {
    if (!activeBusiness) return
    Promise.all([
      getEmployeesForBusiness(activeBusiness.id),
      getShiftsForBusiness(activeBusiness.id),
    ]).then(([emps, shifts]) => {
      setBaseEmployees(emps)
      setBizShifts(shifts)
    })
  }, [activeBusiness?.id])

  // Seed demo logs once (only for demo businesses)
  useEffect(() => {
    if (!bizIsRegistered && baseEmployees.length > 0) {
      seedDemoLogs(baseEmployees.map(e => ({ id: e.id, name: e.name })))
    }
  }, [bizIsRegistered, baseEmployees.length])

  // ── Payroll state ─────────────────────────────────────────────────────────
  const [payrollMonth, setPayrollMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [monthLogs,    setMonthLogs]    = useState<WorkLog[]>([])

  useEffect(() => {
    if (!activeBusiness) return
    getLogsForBusiness(activeBusiness.id, payrollMonth).then(setMonthLogs)
  }, [activeBusiness?.id, payrollMonth])

  const prevPayrollMonth = () => {
    const [y, m] = payrollMonth.split('-').map(Number)
    setPayrollMonth(format(new Date(y, m - 2, 1), 'yyyy-MM'))
  }
  const nextPayrollMonth = () => {
    const [y, m] = payrollMonth.split('-').map(Number)
    const next = new Date(y, m, 1)
    if (next <= new Date()) setPayrollMonth(format(next, 'yyyy-MM'))
  }

  const joinCode = authJoinCode ?? '------'
  const copyCode = () => {
    navigator.clipboard.writeText(joinCode).then(() => {
      setCopied(true)
      toast.success('Kód zkopírován')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Employee stats (real vs mock) ─────────────────────────────────────────
  const sourceShifts = bizIsRegistered ? bizShifts : SHIFTS
  const empStats = useMemo(() => {
    return baseEmployees.map(emp => {
      const empShifts = sourceShifts.filter(s => s.assignedEmployee?.id === emp.id)
      const hours = bizIsRegistered
        ? empShifts.reduce((h, s) => h + getHours(s.startTime, s.endTime), 0)
        : getWeeklyHours(emp.id)
      return { ...emp, hours, shiftsCount: empShifts.length }
    })
  }, [baseEmployees, sourceShifts, bizIsRegistered])

  const filtered = useMemo(() => {
    let result = [...empStats]
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.phone ?? '').includes(q)
      )
    }
    result.sort((a, b) => {
      if (sortBy === 'hours') return b.hours - a.hours
      return a.name.localeCompare(b.name, 'cs')
    })
    return result
  }, [search, sortBy, empStats])

  const totalHours = filtered.reduce((s, e) => s + e.hours, 0)

  // ── Unassign employee from a shift ────────────────────────────────────────
  const handleUnassign = async (shiftId: string) => {
    if (!bizIsRegistered) return
    await fetch('/api/shifts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: shiftId, assignedEmployeeId: null, status: 'open' }),
    })
    setBizShifts(prev => prev.map(s => s.id === shiftId
      ? { ...s, assignedEmployee: undefined, status: 'open' }
      : s
    ))
    toast.success('Přiřazení zrušeno')
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Zaměstnanci" subtitle={`${baseEmployees.length} zaměstnanců`} />

      <div className="flex-1 p-4 md:p-8 max-w-5xl">

        {/* Invite banner */}
        <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-2xl px-4 md:px-5 py-4 mb-5">
          <div>
            <p className="text-sm font-semibold text-indigo-900">Pozvat zaměstnance</p>
            <p className="text-xs text-indigo-500 mt-0.5 hidden sm:block">Sdílej kód podniku — zaměstnanec ho zadá při registraci</p>
          </div>
          <button onClick={copyCode} className="flex items-center gap-2 bg-white border border-indigo-200 hover:border-indigo-400 rounded-xl px-4 py-2 transition-all">
            <span className="font-mono text-lg font-bold text-indigo-700 tracking-widest">{joinCode}</span>
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-indigo-400" />}
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Zaměstnanců',   value: baseEmployees.length },
            { label: 'Přiřazených směn', value: sourceShifts.filter(s => s.status !== 'open').length },
            { label: 'Hodin celkem',  value: `${totalHours.toFixed(0)}h` },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
              <p className="text-[11px] text-slate-400 mb-0.5">{s.label}</p>
              <p className="text-xl md:text-2xl font-bold text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input placeholder="Hledat zaměstnance…" value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 border-slate-200 focus-visible:ring-indigo-500 bg-white" />
          </div>
          <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-40 md:w-44 border-slate-200 bg-white shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Dle jména</SelectItem>
              <SelectItem value="hours">Dle hodin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Employee list */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 px-6 py-12 text-center">
              <p className="text-sm text-slate-400">
                {!search ? 'Zatím tu nejsou žádní zaměstnanci. Sdílej kód podniku výše.' : 'Žádný zaměstnanec neodpovídá hledání.'}
              </p>
            </div>
          ) : filtered.map(emp => {
            const isExpanded = expandedEmp === emp.id
            const empShifts = sourceShifts
              .filter(s => s.assignedEmployee?.id === emp.id)
              .sort((a, b) => a.date.localeCompare(b.date))
            const upcomingShifts = empShifts.filter(s => s.date >= todayStr)
            const pastShifts     = empShifts.filter(s => s.date < todayStr)
            const utilization    = Math.min(100, Math.round((emp.hours / 40) * 100))

            return (
              <div key={emp.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Employee row */}
                <button
                  onClick={() => setExpandedEmp(isExpanded ? null : emp.id)}
                  className="w-full text-left p-4 flex items-center gap-3 hover:bg-slate-50/50 transition-colors"
                >
                  <UserAvatar name={emp.name} color={emp.color} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900">{emp.name}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-500">Zaměstnanec</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />{emp.shiftsCount} směn
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{emp.hours.toFixed(0)}h
                      </span>
                      {emp.phone && (
                        <span className="text-xs text-slate-400 flex items-center gap-1 hidden sm:flex">
                          <Phone className="w-3 h-3" />{emp.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Utilization bar */}
                  <div className="hidden sm:flex flex-col items-end gap-1 w-20">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full ${utilization >= 75 ? 'bg-green-500' : utilization >= 40 ? 'bg-amber-400' : 'bg-slate-300'}`}
                        style={{ width: `${utilization}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400">{utilization}%</span>
                  </div>
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  }
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-4 space-y-4">

                    {/* Contact */}
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-300" />{emp.email}</span>
                      {emp.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-300" />{emp.phone}</span>}
                    </div>

                    {/* Upcoming shifts */}
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-indigo-500" />
                        Nadcházející směny ({upcomingShifts.length})
                      </p>
                      {upcomingShifts.length === 0 ? (
                        <p className="text-xs text-slate-400 pl-5">Žádné naplánované směny.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {upcomingShifts.map(shift => (
                            <div key={shift.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-slate-100">
                              <div className="flex-shrink-0 text-center w-8">
                                <p className="text-sm font-black text-slate-800 leading-none">{format(parseISO(shift.date), 'd')}</p>
                                <p className="text-[10px] text-slate-400 uppercase">{format(parseISO(shift.date), 'MMM', { locale: cs })}</p>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-800">{shift.roleNeeded}</p>
                                <p className="text-[11px] text-slate-400">{shift.startTime}–{shift.endTime} · {format(parseISO(shift.date), 'EEE', { locale: cs })}</p>
                              </div>
                              <ShiftStatusBadge status={shift.status} />
                              {bizIsRegistered && (
                                <button onClick={() => handleUnassign(shift.id)}
                                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Odebrat ze směny">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Past shifts */}
                    {pastShifts.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 mb-2">Minulé směny ({pastShifts.length})</p>
                        <div className="space-y-1.5">
                          {pastShifts.slice(-5).reverse().map(shift => (
                            <div key={shift.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2 border border-slate-100 opacity-60">
                              <div className="flex-shrink-0 text-center w-8">
                                <p className="text-sm font-black text-slate-600 leading-none">{format(parseISO(shift.date), 'd')}</p>
                                <p className="text-[10px] text-slate-400 uppercase">{format(parseISO(shift.date), 'MMM', { locale: cs })}</p>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-700">{shift.roleNeeded}</p>
                                <p className="text-[11px] text-slate-400">{shift.startTime}–{shift.endTime}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── PAYROLL SECTION ──────────────────────────────────────────────── */}
        <div className="mt-6">
          <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Banknote className="w-4 h-4 text-green-600" />
            Výplatní podklady — odpracované hodiny
          </h2>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <button onClick={prevPayrollMonth} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <p className="text-xs font-semibold text-slate-700 capitalize min-w-[100px] text-center">
                  {format(new Date(payrollMonth + '-01'), 'LLLL yyyy', { locale: cs })}
                </p>
                <button onClick={nextPayrollMonth} disabled={payrollMonth >= format(new Date(), 'yyyy-MM')}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Celkem: <span className="font-bold text-slate-700">{sumHours(monthLogs)}h</span>
              </p>
            </div>

            {baseEmployees.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">Žádní zaměstnanci.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {baseEmployees.map(emp => {
                  const empLogs = monthLogs.filter(l => l.employeeId === emp.id)
                  const total = sumHours(empLogs)
                  return (
                    <div key={emp.id} className="flex items-center gap-3 px-5 py-3.5">
                      <UserAvatar name={emp.name} color={emp.color} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{emp.name}</p>
                        <p className="text-xs text-slate-400">{empLogs.length} záznamů</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${total > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{total}h</p>
                        <p className="text-[10px] text-slate-400">odpracováno</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
