'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay,
  parseISO, getISODay,
} from 'date-fns'
import { cs } from 'date-fns/locale'
import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { NewShiftDialog } from '@/components/shifts/NewShiftDialog'
import { getShiftsForBusiness, getEmployeesForBusiness } from '@/lib/db'
import { isRegistered } from '@/lib/db'
import type { Shift, User } from '@/types'
import {
  ChevronLeft, ChevronRight, X, Clock, User as UserIcon,
  Pencil, Trash2, UserCheck, Check, Repeat, CalendarDays, LayoutGrid,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STATUS_DOT: Record<string, string> = {
  confirmed: 'bg-green-500',
  assigned:  'bg-blue-500',
  pending:   'bg-amber-500',
  open:      'bg-red-400',
}

const STATUS_PILL: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  assigned:  'bg-blue-100 text-blue-800 border-blue-200',
  pending:   'bg-amber-100 text-amber-800 border-amber-200',
  open:      'bg-red-100 text-red-700 border-red-200',
}

function getDuration(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const h = (eh + em / 60) - (sh + sm / 60)
  return `${h}h`
}

// ── Shift detail / edit modal ──────────────────────────────────────────────────

interface DetailModalProps {
  shift: Shift
  employees: User[]
  onClose: () => void
  onSave: (id: string, fields: Partial<Shift>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onAssign: (id: string, emp: User | null) => Promise<void>
}

function ShiftDetailModal({ shift, employees, onClose, onSave, onDelete, onAssign }: DetailModalProps) {
  const [editing, setEditing] = useState(false)
  const [assignMode, setAssignMode] = useState(false)
  const [role,  setRole]  = useState(shift.roleNeeded)
  const [start, setStart] = useState(shift.startTime)
  const [end,   setEnd]   = useState(shift.endTime)
  const [date,  setDate]  = useState(shift.date)
  const [notes, setNotes] = useState(shift.notes ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(shift.id, { roleNeeded: role, startTime: start, endTime: end, date, notes: notes || undefined })
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn('px-5 pt-5 pb-4 border-b border-slate-100', !editing && 'pb-4')}>
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5', STATUS_DOT[shift.status] ?? 'bg-slate-300')} />
              {editing ? (
                <input
                  value={role} onChange={e => setRole(e.target.value)}
                  className="font-bold text-slate-900 text-base border-b border-indigo-300 outline-none bg-transparent w-full"
                />
              ) : (
                <h3 className="font-bold text-slate-900 text-base">{shift.roleNeeded}</h3>
              )}
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          {shift.recurringGroupId && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full ml-4">
              <Repeat className="w-2.5 h-2.5" /> Opakující se série
            </span>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Date + time */}
          {editing ? (
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Datum</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Začátek</label>
                  <input type="time" value={start} onChange={e => setStart(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Konec</label>
                  <input type="time" value={end} onChange={e => setEnd(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Poznámka</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none h-16" />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CalendarDays className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>{format(parseISO(shift.date), 'EEEE d. MMMM yyyy', { locale: cs })}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>{shift.startTime} – {shift.endTime}</span>
                <span className="text-xs text-slate-400">({getDuration(shift.startTime, shift.endTime)})</span>
              </div>
              {shift.notes && (
                <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">{shift.notes}</p>
              )}
            </>
          )}

          {/* Assigned employee */}
          <div className="border-t border-slate-100 pt-3">
            <p className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">Zaměstnanec</p>
            {assignMode ? (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {shift.assignedEmployee && (
                  <button onClick={async () => { await onAssign(shift.id, null); setAssignMode(false) }}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                    Zrušit přiřazení
                  </button>
                )}
                {employees.map(emp => (
                  <button key={emp.id} onClick={async () => { await onAssign(shift.id, emp); setAssignMode(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-indigo-50 transition-colors">
                    <UserAvatar name={emp.name} color={emp.color} size="sm" />
                    <span className="text-xs font-medium text-slate-700">{emp.name}</span>
                  </button>
                ))}
              </div>
            ) : shift.assignedEmployee ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UserAvatar name={shift.assignedEmployee.name} color={shift.assignedEmployee.color} size="sm" />
                  <span className="text-sm font-medium text-slate-700">{shift.assignedEmployee.name}</span>
                </div>
                <button onClick={() => setAssignMode(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" /> Změnit
                </button>
              </div>
            ) : (
              <button onClick={() => setAssignMode(true)}
                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 transition-colors">
                <div className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center">
                  <UserIcon className="w-3 h-3" />
                </div>
                Volná pozice — přiřadit zaměstnance
              </button>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 pb-5 flex items-center gap-2">
          {editing ? (
            <>
              <Button onClick={handleSave} disabled={saving} size="sm"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                <Check className="w-3.5 h-3.5 mr-1" />
                {saving ? 'Ukládám…' : 'Uložit'}
              </Button>
              <Button onClick={() => setEditing(false)} variant="outline" size="sm">Zrušit</Button>
            </>
          ) : (
            <>
              <Button onClick={() => setEditing(true)} variant="outline" size="sm" className="flex-1">
                <Pencil className="w-3.5 h-3.5 mr-1" /> Upravit
              </Button>
              <Button onClick={async () => { await onDelete(shift.id); onClose() }}
                variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main calendar page ─────────────────────────────────────────────────────────

type ViewMode = 'month' | 'week'

export default function CalendarPage() {
  const { user, activeBusiness } = useAuth()
  const isManager = user?.role === 'manager'

  const [today]        = useState(() => new Date())
  const [current, setCurrent] = useState(() => new Date())
  const [view, setView] = useState<ViewMode>('month')
  const [shifts,    setShifts]    = useState<Shift[]>([])
  const [employees, setEmployees] = useState<User[]>([])
  const [loading,   setLoading]   = useState(false)
  const [selected,  setSelected]  = useState<Shift | null>(null)
  const [dragShift, setDragShift] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!activeBusiness) return
    setLoading(true)
    const [s, e] = await Promise.all([
      getShiftsForBusiness(activeBusiness.id),
      getEmployeesForBusiness(activeBusiness.id),
    ])
    // Employees only see their own shifts
    setShifts(isManager ? s : s.filter(sh => sh.assignedEmployee?.id === user?.id))
    setEmployees(e)
    setLoading(false)
  }, [activeBusiness?.id, isManager, user?.id])

  useEffect(() => { load() }, [load])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveShift = async (id: string, fields: Partial<Shift>) => {
    if (!activeBusiness || !isRegistered(activeBusiness.id)) return
    await fetch('/api/shifts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    })
    setShifts(prev => prev.map(s => s.id === id ? { ...s, ...fields } : s))
    // Update selected if open
    setSelected(prev => prev?.id === id ? { ...prev, ...fields } : prev)
    toast.success('Směna uložena')
  }

  const handleDeleteShift = async (id: string) => {
    if (!activeBusiness || !isRegistered(activeBusiness.id)) return
    await fetch(`/api/shifts?id=${id}`, { method: 'DELETE' })
    setShifts(prev => prev.filter(s => s.id !== id))
    toast.success('Směna smazána')
  }

  const handleAssign = async (id: string, emp: User | null) => {
    if (!activeBusiness || !isRegistered(activeBusiness.id)) return
    await fetch('/api/shifts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, assignedEmployeeId: emp?.id ?? null, status: emp ? 'assigned' : 'open' }),
    })
    const update = (s: Shift) => s.id === id
      ? { ...s, assignedEmployee: emp ?? undefined, status: (emp ? 'assigned' : 'open') as Shift['status'] }
      : s
    setShifts(prev => prev.map(update))
    setSelected(prev => prev?.id === id ? update(prev) : prev)
    toast.success(emp ? `Přiřazen/a: ${emp.name}` : 'Přiřazení zrušeno')
  }

  const handleDrop = async (targetDate: string, shiftId: string) => {
    const shift = shifts.find(s => s.id === shiftId)
    if (!shift || shift.date === targetDate) return
    await handleSaveShift(shiftId, { date: targetDate })
    toast.success(`Směna přesunuta na ${format(parseISO(targetDate), 'd. M.', { locale: cs })}`)
  }

  const handleShiftsCreated = (newShifts: Shift[]) => {
    setShifts(prev => [...prev, ...newShifts])
  }

  // ── Calendar grid helpers ──────────────────────────────────────────────────

  const monthStart = startOfMonth(current)
  const monthEnd   = endOfMonth(current)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd    = endOfWeek(monthEnd,   { weekStartsOn: 1 })

  const days: Date[] = []
  let d = gridStart
  while (d <= gridEnd) { days.push(d); d = addDays(d, 1) }

  const weekStart = startOfWeek(current, { weekStartsOn: 1 })
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const shiftsForDate = (dateStr: string) =>
    shifts.filter(s => s.date === dateStr)

  // ── Employee color map ─────────────────────────────────────────────────────
  const empColor = (emp?: User) => emp?.color ?? '#6366f1'

  // ── Render ─────────────────────────────────────────────────────────────────

  const DAY_LABELS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']

  const ShiftPill = ({ shift, compact = false }: { shift: Shift; compact?: boolean }) => {
    const emp = shift.assignedEmployee
    return (
      <div
        draggable={isManager}
        onDragStart={() => setDragShift(shift.id)}
        onDragEnd={() => setDragShift(null)}
        onClick={e => { e.stopPropagation(); setSelected(shift) }}
        title={`${shift.roleNeeded} · ${shift.startTime}–${shift.endTime}${emp ? ' · ' + emp.name : ''}`}
        className={cn(
          'flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-semibold cursor-pointer transition-all hover:brightness-95 active:scale-95 border',
          STATUS_PILL[shift.status] ?? 'bg-slate-100 text-slate-700 border-slate-200',
          dragShift === shift.id && 'opacity-40',
          compact ? 'truncate' : 'w-full'
        )}
        style={emp ? { borderLeftColor: empColor(emp), borderLeftWidth: 3 } : {}}
      >
        <span className="truncate flex-1">{compact ? shift.startTime : `${shift.startTime} ${shift.roleNeeded}`}</span>
        {emp && !compact && (
          <span className="flex-shrink-0 w-3.5 h-3.5 rounded-full text-white text-[8px] font-bold flex items-center justify-center"
            style={{ background: empColor(emp) }}>
            {emp.name[0]}
          </span>
        )}
      </div>
    )
  }

  const DayCell = ({ date, mini = false }: { date: Date; mini?: boolean }) => {
    const dateStr  = format(date, 'yyyy-MM-dd')
    const dayShifts = shiftsForDate(dateStr)
    const isToday   = isSameDay(date, today)
    const inMonth   = isSameMonth(date, current)
    const maxVisible = mini ? 2 : 3

    return (
      <div
        className={cn(
          'flex flex-col gap-0.5 min-h-0 p-1 rounded-xl transition-colors relative group',
          inMonth ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/60',
          !isManager && 'cursor-default'
        )}
        onDragOver={isManager ? e => e.preventDefault() : undefined}
        onDrop={isManager ? e => { e.preventDefault(); if (dragShift) handleDrop(dateStr, dragShift) } : undefined}
      >
        {/* Day number */}
        <div className="flex items-center justify-between px-0.5">
          <span className={cn(
            'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full',
            isToday
              ? 'bg-indigo-600 text-white'
              : inMonth ? 'text-slate-700' : 'text-slate-300'
          )}>
            {date.getDate()}
          </span>
          {isManager && (
            <NewShiftDialog
              defaultDate={dateStr}
              employees={employees}
              onShiftsCreated={handleShiftsCreated}
              trigger={
                <button className="w-5 h-5 rounded-full text-slate-300 hover:bg-indigo-100 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-base leading-none">
                  +
                </button>
              }
            />
          )}
        </div>

        {/* Shift pills */}
        <div className="flex flex-col gap-0.5 min-w-0">
          {dayShifts.slice(0, maxVisible).map(shift => (
            <ShiftPill key={shift.id} shift={shift} compact={mini} />
          ))}
          {dayShifts.length > maxVisible && (
            <button
              onClick={() => {
                // Show first hidden shift
                setSelected(dayShifts[maxVisible])
              }}
              className="text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold px-1.5 text-left transition-colors"
            >
              +{dayShifts.length - maxVisible} dalších
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Kalendář"
        subtitle={isManager ? 'Přehled a správa všech směn' : 'Tvoje směny'}
      />

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 pt-5 pb-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 border-slate-200"
            onClick={() => setCurrent(view === 'month' ? subMonths(current, 1) : addDays(current, -7))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-sm font-semibold text-slate-700 px-1 min-w-36 text-center capitalize">
            {view === 'month'
              ? format(current, 'LLLL yyyy', { locale: cs })
              : `${format(weekStart, 'd. M.', { locale: cs })} — ${format(addDays(weekStart, 6), 'd. M. yyyy', { locale: cs })}`
            }
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8 border-slate-200"
            onClick={() => setCurrent(view === 'month' ? addMonths(current, 1) : addDays(current, 7))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs text-indigo-600 hidden sm:inline-flex"
            onClick={() => setCurrent(new Date())}>
            Dnes
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setView('month')}
              className={cn('px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5',
                view === 'month' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50')}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Měsíc
            </button>
            <button
              onClick={() => setView('week')}
              className={cn('px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 border-l border-slate-200',
                view === 'week' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50')}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Týden
            </button>
          </div>
          {isManager && <NewShiftDialog employees={employees} onShiftsCreated={handleShiftsCreated} />}
        </div>
      </div>

      {/* ── Calendar grid ────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 md:px-8 pb-8 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Načítám…</div>
        ) : view === 'month' ? (
          /* MONTH VIEW */
          <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50">
            {/* Day labels */}
            <div className="grid grid-cols-7 border-b border-slate-100">
              {DAY_LABELS.map(label => (
                <div key={label} className="text-center text-[11px] font-semibold text-slate-400 py-2 uppercase tracking-wider">
                  {label}
                </div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-px bg-slate-100">
              {days.map(day => (
                <DayCell key={format(day, 'yyyy-MM-dd')} date={day} mini />
              ))}
            </div>
          </div>
        ) : (
          /* WEEK VIEW */
          <div className="border border-slate-100 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-7 bg-white border-b border-slate-100">
              {weekDays.map((day, i) => {
                const isToday = isSameDay(day, today)
                return (
                  <div key={i} className="text-center py-3 px-1">
                    <p className={cn('text-[11px] font-semibold uppercase tracking-wide mb-1',
                      isToday ? 'text-indigo-600' : 'text-slate-400')}>
                      {DAY_LABELS[i]}
                    </p>
                    <div className={cn(
                      'inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold',
                      isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'
                    )}>
                      {day.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="grid grid-cols-7 gap-px bg-slate-100 min-h-64">
              {weekDays.map(day => (
                <DayCell key={format(day, 'yyyy-MM-dd')} date={day} />
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          {[
            { status: 'open',      label: 'Volná' },
            { status: 'assigned',  label: 'Přiřazená' },
            { status: 'confirmed', label: 'Potvrzená' },
            { status: 'pending',   label: 'Čeká na schválení' },
          ].map(({ status, label }) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className={cn('w-2.5 h-2.5 rounded-full', STATUS_DOT[status])} />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          ))}
          {isManager && (
            <span className="text-xs text-slate-400 ml-auto">Směny lze přetáhnout na jiný den</span>
          )}
        </div>
      </div>

      {/* ── Shift detail modal ────────────────────────────────────────────── */}
      {selected && (
        <ShiftDetailModal
          shift={selected}
          employees={employees}
          onClose={() => setSelected(null)}
          onSave={handleSaveShift}
          onDelete={handleDeleteShift}
          onAssign={handleAssign}
        />
      )}
    </div>
  )
}
