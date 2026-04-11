'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO } from 'date-fns'
import { cs } from 'date-fns/locale'
import { TopBar } from '@/components/layout/TopBar'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch } from '@/contexts/BranchContext'
import { isRegistered, getShiftsForBusiness, getEmployeesForBusiness, getLogsForEmployee, getLogsForBusiness } from '@/lib/db'
import { BranchSwitcher } from '@/components/shared/BranchSwitcher'
import type { Shift, User } from '@/types'
import type { WorkLog } from '@/lib/work-logs'
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
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [employees, setEmployees] = useState<User[]>([])
  const [loading, setLoading] = useState(false)

  // Filters
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [selectedEmpId, setSelectedEmpId] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    if (!activeBusiness || !user) return
    setLoading(true)
    Promise.all([
      getShiftsForBusiness(activeBusiness.id),
      isManager ? getEmployeesForBusiness(activeBusiness.id) : Promise.resolve([]),
      isManager
        ? getLogsForBusiness(activeBusiness.id, month)
        : getLogsForEmployee(user.id, activeBusiness.id),
    ]).then(([s, e, logs]) => {
      setShifts(s)
      setEmployees(e)
      setWorkLogs(logs)
    }).finally(() => setLoading(false))
  }, [activeBusiness?.id, user?.id, month])

  // Unified history: combine WorkLogs + past Shifts into one list
  interface HistoryEntry {
    id: string
    date: string
    startTime: string
    endTime: string
    hours: number
    employeeId: string
    employeeName: string
    employeeColor?: string
    roleNeeded?: string
    source: 'worklog' | 'shift'
    notes?: string
    isActual?: boolean
  }

  const historyEntries = useMemo(() => {
    const effectiveFrom = dateFrom || `${month}-01`
    const effectiveTo = dateTo || format(endOfMonth(parseISO(`${month}-01`)), 'yyyy-MM-dd')
    const entries: HistoryEntry[] = []
    const usedDates = new Set<string>() // track worklog dates per employee to avoid duplicates

    // 1. WorkLogs first (these are the primary source — manually logged hours)
    let filteredLogs = [...workLogs].filter(l => l.date >= effectiveFrom && l.date <= effectiveTo)
    if (!isManager) {
      filteredLogs = filteredLogs.filter(l => l.employeeId === user?.id)
    } else if (selectedEmpId !== 'all') {
      filteredLogs = filteredLogs.filter(l => l.employeeId === selectedEmpId)
    }

    filteredLogs.forEach(l => {
      usedDates.add(`${l.employeeId}-${l.date}`)
      const emp = employees.find(e => e.id === l.employeeId)
      entries.push({
        id: l.id,
        date: l.date,
        startTime: l.clockIn,
        endTime: l.clockOut,
        hours: l.hours,
        employeeId: l.employeeId,
        employeeName: l.employeeName,
        employeeColor: emp?.color,
        notes: l.notes,
        source: 'worklog',
      })
    })

    // 2. Past shifts (only if no worklog exists for that employee+date)
    const today = format(new Date(), 'yyyy-MM-dd')
    let filteredShifts = shifts.filter(s => {
      const isPast = s.date < today
      const isCompleted = s.status === 'completed'
      return (isPast && s.assignedEmployee) || isCompleted
    }).filter(s => s.date >= effectiveFrom && s.date <= effectiveTo)

    if (activeBranch) {
      filteredShifts = filteredShifts.filter(s => s.branchId === activeBranch.id)
    }
    if (!isManager) {
      filteredShifts = filteredShifts.filter(s => s.assignedEmployee?.id === user?.id)
    } else if (selectedEmpId !== 'all') {
      filteredShifts = filteredShifts.filter(s => s.assignedEmployee?.id === selectedEmpId)
    }

    filteredShifts.forEach(s => {
      if (!s.assignedEmployee) return
      // Skip if worklog already covers this day for this employee
      if (usedDates.has(`${s.assignedEmployee.id}-${s.date}`)) return
      const start = s.actualStart ?? s.startTime
      const end = s.actualEnd ?? s.endTime
      entries.push({
        id: s.id,
        date: s.date,
        startTime: start,
        endTime: end,
        hours: getHours(start, end),
        employeeId: s.assignedEmployee.id,
        employeeName: s.assignedEmployee.name,
        employeeColor: s.assignedEmployee.color,
        roleNeeded: s.roleNeeded,
        source: 'shift',
        isActual: !!(s.actualStart && s.actualEnd),
      })
    })

    return entries.sort((a, b) => b.date.localeCompare(a.date))
  }, [shifts, workLogs, activeBranch, selectedEmpId, month, dateFrom, dateTo, user?.id, isManager, employees])

  // Stats
  const totalHours = useMemo(() => {
    return historyEntries.reduce((acc, e) => acc + e.hours, 0)
  }, [historyEntries])

  // Per-employee summary (for manager)
  const empSummary = useMemo(() => {
    if (!isManager) return []
    const map: Record<string, { user: User; hours: number; count: number }> = {}
    historyEntries.forEach(e => {
      if (!map[e.employeeId]) {
        const emp = employees.find(u => u.id === e.employeeId)
        map[e.employeeId] = {
          user: emp ?? { id: e.employeeId, name: e.employeeName, email: '', role: 'employee', color: e.employeeColor },
          hours: 0, count: 0,
        }
      }
      map[e.employeeId].hours += e.hours
      map[e.employeeId].count++
    })
    return Object.values(map).sort((a, b) => b.hours - a.hours)
  }, [historyEntries, isManager, employees])

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
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{historyEntries.length}</p>
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
          ) : historyEntries.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">Žádné odpracované hodiny v tomto období.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    {isManager && <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Zaměstnanec</th>}
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Datum</th>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Čas</th>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Zdroj</th>
                    <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Hodiny</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {historyEntries.map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      {isManager && (
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2">
                            <UserAvatar name={entry.employeeName} color={entry.employeeColor} size="sm" />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{entry.employeeName}</span>
                          </div>
                        </td>
                      )}
                      <td className="px-5 py-2.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {format(parseISO(entry.date), 'EEE d. M. yyyy', { locale: cs })}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {entry.startTime}–{entry.endTime}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-slate-500">
                        {entry.source === 'worklog' ? (
                          <span className="text-indigo-500 font-medium">Záznam</span>
                        ) : (
                          <span>{entry.roleNeeded ?? 'Směna'}</span>
                        )}
                        {entry.notes && <span className="text-slate-400 ml-1">· {entry.notes}</span>}
                      </td>
                      <td className="px-5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 text-right">{entry.hours}h</td>
                    </tr>
                  ))}
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
