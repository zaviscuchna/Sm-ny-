'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { SHIFTS, SHIFT_APPLICATIONS } from '@/lib/mock-data'
import { isRegistered } from '@/lib/db'
import { parseISO } from 'date-fns'
import type { Shift, ShiftApplication } from '@/types'
import { Clock, Calendar, Briefcase, CheckCircle2, XCircle, UserPlus, ChevronDown, ChevronUp, Repeat, Pencil, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

function getDuration(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return `${(eh + em / 60) - (sh + sm / 60)}h`
}

export default function OpenShiftsPage() {
  const { user, activeBusiness } = useAuth()
  const isManager = user?.role === 'manager'

  const [openShifts, setOpenShifts] = useState<Shift[]>([])
  const [apps, setApps] = useState<ShiftApplication[]>([])
  const [appliedShifts, setAppliedShifts] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!activeBusiness) return
    if (isRegistered(activeBusiness.id)) {
      fetch(`/api/shifts?bizId=${activeBusiness.id}`)
        .then(r => r.json())
        .then((shifts: Shift[]) => {
          const open = shifts.filter(s => s.status === 'open')
          setOpenShifts(open)
          // Load applications and reconstruct full ShiftApplication objects
          return fetch(`/api/shift-applications?bizId=${activeBusiness.id}`)
            .then(r => r.json())
            .then((rawApps: { id: string; shiftId: string; employeeId: string; employeeName: string; status: string; createdAt: string }[]) => {
              const full = rawApps.map(a => ({
                id: a.id,
                shift: open.find(s => s.id === a.shiftId) ?? { id: a.shiftId, businessId: activeBusiness.id, date: '', startTime: '', endTime: '', roleNeeded: '', status: 'open' as const },
                employee: { id: a.employeeId, name: a.employeeName, email: '', role: 'employee' as const, color: '#6366f1' },
                status: a.status as 'pending' | 'approved' | 'rejected',
                createdAt: a.createdAt,
              }))
              setApps(full)
              // Pre-populate appliedShifts for current employee
              if (user) {
                const mine = full.filter(a => a.employee.id === user.id && (a.status === 'pending' || a.status === 'approved')).map(a => a.shift.id)
                setAppliedShifts(new Set(mine))
              }
            })
        })
        .catch(() => {})
    } else {
      setOpenShifts(SHIFTS.filter(s => s.status === 'open'))
      setApps(SHIFT_APPLICATIONS)
    }
  }, [activeBusiness?.id, user?.id])
  const [expandedShift, setExpandedShift] = useState<string | null>(null)
  const [appliedGroups, setAppliedGroups] = useState<Set<string>>(new Set())
  const [editingShift, setEditingShift] = useState<string | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editSeriesConfirm, setEditSeriesConfirm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Count how many open shifts share a recurring group
  const groupCounts = openShifts.reduce<Record<string, number>>((acc, s) => {
    if (s.recurringGroupId) acc[s.recurringGroupId] = (acc[s.recurringGroupId] ?? 0) + 1
    return acc
  }, {})

  const handleApplySeries = async (shift: Shift) => {
    if (!user || !activeBusiness || !shift.recurringGroupId) return
    if (!isRegistered(activeBusiness.id)) {
      toast.info('Hromadné přihlášení funguje pouze v live režimu.')
      return
    }
    try {
      const res = await fetch('/api/recurring-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recurringGroupId: shift.recurringGroupId,
          employeeId: user.id,
          employeeName: user.name,
          bizId: activeBusiness.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Chyba'); return }
      setAppliedGroups(prev => new Set(prev).add(shift.recurringGroupId!))
      // Mark all shifts in group as applied
      const newApplied = new Set(appliedShifts)
      openShifts.filter(s => s.recurringGroupId === shift.recurringGroupId).forEach(s => newApplied.add(s.id))
      setAppliedShifts(newApplied)
      toast.success(`Přihlášen/a na ${data.count} směn v sérii!`)
    } catch { toast.error('Chyba připojení') }
  }

  const handleApply = async (shift: Shift) => {
    if (!user || !activeBusiness) return
    if (isRegistered(activeBusiness.id)) {
      try {
        const res = await fetch('/api/shift-applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shiftId: shift.id, employeeId: user.id, employeeName: user.name, bizId: activeBusiness.id }),
        })
        if (!res.ok) {
          const d = await res.json()
          toast.error(d.error ?? 'Chyba při přihlášení')
          return
        }
        const created = await res.json()
        const newApp: ShiftApplication = { id: created.id, shift, employee: user, status: 'pending', createdAt: created.createdAt }
        setApps(prev => [...prev, newApp])
      } catch { toast.error('Chyba připojení'); return }
    } else {
      const newApp: ShiftApplication = { id: `app-${Date.now()}`, shift, employee: user, status: 'pending', createdAt: format(new Date(), 'yyyy-MM-dd') }
      setApps(prev => [...prev, newApp])
    }
    setAppliedShifts(prev => new Set(prev).add(shift.id))
    toast.success('Přihláška odeslána! Manažer vás bude informovat.')
  }

  const handleApprove = async (appId: string) => {
    const app = apps.find(a => a.id === appId)
    if (!app) return
    if (activeBusiness && isRegistered(activeBusiness.id)) {
      await fetch('/api/shift-applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: appId, status: 'approved', shiftId: app.shift.id, employeeId: app.employee.id }),
      })
      // Remove approved shift from open list (now assigned)
      setOpenShifts(prev => prev.filter(s => s.id !== app.shift.id))
      setApps(prev => prev.map(a => a.shift.id === app.shift.id
        ? { ...a, status: a.id === appId ? 'approved' : 'rejected' }
        : a
      ))
    } else {
      setApps(prev => prev.map(a => a.id === appId ? { ...a, status: 'approved' } : a))
    }
    toast.success('Přihláška schválena')
  }

  const handleReject = async (appId: string) => {
    if (activeBusiness && isRegistered(activeBusiness.id)) {
      await fetch('/api/shift-applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: appId, status: 'rejected' }),
      })
    }
    setApps(prev => prev.map(a => a.id === appId ? { ...a, status: 'rejected' } : a))
    toast.error('Přihláška zamítnuta')
  }

  const startEdit = (shift: Shift) => {
    setEditingShift(shift.id)
    setEditRole(shift.roleNeeded)
    setEditStart(shift.startTime)
    setEditEnd(shift.endTime)
    setEditNotes(shift.notes ?? '')
    setEditSeriesConfirm(false)
    setDeleteConfirm(null)
    setExpandedShift(null)
  }

  const saveEdit = async (shift: Shift) => {
    const fields = { roleNeeded: editRole, startTime: editStart, endTime: editEnd, notes: editNotes || undefined }
    if (activeBusiness && isRegistered(activeBusiness.id)) {
      await fetch('/api/shifts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editSeriesConfirm && shift.recurringGroupId
          ? { groupId: shift.recurringGroupId, ...fields }
          : { id: shift.id, ...fields }),
      })
    }
    if (editSeriesConfirm && shift.recurringGroupId) {
      setOpenShifts(prev => prev.map(s => s.recurringGroupId === shift.recurringGroupId ? { ...s, ...fields } : s))
      toast.success('Celá série upravena')
    } else {
      setOpenShifts(prev => prev.map(s => s.id === shift.id ? { ...s, ...fields } : s))
      toast.success('Směna upravena')
    }
    setEditingShift(null)
  }

  const handleDeleteShift = async (shift: Shift, series = false) => {
    if (activeBusiness && isRegistered(activeBusiness.id)) {
      if (series && shift.recurringGroupId) {
        await fetch(`/api/shifts?groupId=${shift.recurringGroupId}`, { method: 'DELETE' })
        setOpenShifts(prev => prev.filter(s => s.recurringGroupId !== shift.recurringGroupId))
        toast.success('Celá série smazána')
      } else {
        await fetch(`/api/shifts?id=${shift.id}`, { method: 'DELETE' })
        setOpenShifts(prev => prev.filter(s => s.id !== shift.id))
        toast.success('Směna smazána')
      }
    } else {
      if (series && shift.recurringGroupId) {
        setOpenShifts(prev => prev.filter(s => s.recurringGroupId !== shift.recurringGroupId))
      } else {
        setOpenShifts(prev => prev.filter(s => s.id !== shift.id))
      }
      toast.success('Směna smazána')
    }
    setDeleteConfirm(null)
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Otevřené směny"
        subtitle={isManager ? 'Správa přihlášek na volné pozice' : 'Přihlas se na volné směny'}
      />

      <div className="flex-1 p-4 md:p-8">
        {openShifts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-slate-700 font-semibold">Všechny směny jsou obsazeny</p>
            <p className="text-slate-400 text-sm mt-1">Žádné otevřené pozice momentálně nejsou.</p>
          </div>
        ) : (
          <div className="space-y-4 max-w-2xl">
            {openShifts.map(shift => {
              const shiftApps = apps.filter(a => a.shift.id === shift.id)
              const pendingApps = shiftApps.filter(a => a.status === 'pending')
              const hasApplied = appliedShifts.has(shift.id)
              const isExpanded = expandedShift === shift.id

              return (
                <div key={shift.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="p-5 flex gap-4 items-start">
                    <div className="flex-shrink-0 w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                      <Briefcase className="w-4.5 h-4.5 text-red-500" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-bold text-slate-900">{shift.roleNeeded}</p>
                          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(parseISO(shift.date), 'EEEE d. M.', { locale: cs })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {shift.startTime}–{shift.endTime}
                              <span className="text-slate-400">({getDuration(shift.startTime, shift.endTime)})</span>
                            </span>
                          </div>
                          {shift.notes && (
                            <p className="text-xs text-slate-400 mt-1.5 bg-slate-50 rounded-lg px-2 py-1">{shift.notes}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                          {isManager ? (
                            <>
                              {pendingApps.length > 0 && (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                                  {pendingApps.length} čeká
                                </Badge>
                              )}
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => startEdit(shift)}
                                  title="Upravit směnu"
                                  className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <div className="relative">
                                  <button
                                    onClick={() => setDeleteConfirm(deleteConfirm === shift.id ? null : shift.id)}
                                    title="Smazat směnu"
                                    className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                  {deleteConfirm === shift.id && (
                                    <div className="absolute right-0 top-full z-30 mt-1 w-52 bg-white rounded-xl border border-slate-200 shadow-xl p-3">
                                      <p className="text-xs font-semibold text-slate-700 mb-2">Smazat směnu?</p>
                                      <div className="flex flex-col gap-1.5">
                                        <button onClick={() => handleDeleteShift(shift, false)}
                                          className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-left transition-colors">
                                          Jen tuto směnu
                                        </button>
                                        {shift.recurringGroupId && (groupCounts[shift.recurringGroupId] ?? 0) > 1 && (
                                          <button onClick={() => handleDeleteShift(shift, true)}
                                            className="text-xs px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 text-left font-semibold transition-colors">
                                            Celou sérii ({groupCounts[shift.recurringGroupId]}×)
                                          </button>
                                        )}
                                        <button onClick={() => setDeleteConfirm(null)}
                                          className="text-xs px-3 py-2 text-slate-500 hover:bg-slate-50 rounded-lg text-left transition-colors">
                                          Zrušit
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-slate-500"
                                onClick={() => setExpandedShift(isExpanded ? null : shift.id)}
                              >
                                Přihlášky
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                              </Button>
                            </>
                          ) : (
                            <div className="flex flex-col gap-1.5 items-end">
                              <Button
                                size="sm"
                                disabled={hasApplied}
                                onClick={() => handleApply(shift)}
                                className={hasApplied
                                  ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-50 cursor-default'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                }
                              >
                                {hasApplied ? (
                                  <><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Přihlášen/a</>
                                ) : (
                                  <><UserPlus className="w-3.5 h-3.5 mr-1" />Přihlásit se</>
                                )}
                              </Button>
                              {shift.recurringGroupId && (groupCounts[shift.recurringGroupId] ?? 0) > 1 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={appliedGroups.has(shift.recurringGroupId)}
                                  onClick={() => handleApplySeries(shift)}
                                  className={
                                    appliedGroups.has(shift.recurringGroupId)
                                      ? 'border-green-200 text-green-700 bg-green-50 cursor-default text-xs h-7'
                                      : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-xs h-7'
                                  }
                                >
                                  <Repeat className="w-3 h-3 mr-1" />
                                  {appliedGroups.has(shift.recurringGroupId)
                                    ? 'Série přihlášena'
                                    : `Celá série (${groupCounts[shift.recurringGroupId]}×)`
                                  }
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Edit panel (manager only) */}
                  {isManager && editingShift === shift.id && (
                    <div className="border-t border-slate-50 bg-amber-50/40 px-5 py-4 space-y-3">
                      <p className="text-xs font-semibold text-slate-600">Upravit směnu</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Pozice</label>
                          <input value={editRole} onChange={e => setEditRole(e.target.value)}
                            className="w-full text-sm rounded-xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Poznámka</label>
                          <input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="nepovinné"
                            className="w-full text-sm rounded-xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Začátek</label>
                          <input type="time" value={editStart} onChange={e => setEditStart(e.target.value)}
                            className="w-full text-sm rounded-xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Konec</label>
                          <input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                            className="w-full text-sm rounded-xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                      </div>
                      {shift.recurringGroupId && (groupCounts[shift.recurringGroupId] ?? 0) > 1 && (
                        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                          <input type="checkbox" checked={editSeriesConfirm} onChange={e => setEditSeriesConfirm(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600" />
                          Upravit celou sérii ({groupCounts[shift.recurringGroupId]}×)
                        </label>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(shift)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
                          <Check className="w-3.5 h-3.5" /> Uložit
                        </button>
                        <button onClick={() => { setEditingShift(null); setEditSeriesConfirm(false) }}
                          className="px-4 py-2 border border-slate-200 text-slate-500 text-xs rounded-xl hover:bg-slate-50 transition-colors">
                          Zrušit
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Applications panel (manager only) */}
                  {isManager && isExpanded && (
                    <div className="border-t border-slate-50 bg-slate-50/50 px-5 py-4">
                      {shiftApps.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-2">Žádné přihlášky pro tuto směnu.</p>
                      ) : (
                        <div className="space-y-2">
                          {shiftApps.map(app => (
                            <div key={app.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-slate-100">
                              <UserAvatar name={app.employee.name} color={app.employee.color} size="md" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800">{app.employee.name}</p>
                                <p className="text-xs text-slate-400">Přihlásil/a se {app.createdAt}</p>
                              </div>
                              {app.status === 'pending' ? (
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => handleApprove(app.id)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Schválit
                                  </button>
                                  <button
                                    onClick={() => handleReject(app.id)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    Zamítnout
                                  </button>
                                </div>
                              ) : (
                                <Badge className={app.status === 'approved'
                                  ? 'bg-green-50 text-green-700 border-green-200 text-xs'
                                  : 'bg-slate-100 text-slate-500 border-slate-200 text-xs'
                                }>
                                  {app.status === 'approved' ? 'Schváleno' : 'Zamítnuto'}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
