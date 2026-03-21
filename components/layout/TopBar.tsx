'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSidebar } from '@/contexts/SidebarContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useRouter } from 'next/navigation'
import { Bell, LogOut, Menu, CheckCircle2, XCircle, Settings, Moon, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { UserAvatar } from '@/components/shared/UserAvatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SHIFT_APPLICATIONS } from '@/lib/mock-data'
import { isRegistered } from '@/lib/db'
import { format, parseISO } from 'date-fns'
import { cs } from 'date-fns/locale'
import Link from 'next/link'

interface TopBarProps {
  title: string
  subtitle?: string
}

interface FlatApp {
  id: string
  shiftId: string
  employeeId: string
  employeeName: string
  status: string
  createdAt: string
  shiftDate: string
  startTime: string
  endTime: string
  roleNeeded: string
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const { user, logout, activeBusiness } = useAuth()
  const { setOpen } = useSidebar()
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()

  const [apps, setApps] = useState<FlatApp[]>([])

  useEffect(() => {
    if (!activeBusiness || user?.role !== 'manager') return
    if (isRegistered(activeBusiness.id)) {
      fetch(`/api/shift-applications?bizId=${activeBusiness.id}`)
        .then(r => r.json())
        .then((data: FlatApp[]) => setApps(data.filter(a => a.status === 'pending')))
        .catch(() => {})
    } else {
      // Map mock ShiftApplications to flat format
      setApps(SHIFT_APPLICATIONS.filter(a => a.status === 'pending').map(a => ({
        id: a.id,
        shiftId: a.shift.id,
        employeeId: a.employee.id,
        employeeName: a.employee.name,
        status: a.status,
        createdAt: a.createdAt,
        shiftDate: a.shift.date,
        startTime: a.shift.startTime,
        endTime: a.shift.endTime,
        roleNeeded: a.shift.roleNeeded,
      })))
    }
  }, [activeBusiness?.id, user?.role])

  const handleApprove = async (app: FlatApp) => {
    if (isRegistered(activeBusiness?.id ?? '')) {
      await fetch('/api/shift-applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: app.id, status: 'approved', shiftId: app.shiftId, employeeId: app.employeeId }),
      })
      setApps(prev => prev.filter(a => a.shiftId !== app.shiftId))
    } else {
      setApps(prev => prev.filter(a => a.id !== app.id))
    }
    toast.success('Přihláška schválena')
  }

  const handleReject = async (id: string) => {
    if (isRegistered(activeBusiness?.id ?? '')) {
      await fetch('/api/shift-applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'rejected' }),
      })
    }
    setApps(prev => prev.filter(a => a.id !== id))
    toast.error('Přihláška zamítnuta')
  }

  const handleLogout = () => {
    logout()
    toast.success('Odhlášen/a')
    router.push('/login')
  }

  return (
    <div className="h-16 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-8 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <button
          className="md:hidden p-2 -ml-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          onClick={() => setOpen(true)}
          aria-label="Otevřít menu"
        >
          <Menu className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        </button>

        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2">

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          aria-label="Přepnout tmavý režim"
        >
          {theme === 'dark'
            ? <Sun className="w-5 h-5 text-slate-400 dark:text-slate-400" />
            : <Moon className="w-5 h-5 text-slate-500" />
          }
        </button>

        {/* Bell notifications (manager only) */}
        {user?.role === 'manager' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Bell className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                {apps.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Přihlášky na směny</span>
                {apps.length > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {apps.length}
                  </span>
                )}
              </div>

              {apps.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <div className="text-2xl mb-2">🎉</div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Vše vyřízeno</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Žádné čekající přihlášky</p>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
                  {apps.map(app => (
                    <div key={app.id} className="px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <UserAvatar name={app.employeeName} color="#6366f1" size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{app.employeeName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{app.roleNeeded}</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {app.shiftDate ? format(parseISO(app.shiftDate), 'EEE d. M.', { locale: cs }) : ''} · {app.startTime}–{app.endTime}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => handleApprove(app)}
                            className="p-1.5 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                            title="Schválit"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReject(app.id)}
                            className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                            title="Zamítnout"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40">
                <Link href="/open-shifts" className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium">
                  Zobrazit všechny volné směny →
                </Link>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* User menu */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <UserAvatar name={user.name} color={user.color} size="sm" />
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">{user.name.split(' ')[0]}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 capitalize">
                    {user.role === 'manager' ? 'Manažer' : user.role === 'superadmin' ? 'Super Admin' : 'Zaměstnanec'}
                  </div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <div className="font-semibold text-slate-800 dark:text-slate-200">{user.name}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500 font-normal">{user.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="w-3.5 h-3.5 mr-2" />
                  Nastavení
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20 cursor-pointer">
                <LogOut className="w-3.5 h-3.5 mr-2" />
                Odhlásit se
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}
