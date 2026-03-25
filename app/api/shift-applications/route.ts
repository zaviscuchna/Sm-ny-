import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'

export async function GET(req: NextRequest) {
  const bizId = req.nextUrl.searchParams.get('bizId')
  if (!bizId) return NextResponse.json([], { status: 400 })

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
  const { shiftId, employeeId, employeeName, bizId } = await req.json()

  const client = await pool.connect()
  try {
    // Check if shift is still open
    const shiftCheck = await client.query(
      'SELECT status FROM "Shift" WHERE id = $1',
      [shiftId]
    )
    if (shiftCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Směna neexistuje' }, { status: 404 })
    }
    if (shiftCheck.rows[0].status !== 'open') {
      return NextResponse.json({ error: 'Směna už je obsazená' }, { status: 400 })
    }

    // Auto-assign: directly assign the shift to the employee
    await client.query(
      'UPDATE "Shift" SET assigned_employee_id = $1, status = $2 WHERE id = $3',
      [employeeId, 'assigned', shiftId]
    )

    // Log the application as approved
    const id = `app-${Date.now()}`
    const createdAt = new Date().toISOString().split('T')[0]
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
  const { id, status, shiftId, employeeId } = await req.json()

  const client = await pool.connect()
  try {
    await client.query('UPDATE "ShiftApplication" SET status = $1 WHERE id = $2', [status, id])

    if (status === 'approved' && shiftId && employeeId) {
      await client.query(
        'UPDATE "Shift" SET assigned_employee_id = $1, status = $2 WHERE id = $3',
        [employeeId, 'assigned', shiftId]
      )
      await client.query(
        'UPDATE "ShiftApplication" SET status = $1 WHERE shift_id = $2 AND id != $3',
        ['rejected', shiftId, id]
      )
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
