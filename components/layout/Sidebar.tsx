'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, CalendarDays, Clock, Users,
  UserCheck, LogOut, Coffee, ChevronRight,
  Building2, ChevronLeft, ShieldCheck, Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useSidebar } from '@/contexts/SidebarContext'
import { toast } from 'sonner'
import type { Role } from '@/types'
import { Sheet, SheetContent } from '@/components/ui/sheet'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles: Role[]
}

const NAV: NavItem[] = [
  { href: '/dashboard',   label: 'Dashboard',       icon: LayoutDashboard, roles: ['manager'] },
  { href: '/shifts',      label: 'Plán směn',       icon: CalendarDays,    roles: ['manager'] },
  { href: '/open-shifts', label: 'Volné směny',     icon: Clock,           roles: ['manager', 'employee'] },
  { href: '/employees',   label: 'Zaměstnanci',     icon: Users,           roles: ['manager'] },
  { href: '/my-shifts',   label: 'Moje směny',      icon: UserCheck,       roles: ['employee'] },
  { href: '/settings',    label: 'Nastavení',        icon: Settings,        roles: ['manager', 'employee'] },
]

const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Super Admin',
  manager:    'Manažer',
  employee:   'Zaměstnanec',
}

function UserAvatar({ name, color }: { name: string; color?: string }) {
  const initials = name.split(' ').map(p => p[0]).slice(0, 2).join('')
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
      style={{ background: color || '#6366f1' }}
    >
      {initials}
    </div>
  )
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const { user, logout, activeBusiness, clearBusiness } = useAuth()

  const isSuperAdmin   = user?.role === 'superadmin'
  const isInBizContext = isSuperAdmin && activeBusiness !== null

  const handleLogout = () => {
    logout()
    toast.success('Odhlášen')
    router.push('/login')
    onClose?.()
  }

  const handleBackToOverview = () => {
    clearBusiness()
    router.push('/admin')
    onClose?.()
  }

  const visibleNav = isSuperAdmin && !isInBizContext
    ? []
    : NAV.filter(item => user && item.roles.includes(
        isInBizContext ? 'manager' : user.role
      ))

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slate-100 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
          <Coffee className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-900 leading-tight">Směny</div>
          <div className="text-[10px] text-slate-400 leading-tight">organizátor</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {isInBizContext && (
          <div className="mb-3">
            <button
              onClick={handleBackToOverview}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors w-full px-2 py-1.5 rounded-lg hover:bg-indigo-50"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Zpět na přehled
            </button>
            <div className="mt-2 mb-3 mx-1 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100">
              <div className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-0.5">Prohlížíš jako</div>
              <div className="text-xs font-semibold text-indigo-700 leading-tight">{activeBusiness.name}</div>
              <div className="text-[10px] text-indigo-400">{activeBusiness.location}</div>
            </div>
          </div>
        )}

        {isSuperAdmin && !isInBizContext && (
          <Link
            href="/admin"
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
              pathname.startsWith('/admin')
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            <Building2 className={cn('w-4 h-4', pathname.startsWith('/admin') ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600')} />
            Přehled provozoven
            {pathname.startsWith('/admin') && <ChevronRight className="w-3 h-3 ml-auto text-indigo-400" />}
          </Link>
        )}

        {visibleNav.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <item.icon className={cn('w-4 h-4', active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600')} />
              {item.label}
              {active && <ChevronRight className="w-3 h-3 ml-auto text-indigo-400" />}
            </Link>
          )
        })}
      </nav>

      {user && (
        <div className="p-3 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5 p-2 rounded-lg mb-1">
            <UserAvatar name={user.name} color={user.color} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-800 truncate">{user.name}</div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                {isSuperAdmin && <ShieldCheck className="w-2.5 h-2.5 text-indigo-400" />}
                <span className="capitalize">{ROLE_LABELS[user.role]}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Odhlásit se
          </button>
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const { open, setOpen } = useSidebar()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 bg-white border-r border-slate-100 flex-col h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-60 border-r border-slate-100">
          <SidebarContent onClose={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}
