import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'

export async function GET(req: NextRequest) {
  const bizId = req.nextUrl.searchParams.get('bizId')
  if (!bizId) return NextResponse.json([], { status: 400 })

  const employeeId = req.nextUrl.searchParams.get('employeeId')

  const client = await pool.connect()
  try {
    const [shiftsRes, empsRes] = await Promise.all([
      employeeId
        ? client.query('SELECT * FROM "Shift" WHERE business_id = $1 AND assigned_employee_id = $2 ORDER BY date', [bizId, employeeId])
        : client.query('SELECT * FROM "Shift" WHERE business_id = $1 ORDER BY date', [bizId]),
      client.query('SELECT * FROM "User" WHERE business_id = $1', [bizId]),
    ])

    const empMap: Record<string, any> = {}
    for (const e of empsRes.rows) empMap[e.id] = e

    const shifts = shiftsRes.rows.map(row => ({
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
  } finally {
    client.release()
  }
}

export async function PATCH(req: NextRequest) {
  const { id, assignedEmployeeId, status, roleNeeded, startTime, endTime, date, notes } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const client = await pool.connect()
  try {
    const sets: string[] = []
    const vals: any[] = []
    let idx = 1
    if (assignedEmployeeId !== undefined) { sets.push(`assigned_employee_id = $${idx++}`); vals.push(assignedEmployeeId === null ? null : assignedEmployeeId) }
    if (status      !== undefined) { sets.push(`status = $${idx++}`);     vals.push(status) }
    if (roleNeeded  !== undefined) { sets.push(`role_needed = $${idx++}`); vals.push(roleNeeded) }
    if (startTime   !== undefined) { sets.push(`start_time = $${idx++}`);  vals.push(startTime) }
    if (endTime     !== undefined) { sets.push(`end_time = $${idx++}`);    vals.push(endTime) }
    if (date        !== undefined) { sets.push(`date = $${idx++}`);        vals.push(date) }
    if (notes       !== undefined) { sets.push(`notes = $${idx++}`);       vals.push(notes) }
    if (sets.length > 0) {
      vals.push(id)
      await client.query(`UPDATE "Shift" SET ${sets.join(', ')} WHERE id = $${idx}`, vals)
    }
    return NextResponse.json({ ok: true })
  } finally {
    client.release()
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const client = await pool.connect()
  try {
    await client.query('DELETE FROM "ShiftApplication" WHERE shift_id = $1', [id])
    await client.query('DELETE FROM "Shift" WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } finally {
    client.release()
  }
}

export async function POST(req: NextRequest) {
  const { shifts } = await req.json()
  const client = await pool.connect()
  try {
    for (const s of shifts) {
      await client.query(
        `INSERT INTO "Shift" (id, business_id, date, start_time, end_time, role_needed, assigned_employee_id, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [s.id, s.businessId, s.date, s.startTime, s.endTime, s.roleNeeded, s.assignedEmployeeId ?? null, s.status, s.notes ?? null]
      )
    }
    return NextResponse.json({ ok: true })
  } finally {
    client.release()
  }
}
