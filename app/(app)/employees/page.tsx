'use client'

import { useState, useMemo } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { EMPLOYEES, SHIFTS, getWeeklyHours } from '@/lib/mock-data'
import { Search, Phone, Mail, Copy, Check, Clock, CalendarDays } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

type SortKey = 'name' | 'hours'

function getShiftsCount(employeeId: string) {
  return SHIFTS.filter(s => s.assignedEmployee?.id === employeeId).length
}

export default function EmployeesPage() {
  const { activeBusiness } = useAuth()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('name')
  const [copied, setCopied] = useState(false)

  const isNewBusiness = activeBusiness?.id.startsWith('biz-reg-')
  const baseEmployees = isNewBusiness ? [] : EMPLOYEES

  const joinCode = activeBusiness
    ? activeBusiness.id.replace(/\D/g, '').slice(-6).padStart(6, '0') || '111111'
    : '111111'

  const copyCode = () => {
    navigator.clipboard.writeText(joinCode).then(() => {
      setCopied(true)
      toast.success('Kód zkopírován')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const filtered = useMemo(() => {
    let result = baseEmployees.map(emp => ({
      ...emp,
      hours: getWeeklyHours(emp.id),
      shiftsCount: getShiftsCount(emp.id),
    }))
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.phone ?? '').includes(q)
      )
    }
    result.sort((a, b) => {
      if (sortBy === 'hours') return b.hours - a.hours
      return a.name.localeCompare(b.name, 'cs')
    })
    return result
  }, [search, sortBy, baseEmployees])

  const totalHours = filtered.reduce((s, e) => s + e.hours, 0)

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Zaměstnanci" subtitle={`${baseEmployees.length} aktivních členů týmu`} />

      <div className="flex-1 p-4 md:p-8 max-w-5xl">

        {/* Invite banner */}
        <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-2xl px-4 md:px-5 py-4 mb-5">
          <div>
            <p className="text-sm font-semibold text-indigo-900">Pozvat zaměstnance</p>
            <p className="text-xs text-indigo-500 mt-0.5 hidden sm:block">Sdílej kód podniku — zaměstnanec ho zadá při registraci</p>
          </div>
          <button
            onClick={copyCode}
            className="flex items-center gap-2 bg-white border border-indigo-200 hover:border-indigo-400 rounded-xl px-4 py-2 transition-all"
          >
            <span className="font-mono text-lg font-bold text-indigo-700 tracking-widest">{joinCode}</span>
            {copied
              ? <Check className="w-4 h-4 text-emerald-500" />
              : <Copy className="w-4 h-4 text-indigo-400" />}
          </button>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Zaměstnanců',   value: baseEmployees.length },
            { label: 'Směn (týden)',  value: isNewBusiness ? 0 : SHIFTS.filter(s => s.status !== 'open').length },
            { label: 'Hodin (týden)', value: `${totalHours}h` },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
              <p className="text-[11px] text-slate-400 mb-0.5">{s.label}</p>
              <p className="text-xl md:text-2xl font-bold text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              placeholder="Hledat zaměstnance…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 border-slate-200 focus-visible:ring-indigo-500 bg-white"
            />
          </div>
          <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-40 md:w-44 border-slate-200 bg-white shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Dle jména</SelectItem>
              <SelectItem value="hours">Dle hodin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── MOBILE: card list ──────────────────────────────────────────── */}
        <div className="md:hidden space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 px-6 py-12 text-center">
              <p className="text-sm text-slate-400">
                {isNewBusiness && !search
                  ? 'Zatím tu nejsou žádní zaměstnanci. Sdílej kód podniku výše.'
                  : 'Žádný zaměstnanec neodpovídá hledání.'
                }
              </p>
            </div>
          ) : filtered.map(emp => {
            const utilization = Math.min(100, Math.round((emp.hours / 40) * 100))
            return (
              <div key={emp.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center gap-3 mb-3">
                  <UserAvatar name={emp.name} color={emp.color} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{emp.name}</p>
                    <p className="text-xs text-slate-400 truncate">{emp.email}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] px-2 py-0 text-slate-500 shrink-0">
                    Zaměstnanec
                  </Badge>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-300" />
                    <span><strong className="text-slate-700">{emp.shiftsCount}</strong> směn</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-slate-300" />
                    <span><strong className="text-slate-700">{emp.hours}h</strong> týden</span>
                  </div>
                  {emp.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-auto">
                      <Phone className="w-3 h-3 text-slate-300" />
                      <span>{emp.phone}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Vytížení</span>
                    <span className={utilization >= 75 ? 'text-green-600 font-semibold' : utilization >= 40 ? 'text-amber-600 font-semibold' : 'text-slate-400'}>
                      {utilization}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        utilization >= 75 ? 'bg-green-500' : utilization >= 40 ? 'bg-amber-400' : 'bg-slate-300'
                      }`}
                      style={{ width: `${utilization}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── DESKTOP: table ─────────────────────────────────────────────── */}
        <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50/60">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Zaměstnanec</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Kontakt</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Směny</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Hodiny</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Vytížení</p>
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-slate-400">
                {isNewBusiness && !search
                  ? 'Zatím tu nejsou žádní zaměstnanci. Sdílej kód podniku výše.'
                  : 'Žádný zaměstnanec neodpovídá hledání.'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map(emp => {
                const utilization = Math.min(100, Math.round((emp.hours / 40) * 100))
                return (
                  <div key={emp.id} className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-4 px-6 py-4 items-center hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar name={emp.name} color={emp.color} size="md" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{emp.name}</p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-0.5 text-slate-500">Zaměstnanec</Badge>
                      </div>
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                        <Mail className="w-3 h-3 flex-shrink-0 text-slate-300" />
                        <span className="truncate">{emp.email}</span>
                      </div>
                      {emp.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Phone className="w-3 h-3 flex-shrink-0 text-slate-300" />
                          <span>{emp.phone}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-bold text-slate-800">{emp.shiftsCount}</span>
                      <p className="text-[10px] text-slate-400">směn</p>
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-bold text-slate-800">{emp.hours}h</span>
                      <p className="text-[10px] text-slate-400">týden</p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            utilization >= 75 ? 'bg-green-500' : utilization >= 40 ? 'bg-amber-400' : 'bg-slate-300'
                          }`}
                          style={{ width: `${utilization}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400">{utilization}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
