import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import { getSession } from '@/lib/session'
import { todayPrague } from '@/lib/tz'
import { findShiftConflict, formatConflictMessage } from '@/lib/conflicts'

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bizId = req.nextUrl.searchParams.get('bizId') || session.bizId
  if (bizId !== session.bizId && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const client = await pool.connect()
  try {
    const res = await client.query(
      `SELECT a.*, s.date AS shift_date, s.start_time, s.end_time, s.role_needed
       FROM "ShiftApplication" a
       LEFT JOIN "Shift" s ON s.id = a.shift_id
       WHERE a.business_id = $1
       ORDER BY a.created_at DESC`,
      [bizId]
    )
    return NextResponse.json(res.rows.map(rowToApp))
  } finally {
    client.release()
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shiftId, employeeId, employeeName, bizId } = await req.json()
  if (bizId !== session.bizId && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (session.role === 'employee' && employeeId !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const client = await pool.connect()
  try {
    const shiftCheck = await client.query(
      'SELECT status, business_id, date, start_time, end_time FROM "Shift" WHERE id = $1',
      [shiftId]
    )
    if (shiftCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Směna neexistuje' }, { status: 404 })
    }
    const sh = shiftCheck.rows[0]
    if (sh.business_id !== session.bizId && session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (sh.status !== 'open') {
      return NextResponse.json({ error: 'Směna už je obsazená' }, { status: 400 })
    }

    // Conflict check — employee can't take a shift overlapping with another
    const conflict = await findShiftConflict(client, {
      employeeId,
      businessId: sh.business_id,
      date: sh.date,
      startTime: sh.start_time,
      endTime: sh.end_time,
      excludeShiftId: shiftId,
    })
    if (conflict) {
      return NextResponse.json({
        error: formatConflictMessage(conflict),
        conflict,
      }, { status: 409 })
    }

    await client.query(
      'UPDATE "Shift" SET assigned_employee_id = $1, status = $2 WHERE id = $3',
      [employeeId, 'assigned', shiftId]
    )

    const id = `app-${Date.now()}`
    const createdAt = todayPrague()
    await client.query(
      `INSERT INTO "ShiftApplication" (id, shift_id, employee_id, employee_name, business_id, status, created_at)
       VALUES ($1,$2,$3,$4,$5,'approved',$6)`,
      [id, shiftId, employeeId, employeeName, bizId, createdAt]
    )
    return NextResponse.json({ id, shiftId, employeeId, employeeName, bizId, status: 'approved', createdAt })
  } finally {
    client.release()
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'manager' && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, status, shiftId, employeeId } = await req.json()

  const client = await pool.connect()
  try {
    // Ownership
    const { rows } = await client.query('SELECT business_id FROM "ShiftApplication" WHERE id = $1', [id])
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (rows[0].business_id !== session.bizId && session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (status === 'approved' && shiftId && employeeId) {
      // Conflict check before approving
      const shRes = await client.query(
        'SELECT date, start_time, end_time, business_id FROM "Shift" WHERE id = $1',
        [shiftId]
      )
      if (shRes.rows.length > 0) {
        const sh = shRes.rows[0]
        const conflict = await findShiftConflict(client, {
          employeeId,
          businessId: sh.business_id,
          date: sh.date,
          startTime: sh.start_time,
          endTime: sh.end_time,
          excludeShiftId: shiftId,
        })
        if (conflict) {
          return NextResponse.json({
            error: formatConflictMessage(conflict),
            conflict,
          }, { status: 409 })
        }
      }

      await client.query('UPDATE "ShiftApplication" SET status = $1 WHERE id = $2', [status, id])
      await client.query(
        'UPDATE "Shift" SET assigned_employee_id = $1, status = $2 WHERE id = $3',
        [employeeId, 'assigned', shiftId]
      )
      await client.query(
        'UPDATE "ShiftApplication" SET status = $1 WHERE shift_id = $2 AND id != $3',
        ['rejected', shiftId, id]
      )
    } else {
      await client.query('UPDATE "ShiftApplication" SET status = $1 WHERE id = $2', [status, id])
    }

    return NextResponse.json({ ok: true })
  } finally {
    client.release()
  }
}

function rowToApp(row: any) {
  return {
    id:           row.id,
    shiftId:      row.shift_id,
    employeeId:   row.employee_id,
    employeeName: row.employee_name,
    bizId:        row.business_id,
    status:       row.status,
    createdAt:    row.created_at,
    shiftDate:    row.shift_date ?? '',
    startTime:    row.start_time ?? '',
    endTime:      row.end_time ?? '',
    roleNeeded:   row.role_needed ?? '',
  }
}
