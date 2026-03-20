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
import { ChevronLeft, ChevronRight, Clock, User as UserIcon, Plus, Trash2, UserCheck, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { isRegistered } from '@/lib/db'

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

  const handleAssignEmployee = async (shiftId: string, employee: User | null) => {
    if (!activeBusiness || !isRegistered(activeBusiness.id)) return
    await fetch('/api/shifts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: shiftId,
        assignedEmployeeId: employee?.id ?? null,
        status: employee ? 'assigned' : 'open',
      }),
    })
    const update = (s: Shift) => s.id === shiftId
      ? { ...s, assignedEmployee: employee ?? undefined, status: (employee ? 'assigned' : 'open') as Shift['status'] }
      : s
    setDbShifts(prev => prev.map(update))
    setExtraShifts(prev => prev.map(update))
    toast.success(employee ? `Přiřazen/a: ${employee.name}` : 'Přiřazení zrušeno')
  }

  const handleEditShift = async (shiftId: string, fields: Partial<Pick<Shift,'roleNeeded'|'startTime'|'endTime'|'date'|'notes'>>) => {
    if (!activeBusiness || !isRegistered(activeBusiness.id)) return
    await fetch('/api/shifts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: shiftId, ...fields }),
    })
    const update = (s: Shift) => s.id === shiftId ? { ...s, ...fields } : s
    setDbShifts(prev => prev.map(update))
    setExtraShifts(prev => prev.map(update))
    toast.success('Směna upravena')
  }

  const handleDeleteShift = async (shiftId: string) => {
    if (!activeBusiness || !isRegistered(activeBusiness.id)) return
    await fetch(`/api/shifts?id=${shiftId}`, { method: 'DELETE' })
    setDbShifts(prev => prev.filter(s => s.id !== shiftId))
    setExtraShifts(prev => prev.filter(s => s.id !== shiftId))
    toast.success('Směna smazána')
  }

  const handleDeleteSeries = async (groupId: string) => {
    if (!activeBusiness || !isRegistered(activeBusiness.id)) return
    await fetch(`/api/shifts?groupId=${groupId}`, { method: 'DELETE' })
    setDbShifts(prev => prev.filter(s => s.recurringGroupId !== groupId))
    setExtraShifts(prev => prev.filter(s => s.recurringGroupId !== groupId))
    toast.success('Celá série smazána')
  }

  const handleEditSeries = async (groupId: string, fields: Partial<Pick<Shift,'roleNeeded'|'startTime'|'endTime'|'notes'>>) => {
    if (!activeBusiness || !isRegistered(activeBusiness.id)) return
    await fetch('/api/shifts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, ...fields }),
    })
    const update = (s: Shift) => s.recurringGroupId === groupId ? { ...s, ...fields } : s
    setDbShifts(prev => prev.map(update))
    setExtraShifts(prev => prev.map(update))
    toast.success('Celá série upravena')
  }

  const groupCounts = useMemo(() => {
    return allShifts.reduce<Record<string, number>>((acc, s) => {
      if (s.recurringGroupId) acc[s.recurringGroupId] = (acc[s.recurringGroupId] ?? 0) + 1
      return acc
    }, {})
  }, [allShifts])

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
                <MobileShiftCard key={shift.id} shift={shift} employees={employees}
                  onAssign={handleAssignEmployee} onDelete={handleDeleteShift} onEdit={handleEditShift}
                  onDeleteSeries={handleDeleteSeries} onEditSeries={handleEditSeries}
                  seriesCount={shift.recurringGroupId ? groupCounts[shift.recurringGroupId] : undefined} />
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
                      {dayShifts.map(shift => (
                    <DesktopShiftCard key={shift.id} shift={shift} employees={employees}
                      onAssign={handleAssignEmployee} onDelete={handleDeleteShift} onEdit={handleEditShift}
                      onDeleteSeries={handleDeleteSeries} onEditSeries={handleEditSeries}
                      seriesCount={shift.recurringGroupId ? groupCounts[shift.recurringGroupId] : undefined} />
                  ))}
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

// ── Shared card props ─────────────────────────────────────────────────────────

interface CardProps {
  shift: Shift
  employees: User[]
  onAssign: (shiftId: string, employee: User | null) => void
  onDelete: (shiftId: string) => void
  onEdit:   (shiftId: string, fields: Partial<Pick<Shift,'roleNeeded'|'startTime'|'endTime'|'date'|'notes'>>) => void
  onDeleteSeries?: (groupId: string) => void
  onEditSeries?:   (groupId: string, fields: Partial<Pick<Shift,'roleNeeded'|'startTime'|'endTime'|'notes'>>) => void
  seriesCount?: number
}

// ── Mobile shift card ────────────────────────────────────────────────────────

