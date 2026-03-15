import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const bizId = req.nextUrl.searchParams.get('bizId')
  if (!bizId) return NextResponse.json([], { status: 400 })

  const [shiftRows, empRows] = await Promise.all([
    prisma.shift.findMany({ where: { business_id: bizId }, orderBy: { date: 'asc' } }),
    prisma.user.findMany({ where: { business_id: bizId } }),
  ])

  const empMap: Record<string, typeof empRows[0]> = {}
  for (const e of empRows) empMap[e.id] = e

  const shifts = shiftRows.map(row => ({
    id:               row.id,
    businessId:       row.business_id,
    date:             row.date,
    startTime:        row.start_time,
    endTime:          row.end_time,
    roleNeeded:       row.role_needed,
    status:           row.status,
    notes:            row.notes ?? undefined,
    assignedEmployee: row.assigned_employee_id
      ? (() => {
          const e = empMap[row.assigned_employee_id]
          return e ? { id: e.id, name: e.name, email: e.email, role: e.role, color: e.color } : undefined
        })()
      : undefined,
  }))

  return NextResponse.json(shifts)
}

export async function POST(req: NextRequest) {
  const { shifts } = await req.json()

  await prisma.shift.createMany({
    data: shifts.map((s: any) => ({
      id:                   s.id,
      business_id:          s.businessId,
      date:                 s.date,
      start_time:           s.startTime,
      end_time:             s.endTime,
      role_needed:          s.roleNeeded,
      assigned_employee_id: s.assignedEmployeeId ?? null,
      status:               s.status,
      notes:                s.notes ?? null,
    })),
  })

  return NextResponse.json({ ok: true })
}
