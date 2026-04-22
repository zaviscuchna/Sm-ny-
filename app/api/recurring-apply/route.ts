import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import { getSession } from '@/lib/session'
import { todayPrague } from '@/lib/tz'
import { findShiftConflict } from '@/lib/conflicts'

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { recurringGroupId, employeeId, employeeName, bizId } = await req.json()
  if (!recurringGroupId || !employeeId || !bizId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (bizId !== session.bizId && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (session.role === 'employee' && employeeId !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const client = await pool.connect()
  try {
    const { rows: shifts } = await client.query(
      `SELECT id, date, start_time, end_time FROM "Shift" WHERE recurring_group_id = $1 AND business_id = $2 AND status = 'open'`,
      [recurringGroupId, bizId]
    )

    if (shifts.length === 0) {
      return NextResponse.json({ count: 0 })
    }

    const now = todayPrague()
    const created: string[] = []
    const skipped: Array<{ date: string; reason: string }> = []

    for (const shift of shifts) {
      const { rows: existing } = await client.query(
        `SELECT id FROM "ShiftApplication" WHERE shift_id = $1 AND employee_id = $2`,
        [shift.id, employeeId]
      )
      if (existing.length > 0) continue

      // Conflict check — skip shifts where employee already works
      const conflict = await findShiftConflict(client, {
        employeeId,
        businessId: bizId,
        date: shift.date,
        startTime: shift.start_time,
        endTime: shift.end_time,
        excludeShiftId: shift.id,
      })
      if (conflict) {
        skipped.push({ date: shift.date, reason: `kolize s jinou směnou ${conflict.startTime}–${conflict.endTime}` })
        continue
      }

      await client.query(
        'UPDATE "Shift" SET assigned_employee_id = $1, status = $2 WHERE id = $3',
        [employeeId, 'assigned', shift.id]
      )

      const appId = `app-${Date.now()}-${Math.random().toString(36).slice(2)}`
      await client.query(
        `INSERT INTO "ShiftApplication" (id, shift_id, employee_id, employee_name, business_id, status, created_at)
         VALUES ($1,$2,$3,$4,$5,'approved',$6)`,
        [appId, shift.id, employeeId, employeeName, bizId, now]
      )
      created.push(shift.id)
    }

    return NextResponse.json({ count: created.length, shiftIds: created, skipped })
  } finally {
    client.release()
  }
}