function MobileShiftCard({ shift, employees, onAssign, onDelete, onEdit, onDeleteSeries, onEditSeries, seriesCount }: CardProps) {
  const [mode, setMode] = useState<'view'|'assign'|'edit'>('view')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [editSeriesConfirm, setEditSeriesConfirm] = useState(false)
  const [editRole,  setEditRole]  = useState(shift.roleNeeded)
  const [editStart, setEditStart] = useState(shift.startTime)
  const [editEnd,   setEditEnd]   = useState(shift.endTime)
  const [editNotes, setEditNotes] = useState(shift.notes ?? '')
  const accent: Record<string, string> = {
    confirmed: 'border-l-green-400', assigned: 'border-l-blue-400',
    pending: 'border-l-amber-400',   open: 'border-l-red-400',
  }
  const saveEdit = () => {
    const fields = { roleNeeded: editRole, startTime: editStart, endTime: editEnd, notes: editNotes || undefined }
    if (editSeriesConfirm && shift.recurringGroupId) {
      onEditSeries?.(shift.recurringGroupId, fields)
    } else {
      onEdit(shift.id, fields)
    }
    setMode('view')
    setEditSeriesConfirm(false)
  }
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 border-l-4 ${accent[shift.status] ?? 'border-l-slate-200'} shadow-sm p-4`}>
      {mode === 'edit' ? (
        <div className="space-y-2">
          <input value={editRole} onChange={e => setEditRole(e.target.value)} placeholder="Pozice"
            className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Začátek</label>
              <input type="time" value={editStart} onChange={e => setEditStart(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Konec</label>
              <input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
          <input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Poznámka (nepovinné)"
            className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          {shift.recurringGroupId && (
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={editSeriesConfirm} onChange={e => setEditSeriesConfirm(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600" />
              Upravit celou sérii{seriesCount && seriesCount > 1 ? ` (${seriesCount}×)` : ''}
            </label>
          )}
          <div className="flex gap-2">
            <button onClick={saveEdit} className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl py-2 hover:bg-indigo-700 transition-colors">
              <Check className="w-3.5 h-3.5" /> Uložit
            </button>
            <button onClick={() => { setMode('view'); setEditSeriesConfirm(false) }} className="px-3 py-2 rounded-xl border border-slate-200 text-slate-500 text-xs hover:bg-slate-50 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <>
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
            <div className="flex flex-col items-end gap-1.5">
              <ShiftStatusBadge status={shift.status} />
              <div className="flex gap-1 relative">
                <button onClick={() => setMode(mode === 'assign' ? 'view' : 'assign')} title="Přiřadit zaměstnance"
                  className={`p-1.5 rounded-lg transition-colors ${mode === 'assign' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'}`}>
                  <UserCheck className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setEditRole(shift.roleNeeded); setEditStart(shift.startTime); setEditEnd(shift.endTime); setEditNotes(shift.notes ?? ''); setMode('edit') }}
                  title="Upravit směnu" className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => shift.recurringGroupId ? setDeleteConfirm(true) : onDelete(shift.id)} title="Smazat směnu"
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {deleteConfirm && (
                  <div className="absolute right-0 top-full z-30 mt-1 w-52 bg-white rounded-xl border border-slate-200 shadow-xl p-3">
                    <p className="text-xs font-semibold text-slate-700 mb-2">Smazat směnu?</p>
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => { onDelete(shift.id); setDeleteConfirm(false) }}
                        className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-left transition-colors">
                        Jen tuto směnu
                      </button>
                      {shift.recurringGroupId && (
                        <button onClick={() => { onDeleteSeries?.(shift.recurringGroupId!); setDeleteConfirm(false) }}
                          className="text-xs px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 text-left font-semibold transition-colors">
                          Celou sérii{seriesCount && seriesCount > 1 ? ` (${seriesCount}×)` : ''}
                        </button>
                      )}
                      <button onClick={() => setDeleteConfirm(false)}
                        className="text-xs px-3 py-2 text-slate-500 hover:bg-slate-50 rounded-lg text-left transition-colors">
                        Zrušit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {shift.notes && <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-50">{shift.notes}</p>}
          {mode === 'assign' && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-[11px] font-semibold text-slate-500 mb-2">Přiřadit zaměstnance:</p>
              <div className="space-y-1">
                {shift.assignedEmployee && (
                  <button onClick={() => { onAssign(shift.id, null); setMode('view') }}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                    Zrušit přiřazení
                  </button>
                )}
                {employees.map(emp => (
                  <button key={emp.id} onClick={() => { onAssign(shift.id, emp); setMode('view') }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-indigo-50 transition-colors">
                    <UserAvatar name={emp.name} color={emp.color} size="sm" />
                    <span className="text-xs font-medium text-slate-700">{emp.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Desktop shift card ────────────────────────────────────────────────────────

function DesktopShiftCard({ shift, employees, onAssign, onDelete, onEdit, onDeleteSeries, onEditSeries, seriesCount }: CardProps) {
  const [showAssign, setShowAssign] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editRole,  setEditRole]  = useState(shift.roleNeeded)
  const [editStart, setEditStart] = useState(shift.startTime)
  const [editEnd,   setEditEnd]   = useState(shift.endTime)
  const [editNotes, setEditNotes] = useState(shift.notes ?? '')
  const [editSeries, setEditSeries] = useState(false)

  const openEdit = () => {
    setEditRole(shift.roleNeeded); setEditStart(shift.startTime)
    setEditEnd(shift.endTime); setEditNotes(shift.notes ?? '')
    setEditSeries(false); setShowEditForm(true)
    setDeleteConfirm(false); setShowAssign(false)
  }
  const saveEdit = () => {
    const fields = { roleNeeded: editRole, startTime: editStart, endTime: editEnd, notes: editNotes || undefined }
    if (editSeries && shift.recurringGroupId) onEditSeries?.(shift.recurringGroupId, fields)
    else onEdit(shift.id, fields)
    setShowEditForm(false)
  }

  return (
    <div className={`rounded-xl border border-slate-100 border-l-4 p-2.5 shadow-sm ${STATUS_COLORS[shift.status] ?? 'bg-slate-50'} relative group`}>
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
      <div className="mt-1.5 flex items-center justify-between">
        <ShiftStatusBadge status={shift.status} />
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => { setShowAssign(v => !v); setDeleteConfirm(false); setShowEditForm(false) }} title="Přiřadit"
            className="p-1 rounded text-slate-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors">
            <UserCheck className="w-3 h-3" />
          </button>
          <button onClick={openEdit} title="Upravit"
            className="p-1 rounded text-slate-400 hover:bg-amber-100 hover:text-amber-600 transition-colors">
            <Pencil className="w-3 h-3" />
          </button>
          <button onClick={() => { shift.recurringGroupId ? setDeleteConfirm(v => !v) : onDelete(shift.id); setShowAssign(false); setShowEditForm(false) }} title="Smazat"
            className="p-1 rounded text-slate-400 hover:bg-red-100 hover:text-red-500 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      {showAssign && (
        <div className="absolute top-full left-0 z-20 mt-1 w-44 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500">Přiřadit zaměstnance</p>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {shift.assignedEmployee && (
              <button onClick={() => { onAssign(shift.id, null); setShowAssign(false) }}
                className="w-full text-left text-xs px-3 py-2 hover:bg-red-50 text-red-500 transition-colors">
                Zrušit přiřazení
              </button>
            )}
            {employees.map(emp => (
              <button key={emp.id} onClick={() => { onAssign(shift.id, emp); setShowAssign(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 transition-colors">
                <UserAvatar name={emp.name} color={emp.color} size="sm" />
                <span className="text-xs text-slate-700 truncate">{emp.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {showEditForm && (
        <div className="absolute top-full left-0 z-20 mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-xl p-3 space-y-2">
          <p className="text-[11px] font-semibold text-slate-600">Upravit směnu</p>
          <input value={editRole} onChange={e => setEditRole(e.target.value)} placeholder="Pozice"
            className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Začátek</label>
              <input type="time" value={editStart} onChange={e => setEditStart(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Konec</label>
              <input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
          <input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Poznámka (nepovinné)"
            className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          {shift.recurringGroupId && seriesCount && (
            <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
              <input type="checkbox" checked={editSeries} onChange={e => setEditSeries(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600" />
              Celou sérii{seriesCount > 1 ? ` (${seriesCount}×)` : ''}
            </label>
          )}
          <div className="flex gap-1.5 pt-0.5">
            <button onClick={saveEdit}
              className="flex-1 flex items-center justify-center gap-1 bg-indigo-600 text-white text-[11px] font-semibold rounded-lg py-1.5 hover:bg-indigo-700 transition-colors">
              <Check className="w-3 h-3" /> Uložit
            </button>
            <button onClick={() => setShowEditForm(false)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-[11px] hover:bg-slate-50 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
      {deleteConfirm && (
        <div className="absolute top-full right-0 z-20 mt-1 w-48 bg-white rounded-xl border border-slate-200 shadow-lg p-2.5">
          <p className="text-[11px] font-semibold text-slate-700 mb-2 px-1">Smazat směnu?</p>
          <button onClick={() => { onDelete(shift.id); setDeleteConfirm(false) }}
            className="w-full text-left text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors mb-1">
            Jen tuto směnu
          </button>
          {shift.recurringGroupId && (
            <button onClick={() => { onDeleteSeries?.(shift.recurringGroupId!); setDeleteConfirm(false) }}
              className="w-full text-left text-xs px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-semibold transition-colors mb-1">
              Celou sérii{seriesCount && seriesCount > 1 ? ` (${seriesCount}×)` : ''}
            </button>
          )}
          <button onClick={() => setDeleteConfirm(false)}
            className="w-full text-left text-xs px-3 py-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors">
            Zrušit
          </button>
        </div>
      )}
    </div>
  )
}
