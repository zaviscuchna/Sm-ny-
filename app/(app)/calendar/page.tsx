'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { format, addDays, startOfWeek } from 'date-fns'
import { cs } from 'date-fns/locale'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch } from '@/contexts/BranchContext'
import { TopBar } from '@/components/layout/TopBar'
import { NewShiftDialog } from '@/components/shifts/NewShiftDialog'
import { getShiftsForBusiness, getEmployeesForBusiness, isRegistered } from '@/lib/db'
import type { Shift, User } from '@/types'
import { ChevronLeft, ChevronRight, Plus, Users, User as UserIcon } from 'lucide-react'
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

// Rozvržení překrývajících se směn — vrací pro každou směnu {lane, total},
// kde total = max současných souběhů v čase této směny, lane = pořadí v clusteru.
// Použije se pro horizontální rozložení karet (žádný překryv).
function computeShiftLayout(dayShifts: Shift[]): Map<string, { lane: number; total: number }> {
  const result = new Map<string, { lane: number; total: number }>()
  for (const s of dayShifts) {
    const sStart = s.startTime
    const sEnd   = s.endTime
    const cluster = dayShifts.filter(o => o.startTime < sEnd && o.endTime > sStart)
    cluster.sort((a, b) => a.startTime === b.startTime
      ? a.id.localeCompare(b.id)
      : a.startTime.localeCompare(b.startTime))
    const lane = cluster.findIndex(x => x.id === s.id)
    result.set(s.id, { lane: Math.max(0, lane), total: Math.max(1, cluster.length) })
  }
  return result
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
  const { activeBranch } = useBranch()
  const isManager = user?.role === 'manager' || user?.role === 'superadmin'

  const [weekOffset, setWeekOffset] = useState(0)
  const [shifts,     setShifts]     = useState<Shift[]>([])
  const [employees,  setEmployees]  = useState<User[]>([])
  // Default pro zaměstnance: Tým (vidí všechno). Když chtějí jen svoje, přepnou.
  // Jinak zaměstnanec, který ještě nemá přiřazené směny, viděl prázdný kalendář.
  const [showTeam,   setShowTeam]   = useState(true)
  const [hydrated,   setHydrated]   = useState(false)

  // Load persisted toggle AFTER hydration — jinak server-renderovaný HTML
  // nesedí s klientem a Next.js 16 hodí "Application error".
  useEffect(() => {
    try {
      const saved = localStorage.getItem('smenky_cal_showteam')
      if (saved !== null) setShowTeam(saved === '1')
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem('smenky_cal_showteam', showTeam ? '1' : '0')
    } catch {}
  }, [showTeam, hydrated])
  const [dragging,   setDragging]   = useState<DragState | null>(null)
  const [mousePos,   setMousePos]   = useState<{ x: number; y: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Proposal modal — pro zaměstnance klik na cizí směnu
  // 'swap' = nabídnout výměnu za vlastní směnu, 'split' = navrhnout rozdělení
  const [swapTarget, setSwapTarget] = useState<Shift | null>(null)
  const [proposalMode, setProposalMode] = useState<'swap'|'split'>('swap')
  const [swapMyShiftId, setSwapMyShiftId] = useState<string>('')
  const [swapMessage, setSwapMessage] = useState('')
  const [swapSending, setSwapSending] = useState(false)
  // Split-specific state
  const [splitTime, setSplitTime] = useState('')
  const [splitProposerHalf, setSplitProposerHalf] = useState<'first'|'second'>('second')

  function midpointTimeFor(start: string, end: string): string {
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    const startMin = sh * 60 + sm
    const endMin = eh * 60 + em
    const mid = Math.round((startMin + endMin) / 2 / 15) * 15
    return `${String(Math.floor(mid / 60)).padStart(2, '0')}:${String(mid % 60).padStart(2, '0')}`
  }

  const openSwapProposal = useCallback((shift: Shift) => {
    setSwapTarget(shift)
    setProposalMode('swap')
    setSwapMyShiftId('')
    setSwapMessage('')
    setSplitTime(midpointTimeFor(shift.startTime, shift.endTime))
    setSplitProposerHalf('second')
  }, [])

  const submitSwapProposal = useCallback(async () => {
    if (!swapTarget || !swapTarget.assignedEmployee) return
    setSwapSending(true)
    try {
      if (proposalMode === 'swap') {
        if (!swapMyShiftId) return
        const res = await fetch('/api/shift-swaps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromShiftId: swapMyShiftId,
            toShiftId: swapTarget.id,
            toUserId: swapTarget.assignedEmployee.id,
            message: swapMessage || undefined,
          }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          toast.error(d.error ?? 'Chyba při návrhu výměny')
          return
        }
        toast.success(`Návrh výměny odeslán kolegovi ${swapTarget.assignedEmployee.name.split(' ')[0]}.`)
        setSwapTarget(null)
      } else {
        // Split proposal
        if (!splitTime || splitTime <= swapTarget.startTime || splitTime >= swapTarget.endTime) {
          toast.error(`Čas rozdělení musí být mezi ${swapTarget.startTime} a ${swapTarget.endTime}`)
          return
        }
        const res = await fetch('/api/shift-split-proposals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shiftId: swapTarget.id,
            splitTime,
            proposerHalf: splitProposerHalf,
            message: swapMessage || undefined,
          }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          toast.error(d.error ?? 'Chyba při návrhu rozdělení')
          return
        }
        toast.success(`Návrh rozdělení odeslán kolegovi ${swapTarget.assignedEmployee.name.split(' ')[0]}.`)
        setSwapTarget(null)
      }
    } finally {
      setSwapSending(false)
    }
  }, [swapTarget, swapMyShiftId, swapMessage, proposalMode, splitTime, splitProposerHalf])

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
      getShiftsForBusiness(activeBusiness.id, activeBranch?.id),
      getEmployeesForBusiness(activeBusiness.id),
    ]).then(([s, e]) => {
      setShifts(s)
      setEmployees(e)
    })
  }, [activeBusiness?.id, activeBranch?.id])

  // For employees, filter to own shifts unless team view is on
  const visibleShifts = useMemo(() => {
    if (user?.role === 'employee' && !showTeam) {
      return shifts.filter(sh => sh.assignedEmployee?.id === user.id)
    }
    return shifts
  }, [shifts, user?.id, user?.role, showTeam])

  const updateShift = useCallback(async (
    shiftId: string,
    fields: { date?: string; startTime?: string; endTime?: string },
  ) => {
    const prevShifts = shifts
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, ...fields } : s))
    if (activeBusiness && isRegistered(activeBusiness.id)) {
      const res = await fetch('/api/shifts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: shiftId, ...fields }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 409) toast.error(data.error ?? 'Přesun by způsobil kolizi směn — zrušeno')
        else toast.error(data.error ?? 'Chyba při úpravě směny')
        setShifts(prevShifts)
      }
    }
  }, [activeBusiness, shifts])

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
    visibleShifts.filter(s => weekDays.some(d => d.dateStr === s.date)),
  [visibleShifts, weekDays])

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
        <div className="flex items-center gap-2">
          {user?.role === 'employee' && (
            <button
              onClick={() => setShowTeam(v => !v)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                showTeam
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              title={showTeam ? 'Zobrazit jen moje směny' : 'Zobrazit celý tým'}
            >
              {showTeam ? <Users className="w-3.5 h-3.5" /> : <UserIcon className="w-3.5 h-3.5" />}
              {showTeam ? 'Tým' : 'Jen já'}
            </button>
          )}
          {isManager && (
            <NewShiftDialog
              employees={employees}
              onShiftsCreated={ns => setShifts(prev => [...prev, ...ns])}
            />
          )}
        </div>
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
                const shiftLayout = computeShiftLayout(dayShifts)
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
                      // Zaměstnanec může navrhnout výměnu kliknutím na cizí přiřazenou směnu
                      const isForeign = !isManager && shift.assignedEmployee && user && shift.assignedEmployee.id !== user.id
                      // Jen budoucí směny — minulé nesmí být měněny
                      const isFuture = shift.date >= todayStr
                      const clickable = isManager || (isForeign && isFuture)
                      // Překryv: aktuální směna je v clusteru o velikosti `total`, na pozici `lane`
                      const lay = shiftLayout.get(shift.id) ?? { lane: 0, total: 1 }
                      const widthPct = 100 / lay.total
                      const leftPct  = widthPct * lay.lane
                      return (
                        <div
                          key={shift.id}
                          onMouseDown={e => isManager ? onShiftMouseDown(e, shift, colIdx) : undefined}
                          onClick={isForeign && isFuture ? () => openSwapProposal(shift) : undefined}
                          className={`absolute rounded-lg border-l-2 px-1.5 py-1 shadow-sm overflow-hidden z-10
                            ${colors.bg} ${colors.border} ${colors.text}
                            ${isManager ? 'cursor-grab hover:shadow-md' : clickable ? 'cursor-pointer hover:shadow-md hover:ring-2 hover:ring-indigo-300 dark:hover:ring-indigo-700' : 'cursor-default'}
                            transition-shadow`}
                          style={{
                            top,
                            height,
                            left:  `calc(${leftPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                            borderLeftColor: shift.assignedEmployee?.color ?? undefined,
                          }}
                          title={isForeign && isFuture ? 'Klikni pro návrh výměny' : undefined}
                        >
                          <p className="text-[10px] font-bold truncate leading-tight">{shift.roleNeeded}</p>
                          {height > 30 && (
                            <p className="text-[9px] opacity-60 truncate leading-tight">{shift.startTime}–{shift.endTime}</p>
                          )}
                          {height > 52 && shift.assignedEmployee && lay.total === 1 && (
                            <p className="text-[9px] opacity-60 truncate">{shift.assignedEmployee.name.split(' ')[0]}</p>
                          )}
                          {shift.branch && lay.total > 1 && height > 42 && (
                            <p className="text-[9px] opacity-70 truncate leading-tight">{shift.branch.name}</p>
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
        {!isManager && user?.role === 'employee' && showTeam && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 text-center">
            Tip: klikni na cizí směnu a navrhni kolegovi výměnu
          </p>
        )}
      </div>

      {/* ── Proposal modal (zaměstnanec → cizí směna): swap nebo split ─── */}
      {swapTarget && swapTarget.assignedEmployee && user && (() => {
        const myFutureShifts = shifts
          .filter(s => s.assignedEmployee?.id === user.id && s.date >= todayStr)
          .sort((a, b) => a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date))
        const splitOk = !!splitTime && splitTime > swapTarget.startTime && splitTime < swapTarget.endTime
        const canSubmit = proposalMode === 'swap' ? !!swapMyShiftId : splitOk
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSwapTarget(null)}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">Návrh kolegovi</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">S kolegou {swapTarget.assignedEmployee.name}</p>
                <div className="mt-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400">
                  <strong className="text-slate-800 dark:text-slate-200">{swapTarget.roleNeeded}</strong>
                  <span className="mx-1 text-slate-400">·</span>
                  {format(new Date(swapTarget.date + 'T12:00'), 'EEE d. M.', { locale: cs })} {swapTarget.startTime}–{swapTarget.endTime}
                </div>
              </div>
              {/* Tab switcher */}
              <div className="px-5 pt-3 pb-1 flex gap-1">
                <button
                  onClick={() => setProposalMode('swap')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    proposalMode === 'swap'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >Výměna celé směny</button>
                <button
                  onClick={() => setProposalMode('split')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    proposalMode === 'split'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >Rozdělení směny</button>
              </div>
              <div className="px-5 py-4 overflow-y-auto flex-1">
                {proposalMode === 'swap' ? (
                  <>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Za kterou tvoji směnu?</p>
                    {myFutureShifts.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">Nemáš žádné budoucí směny k nabídnutí.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-64 overflow-y-auto">
                        {myFutureShifts.map(s => (
                          <button
                            key={s.id}
                            onClick={() => setSwapMyShiftId(s.id)}
                            className={`w-full text-left px-3 py-2 rounded-xl border transition-colors ${
                              swapMyShiftId === s.id
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{s.roleNeeded}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {format(new Date(s.date + 'T12:00'), 'EEE d. M.', { locale: cs })} · {s.startTime}–{s.endTime}
                              {s.branch && <span className="ml-1">· {s.branch.name}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Ve kolik rozdělit?</p>
                    <input
                      type="time"
                      value={splitTime}
                      min={swapTarget.startTime}
                      max={swapTarget.endTime}
                      onChange={e => setSplitTime(e.target.value)}
                      className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                      Rozsah: {swapTarget.startTime} – {swapTarget.endTime}
                    </p>

                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-4 mb-2">Kterou půlku si vezmeš?</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSplitProposerHalf('first')}
                        className={`px-3 py-2.5 rounded-xl border text-left transition-colors ${
                          splitProposerHalf === 'first'
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="text-[11px] font-semibold text-indigo-500 uppercase">První</div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{swapTarget.startTime}–{splitOk ? splitTime : '?'}</div>
                      </button>
                      <button
                        onClick={() => setSplitProposerHalf('second')}
                        className={`px-3 py-2.5 rounded-xl border text-left transition-colors ${
                          splitProposerHalf === 'second'
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="text-[11px] font-semibold text-indigo-500 uppercase">Druhá</div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{splitOk ? splitTime : '?'}–{swapTarget.endTime}</div>
                      </button>
                    </div>
                    {splitOk && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 px-3 py-2 rounded-lg bg-indigo-50/60 dark:bg-indigo-900/20">
                        Kolega {swapTarget.assignedEmployee.name.split(' ')[0]} si nechá <strong>{splitProposerHalf === 'first' ? `${splitTime}–${swapTarget.endTime}` : `${swapTarget.startTime}–${splitTime}`}</strong>, ty dostaneš <strong>{splitProposerHalf === 'first' ? `${swapTarget.startTime}–${splitTime}` : `${splitTime}–${swapTarget.endTime}`}</strong>.
                      </p>
                    )}
                  </>
                )}
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mt-4 mb-1.5">Zpráva (volitelná)</label>
                <textarea
                  value={swapMessage}
                  onChange={e => setSwapMessage(e.target.value)}
                  placeholder="Např. Mám lékaře, mohl bys prosím..."
                  rows={2}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex gap-2 bg-slate-50/50 dark:bg-slate-800/50">
                <Button
                  onClick={submitSwapProposal}
                  disabled={!canSubmit || swapSending}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40"
                >
                  {swapSending ? 'Odesílám…' : proposalMode === 'swap' ? 'Odeslat návrh výměny' : 'Odeslat návrh rozdělení'}
                </Button>
                <Button variant="outline" onClick={() => setSwapTarget(null)}>Zrušit</Button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
