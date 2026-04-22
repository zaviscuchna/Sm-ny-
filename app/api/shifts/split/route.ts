import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'manager' && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { shiftId, splitTime } = await req.json()
  if (!shiftId || !splitTime) {
    return NextResponse.json({ error: 'Chybí shiftId nebo splitTime' }, { status: 400 })
  }
  if (!/^\d{2}:\d{2}$/.test(splitTime)) {
    return NextResponse.json({ error: 'Neplatný formát času (HH:MM)' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    const { rows } = await client.query('SELECT * FROM "Shift" WHERE id = $1', [shiftId])
    if (rows.length === 0) return NextResponse.json({ error: 'Směna neexistuje' }, { status: 404 })
    const shift = rows[0]
    if (shift.business_id !== session.bizId && session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (splitTime <= shift.start_time || splitTime >= shift.end_time) {
      return NextResponse.json({ error: `Čas rozdělení musí být mezi ${shift.start_time} a ${shift.end_time}` }, { status: 400 })
    }

    await client.query('BEGIN')
    try {
      // 1) Zkrátit původní směnu a vyjmout ji ze série
      await client.query(
        `UPDATE "Shift" SET end_time = $1, recurring_group_id = NULL WHERE id = $2`,
        [splitTime, shiftId]
      )

      // 2) Vytvořit novou "druhou půlku" jako volnou (open)
      const newId = `sh-split-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      await client.query(
        `INSERT INTO "Shift"
         (id, business_id, branch_id, date, start_time, end_time, role_needed, assigned_employee_id, status, notes, recurring_group_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,'open',$8,NULL)`,
        [newId, shift.business_id, shift.branch_id, shift.date, splitTime, shift.end_time, shift.role_needed, shift.notes]
      )
      await client.query('COMMIT')

      return NextResponse.json({
        ok: true,
        original: {
          id: shiftId,
          endTime: splitTime,
          recurringGroupId: null,
        },
        newShift: {
          id: newId,
          businessId: shift.business_id,
          branchId: shift.branch_id ?? undefined,
          date: shift.date,
          startTime: splitTime,
          endTime: shift.end_time,
          roleNeeded: shift.role_needed,
          status: 'open' as const,
          notes: shift.notes ?? undefined,
        },
      })
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    }
  } finally {
    client.release()
  }
}
