'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CalendarDays, Users, ArrowRight, Sparkles } from 'lucide-react'

function WelcomeModalInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, activeBusiness } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (searchParams.get('welcome') === '1') {
      setOpen(true)
      // Remove the param from URL without page reload
      const url = new URL(window.location.href)
      url.searchParams.delete('welcome')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  const isManager = user?.role === 'manager'

  const handleAction = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center items-center pb-2">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mb-3 shadow-lg shadow-indigo-200">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <DialogTitle className="text-xl">
            {isManager ? 'Podnik je připraven!' : 'Vítej v aplikaci!'}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 mt-1">
            {isManager
              ? `${activeBusiness?.name ?? 'Tvůj podnik'} byl úspěšně zaregistrován. Jako první krok doporučujeme:`
              : `Jsi připojený/á k podniku${activeBusiness ? ` ${activeBusiness.name}` : ''}. Co chceš udělat jako první?`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {isManager ? (
            <>
              <button
                onClick={() => handleAction('/shifts')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-indigo-100 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-200 transition-colors">
                  <CalendarDays className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900">Vytvořit první směnu</div>
                  <div className="text-xs text-slate-400 mt-0.5">Přidej pracovní čas a roli</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
              </button>

              <button
                onClick={() => handleAction('/employees')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-slate-100 hover:border-indigo-200 hover:bg-slate-50 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors">
                  <Users className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900">Pozvat zaměstnance</div>
                  <div className="text-xs text-slate-400 mt-0.5">Sdílej kód podniku</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
              </button>
            </>
          ) : (
            <button
              onClick={() => handleAction('/open-shifts')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-indigo-100 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-200 transition-colors">
                <CalendarDays className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900">Zobrazit volné směny</div>
                <div className="text-xs text-slate-400 mt-0.5">Přihlas se na dostupné pozice</div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
            </button>
          )}

          <Button variant="ghost" className="w-full text-slate-500" onClick={() => setOpen(false)}>
            Prohlédnu si to sám/sama
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function WelcomeModal() {
  return (
    <Suspense>
      <WelcomeModalInner />
    </Suspense>
  )
}
