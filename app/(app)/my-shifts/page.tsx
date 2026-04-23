'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { cs } from 'date-fns/locale'
import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { ShiftStatusBadge } from '@/components/shared/ShiftStatusBadge'
import { WelcomeModal } from '@/components/shared/WelcomeModal'
import { sumHours } from '@/lib/work-logs'
import { getLogsForEmployee, saveLogToDB, deleteLogFromDB, getShiftsForBusiness, isRegistered } from '@/lib/db'
import { safeFetchArray } from '@/lib/safe-fetch'
import type { WorkLog } from '@/lib/work-logs'
import type { Shift } from '@/types'
import { Calendar, Clock, CheckCircle2, UserPlus, Star, ClipboardList, Plus, Trash2, ChevronLeft, ChevronRight, Handshake, ArrowRightLeft, X as XIcon, Split as SplitIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { toast } from 'sonner'

interface SwapRequest {
  id: string
  fromUserId: string
  toUserId: string
  fromShiftId: string
  toShiftId: string
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  message?: string
  createdAt: string
  fromShift: { id: string; date: string; startTime: string; endTime: string; roleNeeded: string; branchName: string | null }
  toShift:   { id: string; date: string; startTime: string; endTime: string; roleNeeded: string; branchName: string | null }
  fromUser:  { id: string; name: string; color: string }
  toUser:    { id: string; name: string; color: string }
}

interface Colleague { id: string; name: string; color: string; email: string }

interface SplitProposal {
  id: string
  shiftId: string
  fromUserId: string
  toUserId: string
  splitTime: string
  proposerHalf: 'first' | 'second'
  message?: string
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  createdAt: string
  shift?: { id: string; date: string; startTime: string; endTime: string; roleNeeded: string; branchId?: string | null; branchName?: string | null }
  fromUser: { id: string; name: string; color: string }
  toUser:   { id: string; name: string; color: string }
}

function getDuration(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return `${(eh + em / 60) - (sh + sm / 60)}h`
}

export default function MyShiftsPage() {
  const { user, activeBusiness } = useAuth()

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const [myShiftsRaw, setMyShiftsRaw] = useState<Shift[]>([])
  const [allBizShifts, setAllBizShifts] = useState<Shift[]>([])

  useEffect(() => {
    if (!activeBusiness || !user) return
    if (isRegistered(activeBusiness.id)) {
      safeFetchArray<Shift>(`/api/shifts?bizId=${activeBusiness.id}&employeeId=${user.id}`).then(setMyShiftsRaw)
      safeFetchArray<Shift>(`/api/shifts?bizId=${activeBusiness.id}`).then(setAllBizShifts)
    } else {
      getShiftsForBusiness(activeBusiness.id).then(shifts => {
        setAllBizShifts(shifts)
        setMyShiftsRaw(shifts.filter(s => s.assignedEmployee?.id === user.id))
      })
    }
  }, [activeBusiness?.id, user?.id])

  const myShifts = myShiftsRaw.sort((a, b) => a.date.localeCompare(b.date))

  const upcomingShifts = myShifts.filter(s => s.date >= todayStr)
  const pastShifts     = myShifts.filter(s => s.date < todayStr)

  const openShifts = allBizShifts.filter(s => s.status === 'open')

  const [appliedShifts, setAppliedShifts] = useState<Set<string>>(new Set())
  const [confirmedShifts, setConfirmedShifts] = useState<Set<string>>(new Set())
  const [swaps, setSwaps] = useState<SwapRequest[]>([])
  const [splitProposals, setSplitProposals] = useState<SplitProposal[]>([])
  const [colleagues, setColleagues] = useState<Colleague[]>([])
  const [swapDialog, setSwapDialog] = useState<{ myShift: Shift } | null>(null)
  const [swapPickedUserId, setSwapPickedUserId] = useState<string>('')
  const [swapPickedShiftId, setSwapPickedShiftId] = useState<string>('')
  const [swapMessage, setSwapMessage] = useState('')

  // Fetch colleagues + swaps
  useEffect(() => {
    if (!activeBusiness || !user) return
    if (!isRegistered(activeBusiness.id)) return
    safeFetchArray<Colleague>(`/api/employees?bizId=${activeBusiness.id}`)
      .then(emps => setColleagues(emps.filter(e => e.id !== user.id)))
    loadSwaps()
  }, [activeBusiness?.id, user?.id])

  const loadSwaps = () => {
    if (!activeBusiness || !user || !isRegistered(activeBusiness.id)) return
    safeFetchArray<SwapRequest>(`/api/shift-swaps?status=pending`).then(setSwaps)
    safeFetchArray<SplitProposal>(`/api/shift-split-proposals?status=pending`).then(setSplitProposals)
  }

  const handleSplitAction = async (proposalId: string, action: 'accept' | 'reject') => {
    const res = await fetch(`/api/shift-split-proposals?id=${proposalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error ?? 'Chyba')
      return
    }
    toast.success(action === 'accept' ? 'Směna rozdělena — kolega má svoji půlku' : 'Návrh odmítnut')
    // Reload — split accept vytváří novou směnu, musíme refresh
    setSplitProposals(prev => prev.filter(p => p.id !== proposalId))
    if (action === 'accept' && activeBusiness && user && isRegistered(activeBusiness.id)) {
      safeFetchArray<Shift>(`/api/shifts?bizId=${activeBusiness.id}&employeeId=${user.id}`).then(setMyShiftsRaw)
      safeFetchArray<Shift>(`/api/shifts?bizId=${activeBusiness.id}`).then(setAllBizShifts)
    }
  }

  // Load existing applications from DB
  useEffect(() => {
    if (!activeBusiness || !user) return
    if (!isRegistered(activeBusiness.id)) return
    safeFetchArray<{ shiftId: string; employeeId: string; status: string }>(
      `/api/shift-applications?bizId=${activeBusiness.id}`
    ).then(apps => {
      const myPending = apps
        .filter(a => a.employeeId === user.id && (a.status === 'pending' || a.status === 'approved'))
        .map(a => a.shiftId)
      setAppliedShifts(new Set(myPending))
    })
  }, [activeBusiness?.id, user?.id])

  // ─── Work log state ──────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [logDate, setLogDate] = useState(todayStr)
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [logNotes, setLogNotes] = useState('')
  const [logMonth, setLogMonth] = useState(format(new Date(), 'yyyy-MM'))

  useEffect(() => {
    if (user?.id && activeBusiness?.id) {
      getLogsForEmployee(user.id, activeBusiness.id).then(setLogs)
    }
  }, [user?.id, activeBusiness?.id])

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

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clockIn || !clockOut) { toast.error('Vyplň čas příchodu i odchodu'); return }
    const [ih, im] = clockIn.split(':').map(Number)
    const [oh, om] = clockOut.split(':').map(Number)
    if ((oh + om / 60) <= (ih + im / 60)) { toast.error('Čas odchodu musí být po příchodu'); return }
    const log = await saveLogToDB({
      employeeId:   user!.id,
      employeeName: user!.name,
      date:         logDate,
      clockIn,
      clockOut,
      notes: logNotes || undefined,
    }, activeBusiness!.id)
    setLogs(prev => [log, ...prev])
    setClockIn('')
    setClockOut('')
    setLogNotes('')
    toast.success(`Záznam uložen — ${log.hours}h`)
  }

  const handleDeleteLog = async (id: string) => {
    await deleteLogFromDB(id, activeBusiness?.id ?? '')
    setLogs(prev => prev.filter(l => l.id !== id))
    toast.success('Záznam smazán')
  }

  const handleApply = async (shift: Shift) => {
    if (!user || !activeBusiness) return
    if (isRegistered(activeBusiness.id)) {
      try {
        const res = await fetch('/api/shift-applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shiftId: shift.id,
            employeeId: user.id,
            employeeName: user.name,
            bizId: activeBusiness.id,
          }),
        })
        if (!res.ok) {
          const d = await res.json()
          toast.error(d.error ?? 'Chyba při přihlášení')
          return
        }
      } catch {
        toast.error('Chyba připojení')
        return
      }
    }
    setAppliedShifts(prev => new Set(prev).add(shift.id))
    toast.success('Přihláška odeslána!')
  }

  const handleConfirm = (shiftId: string) => {
    setConfirmedShifts(prev => new Set(prev).add(shiftId))
    toast.success('Směna potvrzena!')
  }

  const [giveUpConfirm, setGiveUpConfirm] = useState<string | null>(null)

  // Shifts for the selected colleague (to propose swap)
  const colleagueShifts = allBizShifts
    .filter(s => s.assignedEmployee?.id === swapPickedUserId && s.date >= todayStr && s.status !== 'open')
    .sort((a, b) => a.date.localeCompare(b.date))

  const openSwapDialog = (myShift: Shift) => {
    setSwapDialog({ myShift })
    setSwapPickedUserId('')
    setSwapPickedShiftId('')
    setSwapMessage('')
  }

  const handleProposeSwap = async () => {
    if (!swapDialog || !swapPickedUserId || !swapPickedShiftId) return
    const res = await fetch('/api/shift-swaps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromShiftId: swapDialog.myShift.id,
        toShiftId: swapPickedShiftId,
        toUserId: swapPickedUserId,
        message: swapMessage.trim() || undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error ?? 'Chyba při návrhu výměny')
      return
    }
    toast.success('Návrh výměny odeslán — čekej na odpověď kolegy')
    setSwapDialog(null)
    loadSwaps()
  }

  const handleSwapAction = async (swapId: string, action: 'accept' | 'reject') => {
    const res = await fetch(`/api/shift-swaps?id=${swapId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error ?? 'Chyba')
      loadSwaps()
      return
    }
    if (action === 'accept') {
      toast.success('Výměna schválena — směny se prohodily')
      // Reload shifts, swaps
      if (activeBusiness && user && isRegistered(activeBusiness.id)) {
        safeFetchArray<Shift>(`/api/shifts?bizId=${activeBusiness.id}&employeeId=${user.id}`).then(setMyShiftsRaw)
        safeFetchArray<Shift>(`/api/shifts?bizId=${activeBusiness.id}`).then(setAllBizShifts)
      }
    } else {
      toast(action === 'reject' ? 'Výměna odmítnuta' : 'Výměna zrušena')
    }
    loadSwaps()
  }

  const handleGiveUp = async (shiftId: string) => {
    if (!activeBusiness) return
    if (!isRegistered(activeBusiness.id)) {
      setMyShiftsRaw(prev => prev.filter(s => s.id !== shiftId))
      setAllBizShifts(prev => prev.map(s => s.id === shiftId ? { ...s, assignedEmployee: undefined, status: 'open' } : s))
      toast.success('Směna nabídnuta k převzetí')
      setGiveUpConfirm(null)
      return
    }
    const res = await fetch('/api/shifts/give-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shiftId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error ?? 'Chyba — směnu nelze uvolnit')
      return
    }
    setMyShiftsRaw(prev => prev.filter(s => s.id !== shiftId))
    setAllBizShifts(prev => prev.map(s => s.id === shiftId ? { ...s, assignedEmployee: undefined, status: 'open' } : s))
    toast.success('Směna nabídnuta k převzetí — uvidí ji ostatní v Volných směnách')
    setGiveUpConfirm(null)
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
            <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm px-5 py-4">
              <p className="text-xs text-slate-400 dark:text-slate-500">{s.label}</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">{s.value}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{s.unit}</p>
            </div>
          ))}
        </div>

        {/* Split proposals */}
        {splitProposals.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <SplitIcon className="w-4 h-4 text-indigo-500" />
              Návrhy rozdělení ({splitProposals.length})
            </h2>
            <div className="space-y-2">
              {splitProposals.map(p => {
                const isIncoming = p.toUserId === user?.id
                const them = isIncoming ? p.fromUser : p.toUser
                if (!p.shift) return null
                const keepStart = p.proposerHalf === 'first' ? p.splitTime       : p.shift.startTime
                const keepEnd   = p.proposerHalf === 'first' ? p.shift.endTime   : p.splitTime
                const gotStart  = p.proposerHalf === 'first' ? p.shift.startTime : p.splitTime
                const gotEnd    = p.proposerHalf === 'first' ? p.splitTime       : p.shift.endTime
                return (
                  <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 shadow-sm p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <UserAvatar name={them.name} color={them.color} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {isIncoming ? `${them.name} navrhuje rozdělení tvé směny` : `Navrhl/as rozdělení směny ${them.name}`}
                        </p>
                        {p.message && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-0.5">&ldquo;{p.message}&rdquo;</p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-2">
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase mb-0.5">Původní směna</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{p.shift.roleNeeded}</p>
                        <p className="text-slate-500 dark:text-slate-400">
                          {format(parseISO(p.shift.date + 'T12:00:00'), 'EEE d. M.', { locale: cs })} · {p.shift.startTime}–{p.shift.endTime}
                        </p>
                        {p.shift.branchName && <p className="text-[11px] text-indigo-500">📍 {p.shift.branchName}</p>}
                      </div>
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center pt-2 border-t border-slate-100 dark:border-slate-700">
                        <div>
                          <p className="text-[10px] font-semibold text-slate-400 uppercase">{isIncoming ? 'Ty si necháš' : `${them.name} si nechá`}</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{keepStart}–{keepEnd}</p>
                        </div>
                        <SplitIcon className="w-5 h-5 text-indigo-400" />
                        <div className="text-right">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase">{isIncoming ? `${them.name} dostane` : 'Ty dostaneš'}</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{gotStart}–{gotEnd}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 justify-end">
                      {isIncoming ? (
                        <>
                          <button
                            onClick={() => handleSplitAction(p.id, 'reject')}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            Odmítnout
                          </button>
                          <button
                            onClick={() => handleSplitAction(p.id, 'accept')}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                          >
                            Rozdělit
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleSplitAction(p.id, 'reject')}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          Zrušit návrh
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Swap requests */}
        {swaps.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-purple-500" />
              Návrhy výměn ({swaps.length})
            </h2>
            <div className="space-y-2">
              {swaps.map(sw => {
                const isIncoming = sw.toUserId === user?.id
                const theirs  = isIncoming ? sw.fromShift : sw.toShift
                const mine    = isIncoming ? sw.toShift   : sw.fromShift
                const them    = isIncoming ? sw.fromUser  : sw.toUser
                return (
                  <div key={sw.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-purple-100 dark:border-purple-900/40 shadow-sm p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <UserAvatar name={them.name} color={them.color} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {isIncoming ? `${them.name} ti navrhuje výměnu` : `Navrhl/as výměnu s ${them.name}`}
                        </p>
                        {sw.message && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-0.5">&ldquo;{sw.message}&rdquo;</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-xs bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase">{isIncoming ? 'Ty dostaneš' : 'Ty se vzdáváš'}</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{theirs.roleNeeded}</p>
                        <p className="text-slate-500 dark:text-slate-400">
                          {format(parseISO(theirs.date + 'T12:00:00'), 'EEE d. M.', { locale: cs })} · {theirs.startTime}–{theirs.endTime}
                        </p>
                        {theirs.branchName && <p className="text-[11px] text-indigo-500">📍 {theirs.branchName}</p>}
                      </div>
                      <ArrowRightLeft className="w-5 h-5 text-purple-400" />
                      <div className="text-right">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase">{isIncoming ? 'Ty dáš' : 'Ty dostaneš'}</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{mine.roleNeeded}</p>
                        <p className="text-slate-500 dark:text-slate-400">
                          {format(parseISO(mine.date + 'T12:00:00'), 'EEE d. M.', { locale: cs })} · {mine.startTime}–{mine.endTime}
                        </p>
                        {mine.branchName && <p className="text-[11px] text-indigo-500">📍 {mine.branchName}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 justify-end">
                      {isIncoming ? (
                        <>
                          <button
                            onClick={() => handleSwapAction(sw.id, 'reject')}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            Odmítnout
                          </button>
                          <button
                            onClick={() => handleSwapAction(sw.id, 'accept')}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Přijmout výměnu
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleSwapAction(sw.id, 'reject')}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
                        >
                          <XIcon className="w-3.5 h-3.5" />
                          Zrušit návrh
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Upcoming shifts */}
        <section>
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-500" />
            Nadcházející směny
          </h2>

          {upcomingShifts.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-10 text-center">
              <p className="text-slate-400 dark:text-slate-500 text-sm">Žádné naplánované směny.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingShifts.map(shift => {
                const isToday   = shift.date === todayStr
                const isConfirmed = confirmedShifts.has(shift.id) || shift.status === 'confirmed'

                return (
                  <div
                    key={shift.id}
                    className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden ${
                      isToday ? 'border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-100 dark:ring-indigo-900/50' : 'border-slate-100 dark:border-slate-800'
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
                        <p className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none">
                          {format(parseISO(shift.date), 'd')}
                        </p>
                        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase">
                          {format(parseISO(shift.date), 'MMM', { locale: cs })}
                        </p>
                        <p className="text-[10px] text-slate-300 dark:text-slate-600">
                          {format(parseISO(shift.date), 'EEE', { locale: cs })}
                        </p>
                      </div>

                      <div className="w-px h-12 bg-slate-100 dark:bg-slate-800" />

                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 dark:text-slate-100">{shift.roleNeeded}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {shift.startTime}–{shift.endTime}
                          </span>
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                          <span>{getDuration(shift.startTime, shift.endTime)}</span>
                        </div>
                        {shift.notes && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1">{shift.notes}</p>
                        )}
                      </div>

                      <div className="flex-shrink-0 flex flex-col items-end gap-2">
                        <ShiftStatusBadge status={isConfirmed ? 'confirmed' : shift.status} />
                        <div className="flex items-center gap-1.5">
                          {!isConfirmed && shift.status === 'assigned' && (
                            <button
                              onClick={() => handleConfirm(shift.id)}
                              className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Potvrdit
                            </button>
                          )}
                          <button
                            onClick={() => openSwapDialog(shift)}
                            title="Navrhnout výměnu s kolegou"
                            className="flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            Vyměnit
                          </button>
                          <button
                            onClick={() => setGiveUpConfirm(shift.id)}
                            title="Nabídnout směnu k převzetí"
                            className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            <Handshake className="w-3.5 h-3.5" />
                            Dát pryč
                          </button>
                        </div>
                      </div>
                    </div>

                    {giveUpConfirm === shift.id && (
                      <div className="border-t border-slate-100 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-900/10 px-5 py-4">
                        <p className="text-xs text-amber-800 dark:text-amber-300 mb-3">
                          Opravdu chceš nabídnout tuto směnu k převzetí? Objeví se mezi volnými směnami a kdokoli z týmu si ji může vzít.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleGiveUp(shift.id)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            <Handshake className="w-3.5 h-3.5" />
                            Ano, nabídnout
                          </button>
                          <button
                            onClick={() => setGiveUpConfirm(null)}
                            className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            Zrušit
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Work logging */}
        <section>
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-indigo-500" />
            Záznamy práce
          </h2>

          {/* Add new log form */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 mb-4">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1.5">
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
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Příchod</label>
                    <input
                      type="time"
                      value={clockIn}
                      onChange={e => setClockIn(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Odchod</label>
                    <input
                      type="time"
                      value={clockOut}
                      onChange={e => setClockOut(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
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
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white w-full rounded-xl">
                Uložit záznam
              </Button>
            </form>
          </div>

          {/* Month selector + history */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize min-w-[90px] text-center">
                  {format(new Date(logMonth + '-01'), 'LLLL yyyy', { locale: cs })}
                </p>
                <button
                  onClick={nextMonth}
                  disabled={logMonth >= format(new Date(), 'yyyy-MM')}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 dark:text-slate-500">Celkem</p>
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{monthTotal}h</p>
              </div>
            </div>

            {monthLogs.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                Žádné záznamy za tento měsíc.
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {monthLogs.map(log => (
                  <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-shrink-0 text-center w-10">
                      <p className="text-lg font-black text-slate-800 dark:text-slate-200 leading-none">
                        {format(parseISO(log.date), 'd')}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">
                        {format(parseISO(log.date), 'EEE', { locale: cs })}
                      </p>
                    </div>
                    <div className="w-px h-8 bg-slate-100 dark:bg-slate-800 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{log.clockIn} – {log.clockOut}</p>
                      {log.notes && <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{log.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{log.hours}h</span>
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className="p-1 rounded-lg text-slate-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
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
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-amber-500" />
            Volné směny — přihlas se
          </h2>

          {openShifts.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-10 text-center">
              <p className="text-slate-400 dark:text-slate-500 text-sm">Žádné volné směny k dispozici.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {openShifts.map(shift => {
                const hasApplied = appliedShifts.has(shift.id)
                return (
                  <div
                    key={shift.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 flex items-center gap-4"
                  >
                    <div className="flex-shrink-0 text-center w-10">
                      <p className="text-xl font-black text-slate-700 dark:text-slate-300 leading-none">
                        {format(parseISO(shift.date), 'd')}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">
                        {format(parseISO(shift.date), 'EEE', { locale: cs })}
                      </p>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{shift.roleNeeded}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
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

      {/* Swap proposal modal */}
      {swapDialog && (
        <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 flex items-center justify-center p-4" onClick={() => setSwapDialog(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-purple-500" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Navrhnout výměnu</h3>
              </div>
              <button onClick={() => setSwapDialog(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* My shift summary */}
              <div className="bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl p-3 border border-indigo-100 dark:border-indigo-900/40">
                <p className="text-[10px] font-semibold text-indigo-500 uppercase mb-1">Vzdáváš se</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{swapDialog.myShift.roleNeeded}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {format(parseISO(swapDialog.myShift.date + 'T12:00:00'), 'EEE d. M.', { locale: cs })} · {swapDialog.myShift.startTime}–{swapDialog.myShift.endTime}
                </p>
              </div>

              {/* Pick colleague */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Výměna s kým?</label>
                <select
                  value={swapPickedUserId}
                  onChange={e => { setSwapPickedUserId(e.target.value); setSwapPickedShiftId('') }}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="">— Vyber kolegu —</option>
                  {colleagues.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Pick their shift */}
              {swapPickedUserId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Kterou jeho směnu bys vzal/a?</label>
                  {colleagueShifts.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">Tento kolega nemá žádnou nadcházející směnu.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-100 dark:border-slate-800 rounded-xl p-1.5">
                      {colleagueShifts.map(s => (
                        <label
                          key={s.id}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                            swapPickedShiftId === s.id
                              ? 'bg-purple-100 dark:bg-purple-900/40 border border-purple-300 dark:border-purple-700'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                          }`}
                        >
                          <input
                            type="radio"
                            name="swapShift"
                            value={s.id}
                            checked={swapPickedShiftId === s.id}
                            onChange={() => setSwapPickedShiftId(s.id)}
                            className="text-purple-600 focus:ring-purple-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{s.roleNeeded}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {format(parseISO(s.date + 'T12:00:00'), 'EEE d. M.', { locale: cs })} · {s.startTime}–{s.endTime}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Zpráva (nepovinné)</label>
                <input
                  type="text"
                  placeholder="např. prohodíme to? potřebuju volno…"
                  value={swapMessage}
                  onChange={e => setSwapMessage(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
            </div>

            <div className="flex gap-2 px-5 py-3 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSwapDialog(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Zrušit
              </button>
              <button
                onClick={handleProposeSwap}
                disabled={!swapPickedUserId || !swapPickedShiftId}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowRightLeft className="w-4 h-4" />
                Odeslat návrh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
