'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { format, addDays, startOfWeek } from 'date-fns'
import { cs } from 'date-fns/locale'
import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { NewShiftDialog } from '@/components/shifts/NewShiftDialog'
import { getShiftsForBusiness, getEmployeesForBusiness, isRegistered } from '@/lib/db'
import type { Shift, User } from '@/types'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const HOUR_HEIGHT = 64
const START_HOUR  = 6
const END_HOUR    = 23
const TOTAL_HOURS = END_HOUR - START_HOUR
const SNAP_MINS   = 15
const DAY_LABELS  = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']

function timeToY(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h + m / 60 - START_HOUR) * HOUR_HEIGHT
}

function yToTime(y: number): string {
  const raw     = Math.max(0, y) / HOUR_HEIGHT * 60
  const snapped = Math.round(raw / SNAP_MINS) * SNAP_MINS
  const clamped = Math.min(snapped, TOTAL_HOURS * 60 - SNAP_MINS)
  const hour    = Math.floor(clamped / 60) + START_HOUR
  const min     = clamped % 60
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function durMins(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number)
  const total   = Math.min(Math.max(h * 60 + m + mins, 0), 24 * 60 - 1)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  confirmed: { bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-green-400', text: 'text-green-800 dark:text-green-300' },
  assigned:  { bg: 'bg-blue-50 dark:bg-blue-900/30',  border: 'border-blue-400',  text: 'text-blue-800 dark:text-blue-300' },
  pending:   { bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-400', text: 'text-amber-800 dark:text-amber-300' },
  open:      { bg: 'bg-red-50 dark:bg-red-900/30',   border: 'border-red-300',   text: 'text-red-700 dark:text-red-400'  },
}

interface DragState {
  shift:    Shift
  offsetY:  number
  colIndex: number
}

interface GhostInfo {
  top:      number
  height:   number
  colIndex: number
  newStart: string
  newEnd:   string
}

export default function CalendarPage() {
  const { user, activeBusiness } = useAuth()
  const isManager = user?.role === 'manager' || user?.role === 'superadmin'

  const [weekOffset, setWeekOffset] = useState(0)
  const [shifts,     setShifts]     = useState<Shift[]>([])
  const [employees,  setEmployees]  = useState<User[]>([])
  const [dragging,   setDragging]   = useState<DragState | null>(null)
  const [mousePos,   setMousePos]   = useState<{ x: number; y: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const weekStart = useMemo(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
    return addDays(monday, weekOffset * 7)
  }, [weekOffset])

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i)
      return { date, dateStr: format(date, 'yyyy-MM-dd') }
    }),
  [weekStart])

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const nowY = useMemo(() => {
    const now = new Date()
    const h = now.getHours(), m = now.getMinutes()
    if (h < START_HOUR || h >= END_HOUR) return null
    return (h + m / 60 - START_HOUR) * HOUR_HEIGHT
  }, [])

  useEffect(() => {
    if (!activeBusiness) return
    Promise.all([
      getShiftsForBusiness(activeBusiness.id),
      isManager ? getEmployeesForBusiness(activeBusiness.id) : Promise.resolve([]),
    ]).then(([s, e]) => {
      setShifts(user?.role === 'employee'
        ? s.filter(sh => sh.assignedEmployee?.id === user.id)
        : s)
      setEmployees(e)
    })
  }, [activeBusiness?.id])

  const updateShift = useCallback(async (
    shiftId: string,
    fields: { date?: string; startTime?: string; endTime?: string },
  ) => {
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, ...fields } : s))
    if (activeBusiness && isRegistered(activeBusiness.id)) {
      await fetch('/api/shifts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: shiftId, ...fields }),
      })
    }
  }, [activeBusiness])

  const ghost = useMemo((): GhostInfo | null => {
    if (!dragging || !mousePos || !gridRef.current) return null
    const rect     = gridRef.current.getBoundingClientRect()
    const colWidth = rect.width / 7
    const relX     = mousePos.x - rect.left
    const relY     = mousePos.y - rect.top - dragging.offsetY
    const colIndex = Math.max(0, Math.min(6, Math.floor(relX / colWidth)))
    const newStart = yToTime(relY)
    const dur      = durMins(dragging.shift.startTime, dragging.shift.endTime)
    const newEnd   = addMinutes(newStart, dur)
    return {
      top:      timeToY(newStart),
      height:   Math.max((dur / 60) * HOUR_HEIGHT, 28),
      colIndex,
      newStart,
      newEnd,
    }
  }, [dragging, mousePos])

  const onShiftMouseDown = useCallback((e: React.MouseEvent, shift: Shift, colIndex: number) => {
    if (!isManager) return
    e.preventDefault()
    const rect    = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    setDragging({ shift, offsetY, colIndex })
    setMousePos({ x: e.clientX, y: e.clientY })
  }, [isManager])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY })
    const onUp   = (e: MouseEvent) => {
      if (!gridRef.current) { setDragging(null); setMousePos(null); return }
      const rect     = gridRef.current.getBoundingClientRect()
      const colWidth = rect.width / 7
      const relX     = e.clientX - rect.left
      const relY     = e.clientY - rect.top - dragging.offsetY
      const colIndex = Math.max(0, Math.min(6, Math.floor(relX / colWidth)))
      const newDate  = weekDays[colIndex].dateStr
      const newStart = yToTime(relY)
      const dur      = durMins(dragging.shift.startTime, dragging.shift.endTime)
      const newEnd   = addMinutes(newStart, dur)
      if (newDate !== dragging.shift.date || newStart !== dragging.shift.startTime) {
        updateShift(dragging.shift.id, { date: newDate, startTime: newStart, endTime: newEnd })
        toast.success(`Přesunuto: ${format(new Date(newDate + 'T12:00'), 'EEE d. M.', { locale: cs })} ${newStart}–${newEnd}`)
      }
      setDragging(null)
      setMousePos(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [dragging, weekDays, updateShift])

  const hours      = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i)
  const weekShifts = useMemo(() =>
    shifts.filter(s => weekDays.some(d => d.dateStr === s.date)),
  [shifts, weekDays])

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Kalendář" subtitle="Časová osa směn" />

      <div className="px-4 md:px-8 pt-5 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 border-slate-200 dark:border-slate-700"
            onClick={() => setWeekOffset(o => o - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 px-1">
            {format(weekStart, 'd. M.', { locale: cs })} — {format(addDays(weekStart, 6), 'd. M. yyyy', { locale: cs })}
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8 border-slate-200 dark:border-slate-700"
            onClick={() => setWeekOffset(o => o + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-indigo-600 dark:text-indigo-400 hidden sm:inline-flex"
              onClick={() => setWeekOffset(0)}>
              Tento týden
            </Button>
          )}
        </div>
        {isManager && (
          <NewShiftDialog
            employees={employees}
            onShiftsCreated={ns => setShifts(prev => [...prev, ...ns])}
          />
        )}
      </div>

      <div className="flex-1 px-4 md:px-8 pb-8 overflow-auto">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden"
          style={{ userSelect: 'none' }}>

          <div className="flex border-b border-slate-100 dark:border-slate-800">
            <div className="w-12 shrink-0 border-r border-slate-100 dark:border-slate-800" />
            {weekDays.map(({ dateStr, date }, i) => {
              const isToday = dateStr === todayStr
              return (
                <div key={dateStr}
                  className={`flex-1 py-3 text-center border-r last:border-r-0 border-slate-100 dark:border-slate-800 ${isToday ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${isToday ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    {DAY_LABELS[i]}
                  </p>
                  <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold mt-0.5 ${
                    isToday ? 'bg-indigo-600 text-white' : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {date.getDate()}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
            <div className="w-12 shrink-0 relative border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
              {hours.map(h => (
                <div key={h} className="absolute w-full flex items-start justify-end pr-2"
                  style={{ top: (h - START_HOUR) * HOUR_HEIGHT - 8 }}>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-none">{h}:00</span>
                </div>
              ))}
            </div>

            <div ref={gridRef} className="flex flex-1 relative"
              style={{ cursor: dragging ? 'grabbing' : 'default' }}>
              {weekDays.map(({ dateStr }, colIdx) => {
                const isToday   = dateStr === todayStr
                const dayShifts = weekShifts.filter(s => s.date === dateStr)
                return (
                  <div key={dateStr}
                    className={`flex-1 relative border-r last:border-r-0 border-slate-100 dark:border-slate-800 group ${isToday ? 'bg-indigo-50/20 dark:bg-indigo-900/10' : ''}`}>

                    {hours.map(h => (
                      <div key={h} className="absolute w-full border-t border-slate-100 dark:border-slate-800 pointer-events-none"
                        style={{ top: (h - START_HOUR) * HOUR_HEIGHT }} />
                    ))}
                    {hours.slice(0, -1).map(h => (
                      <div key={`${h}.5`} className="absolute w-full border-t border-slate-50 dark:border-slate-800/50 pointer-events-none"
                        style={{ top: (h - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
                    ))}

                    {isToday && nowY !== null && (
                      <div className="absolute w-full pointer-events-none z-20 flex items-center"
                        style={{ top: nowY }}>
                        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                        <div className="flex-1 border-t-2 border-red-400" />
                      </div>
                    )}

                    {dragging && ghost && ghost.colIndex === colIdx && (
                      <div
                        className="absolute left-1 right-1 rounded-lg border-2 border-dashed border-indigo-400 bg-indigo-50/70 flex items-center justify-center z-10 pointer-events-none"
                        style={{ top: ghost.top, height: ghost.height }}>
                        <span className="text-[10px] font-semibold text-indigo-600">
                          {ghost.newStart}–{ghost.newEnd}
                        </span>
                      </div>
                    )}

                    {dayShifts.map(shift => {
                      if (dragging?.shift.id === shift.id) return null
                      const top    = timeToY(shift.startTime)
                      const dur    = durMins(shift.startTime, shift.endTime)
                      const height = Math.max((dur / 60) * HOUR_HEIGHT, 28)
                      const colors = STATUS_COLORS[shift.status] ?? STATUS_COLORS.open
                      return (
                        <div
                          key={shift.id}
                          onMouseDown={e => onShiftMouseDown(e, shift, colIdx)}
                          className={`absolute left-1 right-1 rounded-lg border-l-2 px-1.5 py-1 shadow-sm overflow-hidden z-10
                            ${colors.bg} ${colors.border} ${colors.text}
                            ${isManager ? 'cursor-grab hover:shadow-md' : 'cursor-default'}
                            transition-shadow`}
                          style={{
                            top,
                            height,
                            borderLeftColor: shift.assignedEmployee?.color ?? undefined,
                          }}
                        >
                          <p className="text-[10px] font-bold truncate leading-tight">{shift.roleNeeded}</p>
                          {height > 30 && (
                            <p className="text-[9px] opacity-60 truncate leading-tight">{shift.startTime}–{shift.endTime}</p>
                          )}
                          {height > 52 && shift.assignedEmployee && (
                            <p className="text-[9px] opacity-60 truncate">{shift.assignedEmployee.name.split(' ')[0]}</p>
                          )}
                        </div>
                      )
                    })}

                    {isManager && !dragging && (
                      <NewShiftDialog
                        defaultDate={dateStr}
                        employees={employees}
                        onShiftsCreated={ns => setShifts(prev => [...prev, ...ns])}
                        trigger={
                          <button className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400
                            flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-indigo-200 dark:hover:bg-indigo-900/80
                            transition-opacity z-20">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        }
                      />
                    )}
                  </div>
                )
              })}

              {dragging && ghost && (() => {
                const rect = gridRef.current?.getBoundingClientRect()
                if (!rect) return null
                const colWidth = rect.width / 7
                const colors   = STATUS_COLORS[dragging.shift.status] ?? STATUS_COLORS.open
                return (
                  <div
                    className={`absolute rounded-lg border-l-2 px-1.5 py-1 shadow-xl z-50 pointer-events-none opacity-90
                      ${colors.bg} ${colors.border} ${colors.text}`}
                    style={{
                      left:   ghost.colIndex * colWidth + 4,
                      width:  colWidth - 8,
                      top:    ghost.top,
                      height: ghost.height,
                      borderLeftColor: dragging.shift.assignedEmployee?.color ?? undefined,
                    }}
                  >
                    <p className="text-[10px] font-bold truncate">{dragging.shift.roleNeeded}</p>
                    <p className="text-[9px] opacity-70">{ghost.newStart}–{ghost.newEnd}</p>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>

        {isManager && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 text-center">
            Směny lze přetáhnout na jiný den nebo čas — změny se ukládají automaticky
          </p>
        )}
      </div>
    </div>
  )
}
