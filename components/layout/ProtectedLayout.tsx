'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Coffee } from 'lucide-react'

export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

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
