'use client'

import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { ALL_BUSINESS_STATS, ALL_SHIFTS } from '@/lib/mock-data'
import { Building2, Users, CalendarDays, TrendingUp, MapPin, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const COVERAGE_LABEL: Record<string, { label: string; color: string; badge: string }> = {
  full:    { label: 'Plné pokrytí',     color: 'text-green-600',  badge: 'bg-green-50 text-green-700 border-green-200' },
  partial: { label: 'Částečné pokrytí', color: 'text-amber-600',  badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  low:     { label: 'Nízké pokrytí',    color: 'text-red-600',    badge: 'bg-red-50 text-red-600 border-red-200' },
}

export default function AdminPage() {
  const { user, switchBusiness } = useAuth()

  const totalShifts    = ALL_SHIFTS.length
  const totalOpen      = ALL_SHIFTS.filter(s => s.status === 'open').length
  const totalEmployees = ALL_BUSINESS_STATS.reduce((acc, b) => acc + b.employeeCount, 0)

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Super Admin" subtitle="Přehled všech podniků" />

      <div className="flex-1 p-4 md:p-8 max-w-5xl space-y-8">

        {/* Global stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Počet podniků',      value: ALL_BUSINESS_STATS.length, icon: Building2,    color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Celkem zaměstnanců', value: totalEmployees,            icon: Users,         color: 'text-green-600',  bg: 'bg-green-50'  },
            { label: 'Otevřené směny',     value: totalOpen,                 icon: CalendarDays,  color: 'text-amber-600',  bg: 'bg-amber-50'  },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-medium text-slate-500">{s.label}</p>
                <div className={`${s.bg} ${s.color} p-1.5 rounded-lg`}>
                  <s.icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Businesses grid */}
        <div>
          <h2 className="text-sm font-bold text-slate-700 mb-4">Podniky</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ALL_BUSINESS_STATS.map(stat => {
              const cov = COVERAGE_LABEL[stat.weekCoverage]
              const coverage = Math.round(((stat.totalShifts - stat.openShifts) / Math.max(stat.totalShifts, 1)) * 100)

              return (
                <div key={stat.business.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:border-indigo-200 hover:shadow-md transition-all group">
                  {/* Header */}
                  <div className="p-5 border-b border-slate-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-shrink-0 w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                        <Building2 className="w-4.5 h-4.5 text-indigo-600" />
                      </div>
                      <Badge variant="outline" className={`text-[10px] px-1.5 ${cov.badge}`}>
                        {cov.label}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-slate-900 mt-3">{stat.business.name}</h3>
                    <p className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {stat.business.location}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="px-5 py-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-slate-400" />
                        Zaměstnanci
                      </span>
                      <span className="font-semibold text-slate-800">{stat.employeeCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <CalendarDays className="w-3 h-3 text-slate-400" />
                        Celkem směn
                      </span>
                      <span className="font-semibold text-slate-800">{stat.totalShifts}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Otevřené</span>
                      <span className={`font-semibold ${stat.openShifts > 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {stat.openShifts}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Potvrzené</span>
                      <span className="font-semibold text-green-600">{stat.confirmedShifts}</span>
                    </div>

                    {/* Coverage bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Obsazenost</span>
                        <span className="font-semibold">{coverage}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            coverage >= 80 ? 'bg-green-500' :
                            coverage >= 50 ? 'bg-amber-400' :
                                             'bg-red-400'
                          }`}
                          style={{ width: `${coverage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Manager */}
                  {stat.manager && (
                    <div className="px-5 pb-4 border-t border-slate-50 pt-3">
                      <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-wide">Manažer</p>
                      <div className="flex items-center gap-2">
                        <UserAvatar name={stat.manager.name} color={stat.manager.color} size="sm" />
                        <div>
                          <p className="text-xs font-semibold text-slate-700 leading-tight">{stat.manager.name}</p>
                          <p className="text-[10px] text-slate-400">{stat.manager.email}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action */}
                  <div className="px-5 pb-5">
                    <button
                      onClick={() => switchBusiness(stat.business.id)}
                      className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 py-2 rounded-xl transition-colors"
                    >
                      Přepnout na podnik
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* All shifts overview */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-slate-700">Globální přehled směn</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {ALL_BUSINESS_STATS.map(stat => (
              <div key={stat.business.id} className="flex items-center gap-4 px-6 py-3.5">
                <p className="text-sm font-semibold text-slate-800 w-44 truncate">{stat.business.name}</p>
                <div className="flex-1 flex items-center gap-1.5">
                  {Array.from({ length: stat.totalShifts }, (_, i) => (
                    <div
                      key={i}
                      className={`h-5 flex-1 rounded ${
                        i < stat.confirmedShifts ? 'bg-green-400' :
                        i < stat.totalShifts - stat.openShifts ? 'bg-blue-400' :
                        'bg-red-300'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-xs text-slate-400 w-24 text-right">
                  {stat.totalShifts - stat.openShifts}/{stat.totalShifts} obsazeno
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 px-6 py-3 border-t border-slate-50 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-400 inline-block" /> Potvrzeno</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-400 inline-block" /> Přiřazeno</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-300 inline-block" /> Volná</span>
          </div>
        </div>

      </div>
    </div>
  )
}
