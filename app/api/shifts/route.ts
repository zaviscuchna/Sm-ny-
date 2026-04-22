import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import { getSession } from '@/lib/session'
import { findShiftConflict, formatConflictMessage } from '@/lib/conflicts'

async function requireManager(req: NextRequest): Promise<NextResponse | null> {
  const s = await getSession(req)
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (s.role !== 'manager' && s.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bizId = req.nextUrl.searchParams.get('bizId') || session.bizId
  if (bizId !== session.bizId && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  const branchId = req.nextUrl.searchParams.get('branchId')
  const status = req.nextUrl.searchParams.get('status')

  const client = await pool.connect()
  try {
    let shiftQuery = 'SELECT s.*, b.name as branch_name, b.address as branch_address FROM "Shift" s LEFT JOIN "Branch" b ON b.id = s.branch_id WHERE s.business_id = $1'
    const params: any[] = [bizId]
    let idx = 2
    if (employeeId) { shiftQuery += ` AND s.assigned_employee_id = $${idx++}`; params.push(employeeId) }
    // Filter by branch — ale včetně NULL branches (směny vytvořené bez přiřazení k pobočce),
    // aby se "osiřelé" směny zobrazily v každém branch filtru, ne aby zmizely.
    if (branchId) { shiftQuery += ` AND (s.branch_id = $${idx} OR s.branch_id IS NULL)`; params.push(branchId); idx++ }
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
  const mgr = await requireManager(req)
  if (mgr) return mgr
  const session = (await getSession(req))!

  const { id, groupId, assignedEmployeeId, status, roleNeeded, startTime, endTime, date, notes, branchId, actualStart, actualEnd } = await req.json()
  if (!id && !groupId) return NextResponse.json({ error: 'Missing id or groupId' }, { status: 400 })

  const client = await pool.connect()
  try {
    // Ownership check + load current shift data for conflict check
    let currentShift: { business_id: string; date: string; start_time: string; end_time: string } | null = null
    if (id) {
      const { rows } = await client.query('SELECT business_id, date, start_time, end_time FROM "Shift" WHERE id = $1', [id])
      if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (rows[0].business_id !== session.bizId && session.role !== 'superadmin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      currentShift = rows[0]
    }
    if (groupId) {
      const { rows } = await client.query('SELECT business_id FROM "Shift" WHERE recurring_group_id = $1 LIMIT 1', [groupId])
      if (rows.length > 0 && rows[0].business_id !== session.bizId && session.role !== 'superadmin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Conflict detection — if we're assigning an employee, make sure they don't already have
    // an overlapping shift (including in other branches). Applies only to single-shift PATCH
    // (not groupId bulk edits).
    if (id && currentShift && assignedEmployeeId) {
      const newDate  = (date ?? currentShift.date) as string
      const newStart = (startTime ?? currentShift.start_time) as string
      const newEnd   = (endTime ?? currentShift.end_time) as string
      const conflict = await findShiftConflict(client, {
        employeeId: assignedEmployeeId,
        businessId: currentShift.business_id,
        date: newDate,
        startTime: newStart,
        endTime: newEnd,
        excludeShiftId: id,
      })
      if (conflict) {
        const empRes = await client.query('SELECT name FROM "User" WHERE id = $1', [assignedEmployeeId])
        const empName = empRes.rows[0]?.name
        return NextResponse.json({
          error: formatConflictMessage(conflict, empName),
          conflict,
        }, { status: 409 })
      }
    }

    const sets: string[] = []
    const vals: any[] = []
    let idx = 1
    if (assignedEmployeeId !== undefined) { sets.push(`assigned_employee_id = $${idx++}`); vals.push(assignedEmployeeId === null ? null : assignedEmployeeId) }
    if (status      !== undefined) { sets.push(`status = $${idx++}`);     vals.push(status) }
    if (roleNeeded  !== undefined) { sets.push(`role_needed = $${idx++}`); vals.push(roleNeeded) }
    if (startTime   !== undefined) { sets.push(`start_time = $${idx++}`);  vals.push(startTime) }
    if (endTime     !== undefined) { sets.push(`end_time = $${idx++}`);    vals.push(endTime) }
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
  const mgr = await requireManager(req)
  if (mgr) return mgr
  const session = (await getSession(req))!

  const id          = req.nextUrl.searchParams.get('id')
  const groupId     = req.nextUrl.searchParams.get('groupId')
  const bizId       = req.nextUrl.searchParams.get('bizId')
  const roleNeeded  = req.nextUrl.searchParams.get('roleNeeded')
  const startTime   = req.nextUrl.searchParams.get('startTime')
  const endTime     = req.nextUrl.searchParams.get('endTime')

  if (!id && !groupId && !(bizId && roleNeeded && startTime && endTime))
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  if (bizId && bizId !== session.bizId && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const client = await pool.connect()
  try {
    // Ownership checks for id/groupId
    if (id) {
      const { rows } = await client.query('SELECT business_id FROM "Shift" WHERE id = $1', [id])
      if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (rows[0].business_id !== session.bizId && session.role !== 'superadmin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    if (groupId && !id) {
      const { rows } = await client.query('SELECT business_id FROM "Shift" WHERE recurring_group_id = $1 LIMIT 1', [groupId])
      if (rows.length > 0 && rows[0].business_id !== session.bizId && session.role !== 'superadmin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

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
  const mgr = await requireManager(req)
  if (mgr) return mgr
  const session = (await getSession(req))!

  const { shifts } = await req.json()
  if (!Array.isArray(shifts)) return NextResponse.json({ error: 'Missing shifts' }, { status: 400 })

  const client = await pool.connect()
  try {
    const conflicts: Array<{ date: string; startTime: string; endTime: string; empName?: string; with: string }> = []
    for (const s of shifts) {
      const bizId = s.businessId
      if (bizId !== session.bizId && session.role !== 'superadmin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (s.assignedEmployeeId) {
        const conflict = await findShiftConflict(client, {
          employeeId: s.assignedEmployeeId,
          businessId: bizId,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          excludeShiftId: null,
        })
        if (conflict) {
          const empRes = await client.query('SELECT name FROM "User" WHERE id = $1', [s.assignedEmployeeId])
          const empName = empRes.rows[0]?.name
          conflicts.push({
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            empName,
            with: formatConflictMessage(conflict, empName),
          })
          continue
        }
      }
      await client.query(
        `INSERT INTO "Shift" (id, business_id, branch_id, date, start_time, end_time, role_needed, assigned_employee_id, status, notes, recurring_group_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [s.id, bizId, s.branchId ?? null, s.date, s.startTime, s.endTime, s.roleNeeded, s.assignedEmployeeId ?? null, s.status, s.notes ?? null, s.recurringGroupId ?? null]
      )
    }
    if (conflicts.length > 0) {
      return NextResponse.json({
        ok: true,
        conflicts,
        warning: `${conflicts.length} směn nebylo vytvořeno kvůli kolizím — zaměstnanec má v tom čase jinou směnu.`,
      }, { status: 207 })
    }
    return NextResponse.json({ ok: true })
  } finally {
    client.release()
  }
}
