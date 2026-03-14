'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { SHIFTS, SHIFT_APPLICATIONS, EMPLOYEES } from '@/lib/mock-data'
import type { Shift, ShiftApplication } from '@/types'
import { Clock, Calendar, Briefcase, CheckCircle2, XCircle, UserPlus, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

function getDuration(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return `${(eh + em / 60) - (sh + sm / 60)}h`
}

export default function OpenShiftsPage() {
  const { user } = useAuth()
  const isManager = user?.role === 'manager'

  const [openShifts, setOpenShifts] = useState(SHIFTS.filter(s => s.status === 'open'))
  const [apps, setApps] = useState<ShiftApplication[]>(SHIFT_APPLICATIONS)
  const [appliedShifts, setAppliedShifts] = useState<Set<string>>(new Set())
  const [expandedShift, setExpandedShift] = useState<string | null>(null)

  const handleApply = (shift: Shift) => {
    if (!user) return
    const newApp: ShiftApplication = {
      id: `app-${Date.now()}`,
      shift,
      employee: user,
      status: 'pending',
      createdAt: format(new Date(), 'yyyy-MM-dd'),
    }
    setApps(prev => [...prev, newApp])
    setAppliedShifts(prev => new Set(prev).add(shift.id))
    toast.success('Přihláška odeslána! Manažer vás bude informovat.')
  }

  const handleApprove = (appId: string) => {
    setApps(prev => prev.map(a => a.id === appId ? { ...a, status: 'approved' } : a))
    toast.success('Přihláška schválena')
  }

  const handleReject = (appId: string) => {
    setApps(prev => prev.map(a => a.id === appId ? { ...a, status: 'rejected' } : a))
    toast.error('Přihláška zamítnuta')
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
                              {format(new Date(shift.date), 'EEEE d. M.', { locale: cs })}
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

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isManager ? (
                            <>
                              {pendingApps.length > 0 && (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                                  {pendingApps.length} čeká
                                </Badge>
                              )}
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
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

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
