'use client'

import { useState, useEffect } from 'react'
import { format, addDays, parseISO, getISODay } from 'date-fns'
import { cs } from 'date-fns/locale'
import { Plus, Repeat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { createShiftsInDB, isRegistered } from '@/lib/db'
import type { User, Shift } from '@/types'
import { toast } from 'sonner'

const ROLES = [
  'Barista',
  'Číšník/Číšnice',
  'Pokladní',
  'Kuchař/Kuchařka',
  'Pomocná síla',
  'Manažer směny',
]

const WEEK_DAYS = [
  { label: 'Po', iso: 1 },
  { label: 'Út', iso: 2 },
  { label: 'St', iso: 3 },
  { label: 'Čt', iso: 4 },
  { label: 'Pá', iso: 5 },
  { label: 'So', iso: 6 },
  { label: 'Ne', iso: 7 },
]

type RepeatType = 'none' | 'daily' | 'weekly' | 'custom'

interface Props {
  trigger?: React.ReactNode
  defaultDate?: string
  employees?: User[]
  onShiftsCreated: (shifts: Shift[]) => void
}

function generateRepeatDates(
  startDate: string,
  type: RepeatType,
  until: string,
  customDays: number[],
): string[] {
  if (type === 'none') return [startDate]
  const dates: string[] = []
  const start = parseISO(startDate)
  const end   = parseISO(until)
  const startIso = getISODay(start)
  let current = start
  let count = 0
  while (current <= end && count < 366) {
    const dayIso = getISODay(current)
    const iso = format(current, 'yyyy-MM-dd')
    if (type === 'daily') dates.push(iso)
    else if (type === 'weekly' && dayIso === startIso) dates.push(iso)
    else if (type === 'custom' && customDays.includes(dayIso)) dates.push(iso)
    current = addDays(current, 1)
    count++
  }
  return dates
}

export function NewShiftDialog({ trigger, defaultDate, employees = [], onShiftsCreated }: Props) {
  const { activeBusiness } = useAuth()
  const [open, setOpen] = useState(false)
  const [businessPositions, setBusinessPositions] = useState<string[] | null>(null)

  useEffect(() => {
    if (!activeBusiness || !isRegistered(activeBusiness.id)) return
    fetch(`/api/business?bizId=${activeBusiness.id}`)
      .then(r => r.json())
      .then(d => { if (d.positions?.length) setBusinessPositions(d.positions) })
      .catch(() => {})
  }, [activeBusiness?.id])

  const roleOptions = businessPositions ?? ROLES

  // Base fields
  const [date,       setDate]       = useState(defaultDate ?? format(new Date(), 'yyyy-MM-dd'))
  const [startTime,  setStartTime]  = useState('08:00')
  const [endTime,    setEndTime]    = useState('16:00')
  const [role,       setRole]       = useState('')
  const [customRole, setCustomRole] = useState('')
  const [employeeId, setEmployeeId] = useState<string>('none')
  const [notes,      setNotes]      = useState('')

  // Repeat fields
  const [repeatType, setRepeatType] = useState<RepeatType>('none')
  const [repeatUntil, setRepeatUntil] = useState('')
  const [repeatDays, setRepeatDays] = useState<number[]>([1, 2, 3, 4, 5]) // Mon–Fri default

  const [error,   setError]   = useState('')
  const [saving,  setSaving]  = useState(false)

  const toggleDay = (iso: number) =>
    setRepeatDays(prev =>
      prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso]
    )

  const handleSubmit = async () => {
    const finalRole = role === '__custom' ? customRole.trim() : role
    if (!date)      { setError('Zadej datum směny.'); return }
    if (!finalRole) { setError('Zadej roli / pozici.'); return }
    if (startTime >= endTime) { setError('Konec musí být po začátku.'); return }
    if (repeatType !== 'none') {
      if (!repeatUntil) { setError('Zadej datum konce opakování.'); return }
      if (repeatUntil < date) { setError('Konec opakování musí být po prvním datu.'); return }
      if (repeatType === 'custom' && repeatDays.length === 0) { setError('Vyber alespoň jeden den.'); return }
    }

    setError('')
    setSaving(true)

    const employee = employeeId !== 'none'
      ? employees.find(e => e.id === employeeId) ?? undefined
      : undefined

    const dates = generateRepeatDates(date, repeatType, repeatUntil || date, repeatDays)

    const newShifts: Shift[] = dates.map((d, i) => ({
      id:               `s-${Date.now()}-${i}`,
      businessId:       activeBusiness?.id ?? 'biz-1',
      date:             d,
      startTime,
      endTime,
      roleNeeded:       finalRole,
      assignedEmployee: employee,
      status:           employee ? 'assigned' : 'open',
      notes:            notes.trim() || undefined,
    }))

    // Persist to Supabase for registered businesses
    if (activeBusiness && isRegistered(activeBusiness.id)) {
      try {
        await createShiftsInDB(
          newShifts.map(s => ({
            ...s,
            assignedEmployee: undefined,
            assignedEmployeeId: employee?.id,
          }))
        )
      } catch (e: any) {
        setError(`Chyba při ukládání: ${e.message}`)
        setSaving(false)
        return
      }
    }

    onShiftsCreated(newShifts)
    if (newShifts.length > 1) toast.success(`Vytvořeno ${newShifts.length} směn`)
    else toast.success('Směna uložena')

    setOpen(false)
    setRole(''); setCustomRole(''); setEmployeeId('none'); setNotes('')
    setRepeatType('none'); setRepeatUntil(''); setRepeatDays([1,2,3,4,5])
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
            <Plus className="w-4 h-4" />
            Nová směna
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Přidat novou směnu</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="ns-date">Datum</Label>
            <Input
              id="ns-date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border-slate-200"
            />
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ns-start">Začátek</Label>
              <Input id="ns-start" type="time" value={startTime}
                onChange={e => setStartTime(e.target.value)} className="border-slate-200" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-end">Konec</Label>
              <Input id="ns-end" type="time" value={endTime}
                onChange={e => setEndTime(e.target.value)} className="border-slate-200" />
            </div>
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label>Pozice / role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="border-slate-200">
                <SelectValue placeholder="Vyber pozici…" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                <SelectItem value="__custom">Vlastní…</SelectItem>
              </SelectContent>
            </Select>
            {role === '__custom' && (
              <Input placeholder="Napiš vlastní pozici" value={customRole}
                onChange={e => setCustomRole(e.target.value)} className="border-slate-200 mt-1.5" />
            )}
          </div>

          {/* Employee */}
          <div className="space-y-1.5">
            <Label>Přiřadit zaměstnance <span className="text-slate-400 font-normal">(volitelné)</span></Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="border-slate-200">
                <SelectValue placeholder="Nechat otevřenou…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nechat otevřenou</SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {employees.length === 0 && (
              <p className="text-[11px] text-slate-400">Zatím nemáš žádné zaměstnance. Přidej je přes Záložku Zaměstnanci.</p>
            )}
          </div>

          {/* ── REPEAT ─────────────────────────────────────────────────────── */}
          <div className="border border-slate-100 rounded-xl p-3.5 space-y-3 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="w-3.5 h-3.5 text-slate-400" />
                <Label className="text-sm font-semibold text-slate-700 cursor-pointer">Opakovat směnu</Label>
              </div>
              <Select value={repeatType} onValueChange={v => setRepeatType(v as RepeatType)}>
                <SelectTrigger className="w-36 h-8 text-xs border-slate-200 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Neopakovat</SelectItem>
                  <SelectItem value="daily">Každý den</SelectItem>
                  <SelectItem value="weekly">Každý týden</SelectItem>
                  <SelectItem value="custom">Vybrané dny</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {repeatType !== 'none' && (
              <>
                {/* Custom days picker */}
                {repeatType === 'custom' && (
                  <div>
                    <p className="text-[11px] text-slate-500 mb-1.5">Dny v týdnu</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {WEEK_DAYS.map(d => (
                        <button
                          key={d.iso}
                          type="button"
                          onClick={() => toggleDay(d.iso)}
                          className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                            repeatDays.includes(d.iso)
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Until date */}
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Opakovat do</Label>
                  <Input
                    type="date"
                    value={repeatUntil}
                    min={date}
                    onChange={e => setRepeatUntil(e.target.value)}
                    className="border-slate-200 bg-white h-9 text-sm"
                  />
                  {repeatUntil && date && (
                    <p className="text-[11px] text-indigo-500 font-medium">
                      Vytvoří {generateRepeatDates(date, repeatType, repeatUntil, repeatDays).length} směn
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="ns-notes">Poznámka <span className="text-slate-400 font-normal">(volitelné)</span></Label>
            <Textarea
              id="ns-notes"
              placeholder="Např. přinést vlastní zástěru…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="border-slate-200 resize-none h-16"
            />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Zrušit</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? 'Ukládám…' : repeatType !== 'none' ? 'Vytvořit směny' : 'Uložit směnu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
