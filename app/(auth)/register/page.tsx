'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, ArrowLeft, ChevronRight, Eye, EyeOff } from 'lucide-react'

type Flow = 'manager' | 'employee' | null

export default function RegisterPage() {
  const router = useRouter()
  const { register } = useAuth()

  const [flow, setFlow] = useState<Flow>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Manager fields
  const [bizName, setBizName] = useState('')
  const [location, setLocation] = useState('')
  // Shared fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  // Employee fields
  const [joinCode, setJoinCode] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Heslo musí mít alespoň 6 znaků.'); return }
    if (password !== confirmPassword) { setError('Hesla se neshodují.'); return }
    setLoading(true)

    const result = await register(flow!, {
      name,
      email,
      password,
      businessName: flow === 'manager' ? bizName : undefined,
      location:     flow === 'manager' ? location : undefined,
      joinCode:     flow === 'employee' ? joinCode : undefined,
    })

    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Registrace selhala.')
      return
    }

    if (result.role === 'manager') router.push('/dashboard?welcome=1')
    else router.push('/my-shifts?welcome=1')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-100 font-bold text-xl">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">S</div>
            Směny
          </Link>
        </div>

        {/* Step 1 — choose type */}
        {!flow && (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="text-center">
              <CardTitle className="text-slate-100">Vytvořit účet</CardTitle>
              <CardDescription className="text-slate-400">Jak chceš Směnky využívat?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                onClick={() => setFlow('manager')}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-slate-700 hover:border-indigo-500 hover:bg-slate-800/60 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-600/20 flex items-center justify-center shrink-0 group-hover:bg-indigo-600/30 transition-colors">
                  <Building2 className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-100">Zaregistrovat podnik</div>
                  <div className="text-xs text-slate-400 mt-0.5">Jsem manažer / majitel — chci spravovat směny</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
              </button>

              <button
                onClick={() => setFlow('employee')}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-slate-700 hover:border-indigo-500 hover:bg-slate-800/60 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center shrink-0 group-hover:bg-emerald-600/30 transition-colors">
                  <Users className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-100">Připojit se k podniku</div>
                  <div className="text-xs text-slate-400 mt-0.5">Jsem zaměstnanec — mám kód od manažera</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
              </button>

              <p className="text-center text-xs text-slate-500 pt-2">
                Už máš účet?{' '}
                <Link href="/login" className="text-indigo-400 hover:text-indigo-300">Přihlásit se</Link>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 2a — Manager */}
        {flow === 'manager' && (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <button
                onClick={() => { setFlow(null); setError('') }}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-1"
              >
                <ArrowLeft className="w-3 h-3" /> Zpět
              </button>
              <CardTitle className="text-slate-100">Nový podnik</CardTitle>
              <CardDescription className="text-slate-400">Zaregistruj svou firmu a začni plánovat směny</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Název podniku *</Label>
                  <Input
                    value={bizName}
                    onChange={e => setBizName(e.target.value)}
                    placeholder="Kavárna U Mlýna"
                    required
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Město / pobočka</Label>
                  <Input
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="Praha 2"
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
                <div className="border-t border-slate-800 pt-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs">Tvoje jméno *</Label>
                    <Input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Jan Novák"
                      required
                      className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs">E-mail *</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="jan@firma.cz"
                      required
                      className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs">Heslo *</Label>
                    <div className="relative">
                      <Input
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Minimálně 6 znaků"
                        required
                        className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 pr-10"
                      />
                      <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs">Potvrdit heslo *</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Zopakuj heslo"
                      required
                      className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                </div>

                {error && <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{error}</p>}

                <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500">
                  {loading ? 'Zakládám...' : 'Zaregistrovat podnik'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 2b — Employee */}
        {flow === 'employee' && (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <button
                onClick={() => { setFlow(null); setError('') }}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-1"
              >
                <ArrowLeft className="w-3 h-3" /> Zpět
              </button>
              <CardTitle className="text-slate-100">Připojit se k podniku</CardTitle>
              <CardDescription className="text-slate-400">Zadej kód, který ti dal manažer</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Tvoje jméno *</Label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Jana Nováková"
                    required
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">E-mail *</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="jana@email.cz"
                    required
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Heslo *</Label>
                  <div className="relative">
                    <Input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Minimálně 6 znaků"
                      required
                      className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 pr-10"
                    />
                    <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Potvrdit heslo *</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Zopakuj heslo"
                    required
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Kód podniku *</Label>
                  <Input
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value)}
                    placeholder="111111"
                    maxLength={6}
                    required
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 font-mono tracking-widest text-center text-lg"
                  />
                  <p className="text-xs text-slate-500">Demo: použij kód <span className="font-mono text-slate-400">111111</span></p>
                </div>

                {error && <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{error}</p>}

                <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500">
                  {loading ? 'Připojuji...' : 'Připojit se'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  )
}
