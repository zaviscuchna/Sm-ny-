'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO } from 'date-fns'
import { cs } from 'date-fns/locale'
import { TopBar } from '@/components/layout/TopBar'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch } from '@/contexts/BranchContext'
import { isRegistered, getShiftsForBusiness, getEmployeesForBusiness } from '@/lib/db'
import { BranchSwitcher } from '@/components/shared/BranchSwitcher'
import type { Shift, User } from '@/types'
import {
  Clock, CalendarDays, ChevronLeft, ChevronRight, Filter, Users,
} from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

function getHours(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.round(((eh + em / 60) - (sh + sm / 60)) * 10) / 10
}

export default function HistoryPage() {
  const { user, activeBusiness } = useAuth()
  const { activeBranch } = useBranch()
  const bizIsRegistered = isRegistered(activeBusiness?.id ?? '')
  const isManager = user?.role === 'manager' || user?.role === 'superadmin'

  const [shifts, setShifts] = useState<Shift[]>([])
  const [employees, setEmployees] = useState<User[]>([])
  const [loading, setLoading] = useState(false)

  // Filters
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [selectedEmpId, setSelectedEmpId] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    if (!activeBusiness) return
    setLoading(true)
    Promise.all([
      getShiftsForBusiness(activeBusiness.id),
      isManager ? getEmployeesForBusiness(activeBusiness.id) : Promise.resolve([]),
    ]).then(([s, e]) => {
      setShifts(s)
      setEmployees(e)
    }).finally(() => setLoading(false))
  }, [activeBusiness?.id])

  // Filter shifts to completed/past
  const historyShifts = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    let filtered = shifts.filter(s => {
      // Include completed shifts or past shifts that were assigned
      const isPast = s.date < today
      const isCompleted = s.status === 'completed'
      return (isPast && s.assignedEmployee) || isCompleted
    })

    // Branch filter
    if (activeBranch) {
      filtered = filtered.filter(s => s.branchId === activeBranch.id)
    }

    // Employee filter (for manager) or own shifts (for employee)
    if (!isManager) {
      filtered = filtered.filter(s => s.assignedEmployee?.id === user?.id)
    } else if (selectedEmpId !== 'all') {
      filtered = filtered.filter(s => s.assignedEmployee?.id === selectedEmpId)
    }

    // Date range filter
    const effectiveFrom = dateFrom || `${month}-01`
    const effectiveTo = dateTo || format(endOfMonth(parseISO(`${month}-01`)), 'yyyy-MM-dd')
    filtered = filtered.filter(s => s.date >= effectiveFrom && s.date <= effectiveTo)

    return filtered.sort((a, b) => b.date.localeCompare(a.date))
  }, [shifts, activeBranch, selectedEmpId, month, dateFrom, dateTo, user?.id, isManager])

  // Stats
  const totalHours = useMemo(() => {
    return historyShifts.reduce((acc, s) => {
      if (s.actualStart && s.actualEnd) return acc + getHours(s.actualStart, s.actualEnd)
      return acc + getHours(s.startTime, s.endTime)
    }, 0)
  }, [historyShifts])

  // Per-employee summary (for manager)
  const empSummary = useMemo(() => {
    if (!isManager) return []
    const map: Record<string, { user: User; hours: number; count: number }> = {}
    historyShifts.forEach(s => {
      if (!s.assignedEmployee) return
      if (!map[s.assignedEmployee.id]) {
        map[s.assignedEmployee.id] = { user: s.assignedEmployee, hours: 0, count: 0 }
      }
      const h = s.actualStart && s.actualEnd ? getHours(s.actualStart, s.actualEnd) : getHours(s.startTime, s.endTime)
      map[s.assignedEmployee.id].hours += h
      map[s.assignedEmployee.id].count++
    })
    return Object.values(map).sort((a, b) => b.hours - a.hours)
  }, [historyShifts, isManager])

  const prevMonth = () => {
    const d = subMonths(parseISO(`${month}-01`), 1)
    setMonth(format(d, 'yyyy-MM'))
    setDateFrom('')
    setDateTo('')
  }
  const nextMonth = () => {
    const d = addMonths(parseISO(`${month}-01`), 1)
    if (d <= new Date()) {
      setMonth(format(d, 'yyyy-MM'))
      setDateFrom('')
      setDateTo('')
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Historie" subtitle={isManager ? 'Odpracované hodiny' : 'Moje odpracované hodiny'} />

      <div className="flex-1 p-4 md:p-8 max-w-5xl space-y-6">

        {/* Filters bar */}
        <div className="flex flex-wrap gap-3 items-end">
          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 capitalize min-w-[120px] text-center">
              {format(parseISO(`${month}-01`), 'LLLL yyyy', { locale: cs })}
            </p>
            <button onClick={nextMonth} disabled={month >= format(new Date(), 'yyyy-MM')}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Employee filter (manager) */}
          {isManager && employees.length > 0 && (
            <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
              <SelectTrigger className="w-48 h-9 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <Users className="w-3.5 h-3.5 text-slate-400 mr-1" />
                <SelectValue placeholder="Všichni zaměstnanci" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všichni zaměstnanci</SelectItem>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Branch filter */}
          <BranchSwitcher className="w-48" />

          {/* Custom date range */}
          <div className="flex items-center gap-2">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="h-9 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 w-36" placeholder="Od" />
            <span className="text-xs text-slate-400">–</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="h-9 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 w-36" placeholder="Do" />
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm px-4 py-3">
            <p className="text-[11px] text-slate-400 mb-0.5">Celkem hodin</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{Math.round(totalHours * 10) / 10}h</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm px-4 py-3">
            <p className="text-[11px] text-slate-400 mb-0.5">Počet směn</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{historyShifts.length}</p>
          </div>
          {isManager && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm px-4 py-3">
              <p className="text-[11px] text-slate-400 mb-0.5">Zaměstnanců</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{empSummary.length}</p>
            </div>
          )}
        </div>

        {/* Per-employee summary (manager) */}
        {isManager && empSummary.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-50 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Souhrn podle zaměstnanců</h2>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {empSummary.map(({ user: emp, hours, count }) => (
                <div key={emp.id} className="flex items-center gap-3 px-5 py-3">
                  <UserAvatar name={emp.name} color={emp.color} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{emp.name}</p>
                    <p className="text-xs text-slate-400">{count} směn</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{Math.round(hours * 10) / 10}h</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed shift list */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-50 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Detailní přehled</h2>
          </div>
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">Načítám...</div>
          ) : historyShifts.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">Žádné odpracované směny v tomto období.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    {isManager && <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Zaměstnanec</th>}
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Datum</th>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Čas</th>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Pozice</th>
                    <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Hodiny</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {historyShifts.map(s => {
                    const hours = s.actualStart && s.actualEnd
                      ? getHours(s.actualStart, s.actualEnd)
                      : getHours(s.startTime, s.endTime)
                    const timeDisplay = s.actualStart && s.actualEnd
                      ? `${s.actualStart}–${s.actualEnd}`
                      : `${s.startTime}–${s.endTime}`
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        {isManager && (
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-2">
                              <UserAvatar name={s.assignedEmployee?.name ?? '?'} color={s.assignedEmployee?.color} size="sm" />
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{s.assignedEmployee?.name}</span>
                            </div>
                          </td>
                        )}
                        <td className="px-5 py-2.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {format(parseISO(s.date), 'EEE d. M. yyyy', { locale: cs })}
                        </td>
                        <td className="px-5 py-2.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {timeDisplay}
                          {s.actualStart && s.actualEnd && (
                            <span className="ml-1 text-[10px] text-green-500 font-medium">(skutečné)</span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-xs text-slate-500">{s.roleNeeded}</td>
                        <td className="px-5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 text-right">{hours}h</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td colSpan={isManager ? 4 : 3} className="px-5 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 text-right">
                      Celkem
                    </td>
                    <td className="px-5 py-3 text-sm font-bold text-indigo-600 dark:text-indigo-400 text-right">
                      {Math.round(totalHours * 10) / 10}h
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Monthly total for employee */}
        {!isManager && (
          <div className="bg-indigo-50/60 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/40 px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-800/40 flex items-center justify-center">
              <Clock className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Celkem za měsíc</p>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 capitalize">
                {format(parseISO(`${month}-01`), 'LLLL yyyy', { locale: cs })}
              </p>
            </div>
            <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{Math.round(totalHours * 10) / 10}h</p>
          </div>
        )}
      </div>
    </div>
  )
}
