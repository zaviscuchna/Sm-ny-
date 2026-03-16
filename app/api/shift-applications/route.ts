import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'

export async function GET(req: NextRequest) {
  const bizId = req.nextUrl.searchParams.get('bizId')
  if (!bizId) return NextResponse.json([], { status: 400 })

  const client = await pool.connect()
  try {
    const res = await client.query(
      'SELECT * FROM "ShiftApplication" WHERE business_id = $1 ORDER BY created_at DESC',
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
    const existing = await client.query(
      'SELECT id FROM "ShiftApplication" WHERE shift_id = $1 AND employee_id = $2',
      [shiftId, employeeId]
    )
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Již přihlášen' }, { status: 400 })
    }

    const id = `app-${Date.now()}`
    const createdAt = new Date().toISOString().split('T')[0]
    await client.query(
      `INSERT INTO "ShiftApplication" (id, shift_id, employee_id, employee_name, business_id, status, created_at)
       VALUES ($1,$2,$3,$4,$5,'pending',$6)`,
      [id, shiftId, employeeId, employeeName, bizId, createdAt]
    )
    return NextResponse.json({ id, shiftId, employeeId, employeeName, bizId, status: 'pending', createdAt })
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
    id: row.id,
    shiftId: row.shift_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    bizId: row.business_id,
    status: row.status,
    createdAt: row.created_at,
  }
}
