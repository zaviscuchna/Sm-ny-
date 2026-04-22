'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { format, endOfMonth, parseISO, subMonths, addMonths } from 'date-fns'
import { cs } from 'date-fns/locale'
import { TopBar } from '@/components/layout/TopBar'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch } from '@/contexts/BranchContext'
import { isRegistered, getShiftsForBusiness, getEmployeesForBusiness, getLogsForBusiness, getLogsForEmployee } from '@/lib/db'
import type { Shift, User } from '@/types'
import type { WorkLog } from '@/lib/work-logs'
import {
  Calculator, ChevronLeft, ChevronRight, Printer, Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

function getHours(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.round(((eh + em / 60) - (sh + sm / 60)) * 10) / 10
}

export default function PayrollPage() {
  const { user, activeBusiness } = useAuth()
  const { activeBranch } = useBranch()
  const isManager = user?.role === 'manager' || user?.role === 'superadmin'
  const printRef = useRef<HTMLDivElement>(null)

  const [shifts, setShifts] = useState<Shift[]>([])
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [employees, setEmployees] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [detailUserId, setDetailUserId] = useState<string | null>(null)

  // Controls
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [selectedEmpId, setSelectedEmpId] = useState<string>(isManager ? 'all' : (user?.id ?? 'all'))
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [hourlyRate, setHourlyRate] = useState<string>('')

  useEffect(() => {
    if (!activeBusiness || !user) return
    setLoading(true)
    Promise.all([
      getShiftsForBusiness(activeBusiness.id, activeBranch?.id),
      isManager ? getEmployeesForBusiness(activeBusiness.id) : Promise.resolve([]),
      isManager
        ? getLogsForBusiness(activeBusiness.id, month)
        : getLogsForEmployee(user.id, activeBusiness.id),
    ]).then(([s, e, logs]) => {
      setShifts(s)
      setEmployees(e)
      setWorkLogs(logs)
    }).catch((err) => {
      console.error('Chyba při načítání dat:', err)
      toast.error('Nepodařilo se načíst data')
    }).finally(() => setLoading(false))
  }, [activeBusiness?.id, activeBranch?.id, user?.id, month])

  // Compute payroll data — combine WorkLogs + past Shifts
  const payrollData = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const effectiveFrom = dateFrom || `${month}-01`
    const effectiveTo = dateTo || format(endOfMonth(parseISO(`${month}-01`)), 'yyyy-MM-dd')

    const map: Record<string, { user: User; hours: number; entries: number }> = {}
    const usedDates = new Set<string>()

    // 1. WorkLogs (primary source)
    let filteredLogs = workLogs.filter(l => l.date >= effectiveFrom && l.date <= effectiveTo)
    if (!isManager) {
      filteredLogs = filteredLogs.filter(l => l.employeeId === user?.id)
    } else if (selectedEmpId !== 'all') {
      filteredLogs = filteredLogs.filter(l => l.employeeId === selectedEmpId)
    }

    filteredLogs.forEach(l => {
      usedDates.add(`${l.employeeId}-${l.date}`)
      if (!map[l.employeeId]) {
        const emp = employees.find(e => e.id === l.employeeId)
        map[l.employeeId] = {
          user: emp ?? { id: l.employeeId, name: l.employeeName, email: '', role: 'employee' as const },
          hours: 0, entries: 0,
        }
      }
      map[l.employeeId].hours += l.hours
      map[l.employeeId].entries++
    })

    // 2. Past shifts (only if no worklog for that employee+date)
    let filteredShifts = shifts.filter(s => {
      const isPast = s.date < today
      const isCompleted = s.status === 'completed'
      return (isPast && s.assignedEmployee) || isCompleted
    }).filter(s => s.date >= effectiveFrom && s.date <= effectiveTo)

    if (!isManager) {
      filteredShifts = filteredShifts.filter(s => s.assignedEmployee?.id === user?.id)
    } else if (selectedEmpId !== 'all') {
      filteredShifts = filteredShifts.filter(s => s.assignedEmployee?.id === selectedEmpId)
    }

    filteredShifts.forEach(s => {
      if (!s.assignedEmployee) return
      if (usedDates.has(`${s.assignedEmployee.id}-${s.date}`)) return
      const h = s.actualStart && s.actualEnd ? getHours(s.actualStart, s.actualEnd) : getHours(s.startTime, s.endTime)
      if (!map[s.assignedEmployee.id]) {
        map[s.assignedEmployee.id] = { user: s.assignedEmployee, hours: 0, entries: 0 }
      }
      map[s.assignedEmployee.id].hours += h
      map[s.assignedEmployee.id].entries++
    })

    return Object.values(map).sort((a, b) => a.user.name.localeCompare(b.user.name, 'cs'))
  }, [shifts, workLogs, month, dateFrom, dateTo, selectedEmpId, user?.id, isManager, employees])

  const totalHours = payrollData.reduce((acc, d) => acc + d.hours, 0)
  const rate = parseFloat(hourlyRate) || 0
  const totalPay = Math.round(totalHours * rate)

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

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Výplaty" subtitle="Kalkulačka výplat" />

      <div className="flex-1 p-4 md:p-8 max-w-4xl space-y-6">

        {/* Controls */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Month */}
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Období</Label>
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 capitalize min-w-[120px] text-center">
                  {format(parseISO(`${month}-01`), 'LLLL yyyy', { locale: cs })}
                </p>
                <button onClick={nextMonth} disabled={month >= format(new Date(), 'yyyy-MM')}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Employee */}
            {isManager && (
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Zaměstnanec</Label>
                <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                  <SelectTrigger className="w-48 h-9 text-xs border-slate-200 bg-white dark:bg-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všichni</SelectItem>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Custom dates */}
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Vlastní rozsah</Label>
              <div className="flex items-center gap-2">
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="h-9 text-xs border-slate-200 w-36" />
                <span className="text-xs text-slate-400">–</span>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="h-9 text-xs border-slate-200 w-36" />
              </div>
            </div>

            {/* Hourly rate */}
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Hodinová sazba (Kč)</Label>
              <Input
                type="number"
                min="0"
                step="10"
                placeholder="0"
                value={hourlyRate}
                onChange={e => setHourlyRate(e.target.value)}
                className="h-9 text-xs border-slate-200 w-28"
              />
            </div>
          </div>
        </div>

        {/* Results — printable area */}
        <div ref={printRef} className="print:p-8">
          {/* Print header (hidden on screen) */}
          <div className="hidden print:block mb-6">
            <h1 className="text-xl font-bold">Výplatní podklady</h1>
            <p className="text-sm text-slate-500">
              {activeBusiness?.name} · {format(parseISO(`${month}-01`), 'LLLL yyyy', { locale: cs })}
              {rate > 0 && ` · ${rate} Kč/hod`}
            </p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm px-4 py-3">
              <p className="text-[11px] text-slate-400">Celkem hodin</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{Math.round(totalHours * 10) / 10}h</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm px-4 py-3">
              <p className="text-[11px] text-slate-400">Sazba</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{rate > 0 ? `${rate} Kč` : '—'}</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border border-indigo-100 dark:border-indigo-800 shadow-sm px-4 py-3 col-span-2">
              <p className="text-[11px] text-indigo-500">Výplata celkem</p>
              <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                {rate > 0 ? `${totalPay.toLocaleString('cs-CZ')} Kč` : 'Zadej sazbu'}
              </p>
            </div>
          </div>

          {/* Rate=0 warning */}
          {!loading && payrollData.length > 0 && rate === 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 mb-4 text-xs text-amber-700 dark:text-amber-400 print:hidden">
              <Info className="w-4 h-4 flex-shrink-0" />
              <p>Zadej <strong>hodinovou sazbu</strong> výše, abychom ti spočítali výplatu.</p>
            </div>
          )}

          {/* Per-employee breakdown */}
          {loading ? (
            <div className="text-center py-10 text-sm text-slate-400">Načítám...</div>
          ) : payrollData.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm px-5 py-12 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-3">
                <Calculator className="w-5 h-5 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Žádné odpracované směny v tomto období</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
                Výplaty se počítají z dokončených směn a záznamů docházky. Vyber jiné období, nebo přidej směnu v <a href="/shifts" className="text-indigo-500 hover:underline">plánu směn</a>.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Zaměstnanec</th>
                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Směn</th>
                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Hodiny</th>
                      {rate > 0 && (
                        <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Výplata</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {payrollData.map(d => (
                      <tr
                        key={d.user.id}
                        onClick={() => setDetailUserId(d.user.id)}
                        className="hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer print:cursor-auto"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <UserAvatar name={d.user.name} color={d.user.color} size="sm" />
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{d.user.name}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 ml-auto print:hidden" />
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500 text-right">{d.entries}</td>
                        <td className="px-5 py-3 text-sm font-bold text-slate-800 dark:text-slate-200 text-right">
                          {Math.round(d.hours * 10) / 10}h
                        </td>
                        {rate > 0 && (
                          <td className="px-5 py-3 text-sm font-bold text-indigo-600 dark:text-indigo-400 text-right">
                            {Math.round(d.hours * rate).toLocaleString('cs-CZ')} Kč
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                      <td className="px-5 py-3 text-sm font-semibold text-slate-600 dark:text-slate-400">Celkem</td>
                      <td className="px-5 py-3 text-xs text-slate-500 text-right">
                        {payrollData.reduce((acc, d) => acc + d.entries, 0)}
                      </td>
                      <td className="px-5 py-3 text-sm font-bold text-slate-800 dark:text-slate-200 text-right">
                        {Math.round(totalHours * 10) / 10}h
                      </td>
                      {rate > 0 && (
                        <td className="px-5 py-3 text-sm font-bold text-indigo-600 dark:text-indigo-400 text-right">
                          {totalPay.toLocaleString('cs-CZ')} Kč
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Print button */}
        <div className="flex justify-end print:hidden">
          <Button onClick={handlePrint} variant="outline" className="gap-2 border-slate-200 text-slate-700 hover:bg-slate-50">
            <Printer className="w-4 h-4" />
            Exportovat / Vytisknout
          </Button>
        </div>
      </div>

      {/* Detail modal */}
      <EmployeeDetailModal
        open={detailUserId !== null}
        onClose={() => setDetailUserId(null)}
        user={payrollData.find(d => d.user.id === detailUserId)?.user ?? null}
        month={month}
        rate={rate}
        workLogs={workLogs.filter(l => l.employeeId === detailUserId)}
        shifts={shifts.filter(s => s.assignedEmployee?.id === detailUserId)}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    </div>
  )
}

interface DetailProps {
  open: boolean
  onClose: () => void
  user: User | null
  month: string
  rate: number
  workLogs: WorkLog[]
  shifts: Shift[]
  dateFrom: string
  dateTo: string
}

function EmployeeDetailModal({ open, onClose, user, month, rate, workLogs, shifts, dateFrom, dateTo }: DetailProps) {
  if (!user) return null

  const effectiveFrom = dateFrom || `${month}-01`
  const effectiveTo = dateTo || format(endOfMonth(parseISO(`${month}-01`)), 'yyyy-MM-dd')
  const today = format(new Date(), 'yyyy-MM-dd')

  // Combine worklogs + past shifts (avoiding double counting)
  const logsInRange = workLogs.filter(l => l.date >= effectiveFrom && l.date <= effectiveTo)
  const usedDates = new Set(logsInRange.map(l => l.date))
  const shiftsInRange = shifts.filter(s => {
    if (s.date < effectiveFrom || s.date > effectiveTo) return false
    if (usedDates.has(s.date)) return false
    return (s.date < today && s.assignedEmployee) || s.status === 'completed'
  })

  type Entry = { date: string; type: 'log' | 'shift'; start: string; end: string; hours: number; note?: string }
  const entries: Entry[] = [
    ...logsInRange.map((l): Entry => ({
      date: l.date, type: 'log', start: l.clockIn, end: l.clockOut, hours: l.hours, note: l.notes,
    })),
    ...shiftsInRange.map((s): Entry => {
      const [sh, sm] = (s.actualStart ?? s.startTime).split(':').map(Number)
      const [eh, em] = (s.actualEnd ?? s.endTime).split(':').map(Number)
      const hours = Math.round(((eh + em / 60) - (sh + sm / 60)) * 10) / 10
      return { date: s.date, type: 'shift', start: s.actualStart ?? s.startTime, end: s.actualEnd ?? s.endTime, hours, note: s.roleNeeded }
    }),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const totalHours = entries.reduce((acc, e) => acc + e.hours, 0)
  const totalPay = rate > 0 ? Math.round(totalHours * rate) : 0

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <DialogTitle className="flex items-center gap-3">
            <UserAvatar name={user.name} color={user.color} size="md" />
            <div>
              <div className="text-base font-bold text-slate-900 dark:text-slate-100">{user.name}</div>
              <div className="text-xs text-slate-400 dark:text-slate-500 font-normal">
                {format(parseISO(`${month}-01`), 'LLLL yyyy', { locale: cs })}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 grid grid-cols-3 gap-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-[10px] text-slate-400 uppercase">Záznamy</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{entries.length}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase">Hodin</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{Math.round(totalHours * 10) / 10}h</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase">Výplata</p>
            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
              {rate > 0 ? `${totalPay.toLocaleString('cs-CZ')} Kč` : '—'}
            </p>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {entries.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-400">Žádné záznamy v tomto období.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase text-[10px]">Datum</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase text-[10px]">Zdroj</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase text-[10px]">Čas</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-500 uppercase text-[10px]">Hodin</th>
                  {rate > 0 && <th className="px-4 py-2 text-right font-semibold text-slate-500 uppercase text-[10px]">Kč</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {entries.map((e, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                      {format(parseISO(e.date + 'T12:00:00'), 'EEE d. M.', { locale: cs })}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        e.type === 'log'
                          ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                          : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      }`}>
                        {e.type === 'log' ? 'docházka' : 'směna'}
                      </span>
                      {e.note && <span className="ml-2 text-slate-400 dark:text-slate-500 truncate">{e.note}</span>}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{e.start}–{e.end}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">{e.hours}h</td>
                    {rate > 0 && (
                      <td className="px-4 py-2 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                        {Math.round(e.hours * rate).toLocaleString('cs-CZ')} Kč
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
