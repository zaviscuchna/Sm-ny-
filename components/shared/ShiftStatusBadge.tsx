import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ShiftStatus } from '@/types'

const CONFIG: Record<ShiftStatus, { label: string; className: string }> = {
  confirmed: { label: 'Potvrzeno',  className: 'bg-green-50 text-green-700 border-green-200' },
  assigned:  { label: 'Přiřazeno', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  pending:   { label: 'Čeká',      className: 'bg-amber-50 text-amber-700 border-amber-200' },
  open:      { label: 'Volná',     className: 'bg-red-50 text-red-600 border-red-200' },
}

export function ShiftStatusBadge({ status }: { status: ShiftStatus }) {
  const cfg = CONFIG[status]
  return (
    <Badge variant="outline" className={cn('text-[10px] font-semibold px-1.5 py-0', cfg.className)}>
      {cfg.label}
    </Badge>
  )
}
