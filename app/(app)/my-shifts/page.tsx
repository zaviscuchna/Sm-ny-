'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { cs } from 'date-fns/locale'
import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { ShiftStatusBadge } from '@/components/shared/ShiftStatusBadge'
import { WelcomeModal } from '@/components/shared/WelcomeModal'
import { SHIFTS, OPEN_SHIFTS } from '@/lib/mock-data'
import { saveWorkLog, deleteWorkLog, getEmployeeLogs, sumHours } from '@/lib/work-logs'
import type { WorkLog } from '@/lib/work-logs'
import type { Shift } from '@/types'
import { Calendar, Clock, CheckCircle2, UserPlus, Star, ClipboardList, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

function getDuration(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return `${(eh + em / 60) - (sh + sm / 60)}h`
}

export default function MyShiftsPage() {
  const { user } = useAuth()

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const myShifts = SHIFTS
    .filter(s => s.assignedEmployee?.id === user?.id)
    .sort((a, b) => a.date.localeCompare(b.date))

  const upcomingShifts = myShifts.filter(s => s.date >= todayStr)
  const pastShifts     = myShifts.filter(s => s.date < todayStr)

  const [appliedShifts, setAppliedShifts] = useState<Set<string>>(new Set())
  const [confirmedShifts, setConfirmedShifts] = useState<Set<string>>(new Set())

  // ─── Work log state ──────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [logDate, setLogDate] = useState(todayStr)
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [logNotes, setLogNotes] = useState('')
  const [logMonth, setLogMonth] = useState(format(new Date(), 'yyyy-MM'))

  useEffect(() => {
    if (user?.id) setLogs(getEmployeeLogs(user.id))
  }, [user?.id])

  const monthLogs = logs.filter(l => l.date.startsWith(logMonth))
  const monthTotal = sumHours(monthLogs)

  const prevMonth = () => {
    const [y, m] = logMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setLogMonth(format(d, 'yyyy-MM'))
  }
  const nextMonth = () => {
    const [y, m] = logMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    if (d <= new Date()) setLogMonth(format(d, 'yyyy-MM'))
  }

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!clockIn || !clockOut) { toast.error('Vyplň čas příchodu i odchodu'); return }
    const [ih, im] = clockIn.split(':').map(Number)
    const [oh, om] = clockOut.split(':').map(Number)
    if ((oh + om / 60) <= (ih + im / 60)) { toast.error('Čas odchodu musí být po příchodu'); return }
    const log = saveWorkLog({
      employeeId: user!.id,
      employeeName: user!.name,
      date: logDate,
      clockIn,
      clockOut,
      notes: logNotes || undefined,
    })
    setLogs(prev => [log, ...prev])
    setClockIn('')
    setClockOut('')
    setLogNotes('')
    toast.success(`Záznam uložen — ${log.hours}h`)
  }

  const handleDeleteLog = (id: string) => {
    deleteWorkLog(id)
    setLogs(prev => prev.filter(l => l.id !== id))
    toast.success('Záznam smazán')
  }

  const handleApply = (shift: Shift) => {
    setAppliedShifts(prev => new Set(prev).add(shift.id))
    toast.success('Přihláška odeslána!')
  }

  const handleConfirm = (shiftId: string) => {
    setConfirmedShifts(prev => new Set(prev).add(shiftId))
    toast.success('Směna potvrzena!')
  }

  const totalHours = upcomingShifts.reduce((acc, s) => {
    const [sh, sm] = s.startTime.split(':').map(Number)
    const [eh, em] = s.endTime.split(':').map(Number)
    return acc + (eh + em / 60) - (sh + sm / 60)
  }, 0)

  return (
    <div className="flex flex-col min-h-full">
      <WelcomeModal />
      <TopBar title="Moje směny" subtitle={`Přehled plánovaných směn pro ${user?.name}`} />

      <div className="flex-1 p-4 md:p-8 max-w-3xl space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Nadcházející',  value: upcomingShifts.length, unit: 'směn' },
            { label: 'Hodin celkem',  value: totalHours,            unit: 'h tento týden' },
            { label: 'Odpracováno',   value: pastShifts.length,     unit: 'směn' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{s.value}</p>
              <p className="text-xs text-slate-400">{s.unit}</p>
            </div>
          ))}
        </div>

        {/* Upcoming shifts */}
        <section>
          <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-500" />
            Nadcházející směny
          </h2>

          {upcomingShifts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
              <p className="text-slate-400 text-sm">Žádné naplánované směny.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingShifts.map(shift => {
                const isToday   = shift.date === todayStr
                const isConfirmed = confirmedShifts.has(shift.id) || shift.status === 'confirmed'

                return (
                  <div
                    key={shift.id}
                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                      isToday ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-100'
                    }`}
                  >
                    {isToday && (
                      <div className="bg-indigo-600 px-4 py-1.5">
                        <p className="text-xs font-semibold text-white flex items-center gap-1">
                          <Star className="w-3 h-3" /> Dnes
                        </p>
                      </div>
                    )}
                    <div className="p-5 flex items-center gap-4">
                      <div className="flex-shrink-0 text-center w-12">
                        <p className="text-2xl font-black text-slate-900 leading-none">
                          {format(parseISO(shift.date), 'd')}
                        </p>
                        <p className="text-xs font-semibold text-slate-400 uppercase">
                          {format(parseISO(shift.date), 'MMM', { locale: cs })}
                        </p>
                        <p className="text-[10px] text-slate-300">
                          {format(parseISO(shift.date), 'EEE', { locale: cs })}
                        </p>
                      </div>

                      <div className="w-px h-12 bg-slate-100" />

                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900">{shift.roleNeeded}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {shift.startTime}–{shift.endTime}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span>{getDuration(shift.startTime, shift.endTime)}</span>
                        </div>
                        {shift.notes && (
                          <p className="text-xs text-slate-400 mt-1.5 bg-slate-50 rounded-lg px-2 py-1">{shift.notes}</p>
                        )}
                      </div>

                      <div className="flex-shrink-0 flex flex-col items-end gap-2">
                        <ShiftStatusBadge status={isConfirmed ? 'confirmed' : shift.status} />
                        {!isConfirmed && shift.status === 'assigned' && (
                          <button
                            onClick={() => handleConfirm(shift.id)}
                            className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Potvrdit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Work logging */}
        <section>
          <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-indigo-500" />
            Záznamy práce
          </h2>

          {/* Add new log form */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
            <p className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Přidat záznam
            </p>
            <form onSubmit={handleLogSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Datum</label>
                  <input
                    type="date"
                    value={logDate}
                    max={todayStr}
                    onChange={e => setLogDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Příchod</label>
                    <input
                      type="time"
                      value={clockIn}
                      onChange={e => setClockIn(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Odchod</label>
                    <input
                      type="time"
                      value={clockOut}
                      onChange={e => setClockOut(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Poznámka (nepovinné)</label>
                <input
                  type="text"
                  placeholder="např. přesčas, zastupování..."
                  value={logNotes}
                  onChange={e => setLogNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white w-full rounded-xl">
                Uložit záznam
              </Button>
            </form>
          </div>

          {/* Month selector + history */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <p className="text-xs font-semibold text-slate-700 capitalize min-w-[90px] text-center">
                  {format(new Date(logMonth + '-01'), 'LLLL yyyy', { locale: cs })}
                </p>
                <button
                  onClick={nextMonth}
                  disabled={logMonth >= format(new Date(), 'yyyy-MM')}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Celkem</p>
                <p className="text-sm font-bold text-indigo-600">{monthTotal}h</p>
              </div>
            </div>

            {monthLogs.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400">
                Žádné záznamy za tento měsíc.
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {monthLogs.map(log => (
                  <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-shrink-0 text-center w-10">
                      <p className="text-lg font-black text-slate-800 leading-none">
                        {format(parseISO(log.date), 'd')}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">
                        {format(parseISO(log.date), 'EEE', { locale: cs })}
                      </p>
                    </div>
                    <div className="w-px h-8 bg-slate-100 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800">{log.clockIn} – {log.clockOut}</p>
                      {log.notes && <p className="text-[11px] text-slate-400 truncate">{log.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-700">{log.hours}h</span>
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className="p-1 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                        title="Smazat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Open shifts to apply */}
        <section>
          <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-amber-500" />
            Volné směny — přihlas se
          </h2>

          {OPEN_SHIFTS.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
              <p className="text-slate-400 text-sm">Žádné volné směny k dispozici.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {OPEN_SHIFTS.map(shift => {
                const hasApplied = appliedShifts.has(shift.id)
                return (
                  <div
                    key={shift.id}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4"
                  >
                    <div className="flex-shrink-0 text-center w-10">
                      <p className="text-xl font-black text-slate-700 leading-none">
                        {format(parseISO(shift.date), 'd')}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">
                        {format(parseISO(shift.date), 'EEE', { locale: cs })}
                      </p>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{shift.roleNeeded}</p>
                      <p className="text-xs text-slate-400">
                        {shift.startTime}–{shift.endTime} · {getDuration(shift.startTime, shift.endTime)}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      disabled={hasApplied}
                      onClick={() => handleApply(shift)}
                      className={hasApplied
                        ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-50 cursor-default text-xs'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white text-xs'
                      }
                    >
                      {hasApplied ? (
                        <><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Přihlášen/a</>
                      ) : (
                        <><UserPlus className="w-3.5 h-3.5 mr-1" />Přihlásit se</>
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
