'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Coffee } from 'lucide-react'

const MANAGER_ROUTES   = ['/dashboard', '/shifts', '/employees', '/open-shifts', '/calendar', '/settings', '/qr', '/history', '/payroll', '/my-shifts']
const EMPLOYEE_ROUTES  = ['/my-shifts', '/open-shifts', '/calendar', '/settings', '/history', '/payroll']
const SUPERADMIN_ROUTES = ['/admin', '/settings']

export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/login'); return }

    const role = user.role
    if (role === 'employee' && !EMPLOYEE_ROUTES.some(r => pathname.startsWith(r))) {
      router.replace('/my-shifts')
    } else if (role === 'manager' && !MANAGER_ROUTES.some(r => pathname.startsWith(r))) {
      router.replace('/dashboard')
    } else if (role === 'superadmin' && !SUPERADMIN_ROUTES.some(r => pathname.startsWith(r))
      // superadmin browsing a biz context can access manager routes
      && !MANAGER_ROUTES.some(r => pathname.startsWith(r))) {
      router.replace('/admin')
    }
  }, [user, loading, router, pathname])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center animate-pulse">
            <Coffee className="w-6 h-6 text-white" />
          </div>
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}
