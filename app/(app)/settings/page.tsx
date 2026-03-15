'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Copy, Check, Building2, User, ShieldCheck, LogOut, Briefcase, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const { user, activeBusiness, joinCode: ctxJoinCode, logout } = useAuth()
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [positions, setPositions] = useState<string[]>([])
  const [newPos, setNewPos] = useState('')
  const [savingPos, setSavingPos] = useState(false)

  useEffect(() => {
    if (!activeBusiness?.id.startsWith('biz-reg-')) return
    fetch(`/api/business?bizId=${activeBusiness.id}`)
      .then(r => r.json())
      .then(d => { if (d.positions) setPositions(d.positions) })
      .catch(() => {})
  }, [activeBusiness?.id])

  const isNewBusiness = activeBusiness?.id.startsWith('biz-reg-')
  // Use join code from context (real code for Supabase businesses) or derive from id for demo
  const joinCode = ctxJoinCode
    ?? (activeBusiness ? activeBusiness.id.replace(/\D/g, '').slice(-6).padStart(6, '0') || '111111' : '111111')

  const addPosition = () => {
    const p = newPos.trim()
    if (!p || positions.includes(p)) return
    setPositions(prev => [...prev, p])
    setNewPos('')
  }

  const removePosition = (p: string) => setPositions(prev => prev.filter(x => x !== p))

  const savePositions = async () => {
    if (!activeBusiness) return
    setSavingPos(true)
    try {
      await fetch('/api/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bizId: activeBusiness.id, positions }),
      })
      toast.success('Pozice uloženy')
    } catch {
      toast.error('Chyba při ukládání')
    }
    setSavingPos(false)
  }

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

        {/* Positions */}
        {user?.role === 'manager' && isNewBusiness && (
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-50 bg-slate-50/60">
              <Briefcase className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700">Pracovní pozice</h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-500">Přidej pozice které budou dostupné při vytváření směn.</p>

              <div className="flex flex-wrap gap-2 min-h-[2rem]">
                {positions.length === 0 && (
                  <p className="text-xs text-slate-400 italic">Zatím žádné pozice — přidej první níže.</p>
                )}
                {positions.map(p => (
                  <span key={p} className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-full border border-indigo-100">
                    {p}
                    <button onClick={() => removePosition(p)} className="text-indigo-400 hover:text-indigo-700 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Název pozice (např. Barista, Kuchař…)"
                  value={newPos}
                  onChange={e => setNewPos(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPosition()}
                  className="border-slate-200"
                />
                <Button variant="outline" onClick={addPosition} className="shrink-0 gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                  <Plus className="w-4 h-4" />
                  Přidat
                </Button>
              </div>

              <Button onClick={savePositions} disabled={savingPos} className="bg-indigo-600 hover:bg-indigo-700">
                {savingPos ? 'Ukládám…' : 'Uložit pozice'}
              </Button>
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
