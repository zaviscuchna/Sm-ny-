import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'

export async function GET(req: NextRequest) {
  const bizId = req.nextUrl.searchParams.get('bizId')
  if (!bizId) return NextResponse.json([], { status: 400 })

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  const branchId = req.nextUrl.searchParams.get('branchId')
  const status = req.nextUrl.searchParams.get('status') // filter by status (e.g. 'completed')

  const client = await pool.connect()
  try {
    let shiftQuery = 'SELECT s.*, b.name as branch_name, b.address as branch_address FROM "Shift" s LEFT JOIN "Branch" b ON b.id = s.branch_id WHERE s.business_id = $1'
    const params: any[] = [bizId]
    let idx = 2
    if (employeeId) { shiftQuery += ` AND s.assigned_employee_id = $${idx++}`; params.push(employeeId) }
    if (branchId) { shiftQuery += ` AND s.branch_id = $${idx++}`; params.push(branchId) }
    if (status) { shiftQuery += ` AND s.status = $${idx++}`; params.push(status) }
    shiftQuery += ' ORDER BY s.date'

    const [shiftsRes, empsRes] = await Promise.all([
      client.query(shiftQuery, params),
      client.query('SELECT * FROM "User" WHERE business_id = $1', [bizId]),
    ])

    const empMap: Record<string, any> = {}
    for (const e of empsRes.rows) empMap[e.id] = e

    const shifts = shiftsRes.rows.map(row => ({
      id:               row.id,
      businessId:       row.business_id,
      branchId:         row.branch_id ?? undefined,
      date:             row.date,
      startTime:        row.start_time,
      endTime:          row.end_time,
      roleNeeded:       row.role_needed,
      status:           row.status,
      notes:            row.notes ?? undefined,
      recurringGroupId: row.recurring_group_id ?? undefined,
      actualStart:      row.actual_start ?? undefined,
      actualEnd:        row.actual_end ?? undefined,
      assignedEmployee: row.assigned_employee_id
        ? (() => {
            const e = empMap[row.assigned_employee_id]
            return e ? { id: e.id, name: e.name, email: e.email, role: e.role, color: e.color } : undefined
          })()
        : undefined,
      branch: row.branch_name ? { id: row.branch_id, name: row.branch_name, address: row.branch_address } : undefined,
    }))

    return NextResponse.json(shifts)
  } finally {
    client.release()
  }
}

export async function PATCH(req: NextRequest) {
  const { id, groupId, assignedEmployeeId, status, roleNeeded, startTime, endTime, date, notes, branchId, actualStart, actualEnd } = await req.json()
  if (!id && !groupId) return NextResponse.json({ error: 'Missing id or groupId' }, { status: 400 })
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
    // date only applies to single shift edits, not group edits
    if (date !== undefined && !groupId) { sets.push(`date = $${idx++}`); vals.push(date) }
    if (notes       !== undefined) { sets.push(`notes = $${idx++}`);       vals.push(notes) }
    if (branchId    !== undefined) { sets.push(`branch_id = $${idx++}`);   vals.push(branchId === null ? null : branchId) }
    if (actualStart !== undefined) { sets.push(`actual_start = $${idx++}`); vals.push(actualStart === null ? null : actualStart) }
    if (actualEnd   !== undefined) { sets.push(`actual_end = $${idx++}`);   vals.push(actualEnd === null ? null : actualEnd) }
    if (sets.length > 0) {
      vals.push(groupId ?? id)
      const where = groupId ? `recurring_group_id = $${idx}` : `id = $${idx}`
      await client.query(`UPDATE "Shift" SET ${sets.join(', ')} WHERE ${where}`, vals)
    }
    return NextResponse.json({ ok: true })
  } finally {
    client.release()
  }
}

export async function DELETE(req: NextRequest) {
  const id          = req.nextUrl.searchParams.get('id')
  const groupId     = req.nextUrl.searchParams.get('groupId')
  const bizId       = req.nextUrl.searchParams.get('bizId')
  const roleNeeded  = req.nextUrl.searchParams.get('roleNeeded')
  const startTime   = req.nextUrl.searchParams.get('startTime')
  const endTime     = req.nextUrl.searchParams.get('endTime')

  if (!id && !groupId && !(bizId && roleNeeded && startTime && endTime))
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const client = await pool.connect()
  try {
    if (bizId && roleNeeded && startTime && endTime) {
      const { rows } = await client.query(
        'SELECT id FROM "Shift" WHERE business_id = $1 AND role_needed = $2 AND start_time = $3 AND end_time = $4',
        [bizId, roleNeeded, startTime, endTime]
      )
      for (const row of rows) {
        await client.query('DELETE FROM "ShiftApplication" WHERE shift_id = $1', [row.id])
      }
      await client.query(
        'DELETE FROM "Shift" WHERE business_id = $1 AND role_needed = $2 AND start_time = $3 AND end_time = $4',
        [bizId, roleNeeded, startTime, endTime]
      )
    } else if (groupId) {
      const { rows } = await client.query('SELECT id FROM "Shift" WHERE recurring_group_id = $1', [groupId])
      for (const row of rows) {
        await client.query('DELETE FROM "ShiftApplication" WHERE shift_id = $1', [row.id])
      }
      await client.query('DELETE FROM "Shift" WHERE recurring_group_id = $1', [groupId])
    } else {
      await client.query('DELETE FROM "ShiftApplication" WHERE shift_id = $1', [id])
      await client.query('DELETE FROM "Shift" WHERE id = $1', [id])
    }
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
        `INSERT INTO "Shift" (id, business_id, branch_id, date, start_time, end_time, role_needed, assigned_employee_id, status, notes, recurring_group_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [s.id, s.businessId, s.branchId ?? null, s.date, s.startTime, s.endTime, s.roleNeeded, s.assignedEmployeeId ?? null, s.status, s.notes ?? null, s.recurringGroupId ?? null]
      )
    }
    return NextResponse.json({ ok: true })
  } finally {
    client.release()
  }
}
