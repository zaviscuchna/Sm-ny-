'use client'

import { useState, useMemo, useEffect } from 'react'
import { format, addDays, startOfWeek } from 'date-fns'
import { cs } from 'date-fns/locale'
import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { ShiftStatusBadge } from '@/components/shared/ShiftStatusBadge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { NewShiftDialog } from '@/components/shifts/NewShiftDialog'
import { getShiftsForBusiness, getEmployeesForBusiness } from '@/lib/db'
import type { Shift, User } from '@/types'
import { ChevronLeft, ChevronRight, Clock, User as UserIcon, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const DAY_LABELS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']

function getDuration(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const h = (eh + em / 60) - (sh + sm / 60)
  return `${h}h`
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'border-l-green-400 bg-green-50',
  assigned:  'border-l-blue-400 bg-blue-50',
  pending:   'border-l-amber-400 bg-amber-50',
  open:      'border-l-red-300 bg-red-50',
}

export default function ShiftsPage() {
  const { activeBusiness } = useAuth()
  const [weekOffset, setWeekOffset]       = useState(0)
  const [dbShifts,   setDbShifts]         = useState<Shift[]>([])
  const [extraShifts, setExtraShifts]     = useState<Shift[]>([])
  const [employees, setEmployees]         = useState<User[]>([])
  const [loadingShifts, setLoadingShifts] = useState(false)
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const [selectedDateStr, setSelectedDateStr] = useState(todayStr)

  // Load shifts + employees whenever the active business changes
  useEffect(() => {
    if (!activeBusiness) return
    setLoadingShifts(true)
    setExtraShifts([])
    Promise.all([
      getShiftsForBusiness(activeBusiness.id),
      getEmployeesForBusiness(activeBusiness.id),
    ]).then(([shifts, emps]) => {
      setDbShifts(shifts)
      setEmployees(emps)
    }).finally(() => setLoadingShifts(false))
  }, [activeBusiness?.id])

  const weekStart = useMemo(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
    return addDays(monday, weekOffset * 7)
  }, [weekOffset])

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i)
      return { date, dateStr: format(date, 'yyyy-MM-dd'), label: DAY_LABELS[i], dayNum: date.getDate() }
    }),
  [weekStart])

  // Keep selected day inside current week
  useEffect(() => {
    const inWeek = weekDays.some(d => d.dateStr === selectedDateStr)
    if (!inWeek) setSelectedDateStr(weekDays[0].dateStr)
  }, [weekDays, selectedDateStr])

  const allShifts = [...dbShifts, ...extraShifts]

  const handleShiftsCreated = (shifts: Shift[]) => {
    setExtraShifts(prev => [...prev, ...shifts])
  }

  const selectedDayShifts = allShifts.filter(s => s.date === selectedDateStr)

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Plán směn" subtitle="Týdenní přehled" />

      {/* ── WEEK NAV (shared) ───────────────────────────────────────────── */}
      <div className="px-4 md:px-8 pt-5 pb-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 border-slate-200"
            onClick={() => setWeekOffset(o => o - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-sm font-semibold text-slate-700 px-1">
            {format(weekStart, 'd. M.', { locale: cs })} — {format(addDays(weekStart, 6), 'd. M. yyyy', { locale: cs })}
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8 border-slate-200"
            onClick={() => setWeekOffset(o => o + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-indigo-600 hidden sm:inline-flex"
              onClick={() => setWeekOffset(0)}>
              Tento týden
            </Button>
          )}
        </div>
        <NewShiftDialog employees={employees} onShiftsCreated={handleShiftsCreated} />
      </div>

      {/* ── MOBILE VIEW ─────────────────────────────────────────────────── */}
      <div className="md:hidden flex flex-col flex-1">

        {/* Day pill selector */}
        <div className="flex gap-2 px-4 py-4 overflow-x-auto no-scrollbar">
          {weekDays.map(({ dateStr, label, dayNum }) => {
            const isActive = dateStr === selectedDateStr
            const isToday  = dateStr === todayStr
            const hasShifts = allShifts.some(s => s.date === dateStr)
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDateStr(dateStr)}
                className={`flex flex-col items-center gap-1 px-3.5 py-2.5 rounded-2xl shrink-0 transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                    : 'bg-white border border-slate-100 text-slate-600 hover:border-indigo-200'
                }`}
              >
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {label}
                </span>
                <span className={`text-lg font-black leading-none ${isToday && !isActive ? 'text-indigo-600' : ''}`}>
                  {dayNum}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  hasShifts
                    ? isActive ? 'bg-indigo-300' : 'bg-indigo-400'
                    : 'bg-transparent'
                }`} />
              </button>
            )
          })}
        </div>

        {/* Selected day shifts */}
        <div className="flex-1 px-4 pb-6 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-slate-700">
              {format(new Date(selectedDateStr + 'T12:00:00'), 'EEEE d. MMMM', { locale: cs })}
            </h2>
            <span className="text-xs text-slate-400">{selectedDayShifts.length} směn</span>
          </div>

          {selectedDayShifts.length === 0 ? (
            <NewShiftDialog
              defaultDate={selectedDateStr}
              employees={employees} onShiftsCreated={handleShiftsCreated}
              trigger={
                <button className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-10 flex flex-col items-center gap-2 text-slate-400 hover:border-indigo-300 hover:text-indigo-400 transition-all">
                  <div className="w-10 h-10 rounded-full border-2 border-dashed border-current flex items-center justify-center">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium">Přidat směnu</span>
                </button>
              }
            />
          ) : (
            <>
              {selectedDayShifts.map(shift => (
                <MobileShiftCard key={shift.id} shift={shift} />
              ))}
              <NewShiftDialog
                defaultDate={selectedDateStr}
                employees={employees} onShiftsCreated={handleShiftsCreated}
                trigger={
                  <button className="w-full flex items-center justify-center gap-2 border border-dashed border-slate-200 rounded-2xl py-3 text-sm text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-all">
                    <Plus className="w-4 h-4" /> Přidat další směnu
                  </button>
                }
              />
            </>
          )}
        </div>
      </div>

      {/* ── DESKTOP VIEW ────────────────────────────────────────────────── */}
      <div className="hidden md:block flex-1 p-8">
        <div className="grid grid-cols-7 gap-3">
          {weekDays.map(({ dateStr, label, dayNum }) => {
            const dayShifts = allShifts.filter(s => s.date === dateStr)
            const isToday = dateStr === todayStr

            return (
              <div key={dateStr} className="flex flex-col gap-2">
                <div className={`text-center pb-2 border-b ${isToday ? 'border-indigo-300' : 'border-slate-100'}`}>
                  <p className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {label}
                  </p>
                  <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold mt-0.5 ${
                    isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'
                  }`}>
                    {dayNum}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  {dayShifts.length === 0 ? (
                    <NewShiftDialog defaultDate={dateStr} employees={employees} onShiftsCreated={handleShiftsCreated}
                      trigger={
                        <button className="w-full h-16 border-2 border-dashed border-slate-100 rounded-xl text-slate-300 hover:border-indigo-200 hover:text-indigo-400 transition-all text-xs flex flex-col items-center justify-center gap-1">
                          <span className="text-lg leading-none">+</span>
                        </button>
                      }
                    />
                  ) : (
                    <>
                      {dayShifts.map(shift => <DesktopShiftCard key={shift.id} shift={shift} />)}
                      <NewShiftDialog defaultDate={dateStr} employees={employees} onShiftsCreated={handleShiftsCreated}
                        trigger={
                          <button className="w-full h-7 border border-dashed border-slate-100 rounded-lg text-slate-300 hover:border-indigo-200 hover:text-indigo-400 transition-all text-xs flex items-center justify-center">
                            <span className="text-sm leading-none">+</span>
                          </button>
                        }
                      />
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Mobile shift card ────────────────────────────────────────────────────────

function MobileShiftCard({ shift }: { shift: Shift }) {
  const accent: Record<string, string> = {
    confirmed: 'border-l-green-400',
    assigned:  'border-l-blue-400',
    pending:   'border-l-amber-400',
    open:      'border-l-red-400',
  }
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 border-l-4 ${accent[shift.status] ?? 'border-l-slate-200'} shadow-sm p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 mb-0.5">{shift.roleNeeded}</p>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
            <Clock className="w-3 h-3 text-slate-400" />
            {shift.startTime} – {shift.endTime}
            <span className="text-slate-300">·</span>
            <span className="font-medium text-slate-600">{getDuration(shift.startTime, shift.endTime)}</span>
          </div>
          {shift.assignedEmployee ? (
            <div className="flex items-center gap-2">
              <UserAvatar name={shift.assignedEmployee.name} color={shift.assignedEmployee.color} size="sm" />
              <span className="text-xs font-semibold text-slate-700">{shift.assignedEmployee.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                <UserIcon className="w-3 h-3 text-slate-400" />
              </div>
              <span className="text-xs text-red-500 font-semibold">Volná pozice</span>
            </div>
          )}
        </div>
        <ShiftStatusBadge status={shift.status} />
      </div>
      {shift.notes && (
        <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-50">{shift.notes}</p>
      )}
    </div>
  )
}

// ── Desktop shift card (original compact design) ─────────────────────────────

function DesktopShiftCard({ shift }: { shift: Shift }) {
  return (
    <div className={`rounded-xl border border-slate-100 border-l-4 p-2.5 shadow-sm ${STATUS_COLORS[shift.status] ?? 'bg-slate-50'}`}>
      <div className="flex items-center gap-1 mb-1">
        <Clock className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
        <span className="text-[10px] font-semibold text-slate-600 truncate">
          {shift.startTime}–{shift.endTime}
          <span className="font-normal text-slate-400 ml-1">({getDuration(shift.startTime, shift.endTime)})</span>
        </span>
      </div>
      <p className="text-[10px] font-semibold text-slate-700 truncate mb-1.5">{shift.roleNeeded}</p>
      {shift.assignedEmployee ? (
        <div className="flex items-center gap-1">
          <UserAvatar name={shift.assignedEmployee.name} color={shift.assignedEmployee.color} size="sm" />
          <span className="text-[10px] text-slate-600 truncate">{shift.assignedEmployee.name.split(' ')[0]}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center">
            <UserIcon className="w-2 h-2 text-slate-400" />
          </div>
          <span className="text-[10px] text-red-500 font-medium">Volná</span>
        </div>
      )}
      <div className="mt-1.5">
        <ShiftStatusBadge status={shift.status} />
      </div>
    </div>
  )
}
