'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Copy, Check, Building2, User, ShieldCheck, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const { user, activeBusiness, logout } = useAuth()
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  const isNewBusiness = activeBusiness?.id.startsWith('biz-reg-')
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

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Nastavení" />

      <div className="flex-1 p-4 md:p-8 max-w-2xl space-y-6">

        {/* Profile */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-50 bg-slate-50/60">
            <User className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Profil</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              <UserAvatar name={user?.name ?? ''} color={user?.color} size="lg" />
              <div>
                <p className="font-bold text-slate-900">{user?.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
                <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                  {user?.role === 'manager' ? 'Manažer' : user?.role === 'superadmin' ? 'Super Admin' : 'Zaměstnanec'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Jméno</Label>
                <Input value={user?.name ?? ''} readOnly className="bg-slate-50 border-slate-200 text-slate-700" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">E-mail</Label>
                <Input value={user?.email ?? ''} readOnly className="bg-slate-50 border-slate-200 text-slate-700" />
              </div>
            </div>
            <p className="text-xs text-slate-400">Úprava profilu bude dostupná v placené verzi.</p>
          </div>
        </section>

        {/* Business */}
        {activeBusiness && user?.role !== 'superadmin' && (
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-50 bg-slate-50/60">
              <Building2 className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700">Podnik</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Název podniku</Label>
                  <Input value={activeBusiness.name} readOnly className="bg-slate-50 border-slate-200 text-slate-700" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Lokalita</Label>
                  <Input value={activeBusiness.location || '—'} readOnly className="bg-slate-50 border-slate-200 text-slate-700" />
                </div>
              </div>

              {user?.role === 'manager' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Kód pro pozvání zaměstnanců</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
                      <span className="font-mono text-xl font-bold text-indigo-700 tracking-widest">{joinCode}</span>
                    </div>
                    <button
                      onClick={copyCode}
                      className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-semibold rounded-lg transition-colors border border-indigo-100"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Zkopírováno' : 'Kopírovat'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">Sdílej tento kód zaměstnancům při registraci.</p>
                </div>
              )}

              {!isNewBusiness && (
                <p className="text-xs text-slate-400">Demo podnik · úpravy jsou dostupné v placené verzi.</p>
              )}
            </div>
          </section>
        )}

        {/* Security */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-50 bg-slate-50/60">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Zabezpečení</h2>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              Změna hesla a dvoufaktorové ověření budou dostupné v placené verzi.
            </p>
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 gap-2"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              Odhlásit se
            </Button>
          </div>
        </section>

        {/* App version */}
        <p className="text-xs text-slate-300 text-center pb-2">Směny · Demo verze 0.1 · KSH Web Studio</p>

      </div>
    </div>
  )
}
