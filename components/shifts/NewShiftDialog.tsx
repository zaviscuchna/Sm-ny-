'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
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
import { EMPLOYEES, BUSINESS } from '@/lib/mock-data'
import type { Shift } from '@/types'

const ROLES = [
  'Barista',
  'Číšník/Číšnice',
  'Pokladní',
  'Kuchař/Kuchařka',
  'Pomocná síla',
  'Manažer směny',
]

interface Props {
  trigger?: React.ReactNode
  defaultDate?: string          // 'YYYY-MM-DD'
  onShiftCreated: (shift: Shift) => void
}

export function NewShiftDialog({ trigger, defaultDate, onShiftCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [date, setDate]           = useState(defaultDate ?? new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime]     = useState('16:00')
  const [role, setRole]           = useState('')
  const [customRole, setCustomRole] = useState('')
  const [employeeId, setEmployeeId] = useState<string>('none')
  const [notes, setNotes]         = useState('')
  const [error, setError]         = useState('')

  const handleSubmit = () => {
    const finalRole = role === '__custom' ? customRole.trim() : role
    if (!date)       { setError('Zadej datum směny.'); return }
    if (!finalRole)  { setError('Zadej roli / pozici.'); return }
    if (startTime >= endTime) { setError('Konec musí být po začátku.'); return }

    setError('')

    const employee = employeeId && employeeId !== 'none'
      ? EMPLOYEES.find(e => e.id === employeeId) ?? undefined
      : undefined

    const newShift: Shift = {
      id:               `s-${Date.now()}`,
      businessId:       BUSINESS.id,
      date,
      startTime,
      endTime,
      roleNeeded:       finalRole,
      assignedEmployee: employee,
      status:           employee ? 'assigned' : 'open',
      notes:            notes.trim() || undefined,
    }

    onShiftCreated(newShift)
    setOpen(false)
    // reset
    setRole(''); setCustomRole(''); setEmployeeId('none'); setNotes(''); setError('')
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

      <DialogContent className="sm:max-w-md">
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
              <Input
                id="ns-start"
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="border-slate-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-end">Konec</Label>
              <Input
                id="ns-end"
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="border-slate-200"
              />
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
                {ROLES.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
                <SelectItem value="__custom">Vlastní…</SelectItem>
              </SelectContent>
            </Select>
            {role === '__custom' && (
              <Input
                placeholder="Napiš vlastní pozici"
                value={customRole}
                onChange={e => setCustomRole(e.target.value)}
                className="border-slate-200 mt-1.5"
              />
            )}
          </div>

          {/* Employee (optional) */}
          <div className="space-y-1.5">
            <Label>Přiřadit zaměstnance <span className="text-slate-400 font-normal">(volitelné)</span></Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="border-slate-200">
                <SelectValue placeholder="Nechat otevřenou…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nechat otevřenou</SelectItem>
                {EMPLOYEES.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="ns-notes">Poznámka <span className="text-slate-400 font-normal">(volitelné)</span></Label>
            <Textarea
              id="ns-notes"
              placeholder="Např. přinést vlastní zástěru…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="border-slate-200 resize-none h-20"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Zrušit</Button>
          <Button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-700">
            Uložit směnu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
