'use client'

import { useBranch } from '@/contexts/BranchContext'
import { isRegistered } from '@/lib/db'
import { useAuth } from '@/contexts/AuthContext'
import { MapPin } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export function BranchSwitcher({ className }: { className?: string }) {
  const { activeBusiness } = useAuth()
  const { branches, activeBranch, setActiveBranch } = useBranch()

  if (!activeBusiness || !isRegistered(activeBusiness.id)) return null
  if (branches.length === 0) return null

  return (
    <div className={className}>
      <Select
        value={activeBranch?.id ?? 'all'}
        onValueChange={v => {
          if (v === 'all') setActiveBranch(null)
          else setActiveBranch(branches.find(b => b.id === v) ?? null)
        }}
      >
        <SelectTrigger className="h-9 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <SelectValue placeholder="Všechny pobočky" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Všechny pobočky</SelectItem>
          {branches.map(b => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}{b.address ? ` · ${b.address}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
