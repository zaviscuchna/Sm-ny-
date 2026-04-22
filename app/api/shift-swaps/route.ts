import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import { getSession } from '@/lib/session'
import { findShiftConflict, formatConflictMessage } from '@/lib/conflicts'
import { todayPrague } from '@/lib/tz'

/**
 * GET /api/shift-swaps
 *   ?direction=incoming — návrhy, které čekají na moje vyjádření
 *   ?direction=outgoing — návrhy, které jsem poslal já
 *   (default: both)
 *   ?status=pending|accepted|rejected|cancelled (default: pending)
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const direction = req.nextUrl.searchParams.get('direction') ?? 'all'
  const status    = req.nextUrl.searchParams.get('status') ?? 'pending'

  const client = await pool.connect()
  try {
    const baseQuery = `
      SELECT
        sw.*,
        fs.date AS from_shift_date, fs.start_time AS from_shift_start, fs.end_time AS from_shift_end,
        fs.role_needed AS from_shift_role, fs.branch_id AS from_branch_id,
        ts.date AS to_shift_date, ts.start_time AS to_shift_start, ts.end_time AS to_shift_end,
        ts.role_needed AS to_shift_role, ts.branch_id AS to_branch_id,
        fu.name AS from_user_name, fu.color AS from_user_color,
        tu.name AS to_user_name,   tu.color AS to_user_color,
        fb.name AS from_branch_name,
        tb.name AS to_branch_name
      FROM "ShiftSwap" sw
      JOIN "Shift" fs ON fs.id = sw.from_shift_id
      JOIN "Shift" ts ON ts.id = sw.to_shift_id
      JOIN "User" fu ON fu.id = sw.from_user_id
      JOIN "User" tu ON tu.id = sw.to_user_id
      LEFT JOIN "Branch" fb ON fb.id = fs.branch_id
      LEFT JOIN "Branch" tb ON tb.id = ts.branch_id
      WHERE sw.business_id = $1 AND sw.status = $2
    `
    const params: any[] = [session.bizId, status]
    let q = baseQuery
    if (session.role === 'employee') {
      // Zaměstnanec vidí jen vlastní
      if (direction === 'incoming') q += ` AND sw.to_user_id = $3`
      else if (direction === 'outgoing') q += ` AND sw.from_user_id = $3`
      else q += ` AND (sw.to_user_id = $3 OR sw.from_user_id = $3)`
      params.push(session.userId)
    } else {
      // Manager vidí všechny swapy v biznisu
      if (direction === 'incoming') q += ` AND sw.to_user_id = $3`
      else if (direction === 'outgoing') q += ` AND sw.from_user_id = $3`
      if (direction !== 'all') params.push(session.userId)
    }
    q += ' ORDER BY sw.created_at DESC'

    const res = await client.query(q, params)
    return NextResponse.json(res.rows.map(rowToSwap))
  } finally {
    client.release()
  }
}

/**
 * POST /api/shift-swaps — vytvoří návrh výměny
 * body: { fromShiftId, toShiftId, toUserId, message? }
 * fromUser = session.userId
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fromShiftId, toShiftId, toUserId, message } = await req.json()
  if (!fromShiftId || !toShiftId || !toUserId) {
    return NextResponse.json({ error: 'Chybí fromShiftId, toShiftId nebo toUserId' }, { status: 400 })
  }
  if (toUserId === session.userId) {
    return NextResponse.json({ error: 'Nelze měnit sám se sebou' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    const { rows } = await client.query(
      `SELECT id, business_id, date, start_time, end_time, assigned_employee_id, status
       FROM "Shift" WHERE id IN ($1, $2)`,
      [fromShiftId, toShiftId]
    )
    if (rows.length !== 2) return NextResponse.json({ error: 'Jedna ze směn neexistuje' }, { status: 404 })

    const fromShift = rows.find(r => r.id === fromShiftId)!
    const toShift   = rows.find(r => r.id === toShiftId)!

    if (fromShift.business_id !== session.bizId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (toShift.business_id !== fromShift.business_id) {
      return NextResponse.json({ error: 'Směny jsou z různých podniků' }, { status: 400 })
    }
    if (fromShift.assigned_employee_id !== session.userId) {
      return NextResponse.json({ error: 'Tato směna ti není přiřazena' }, { status: 403 })
    }
    if (toShift.assigned_employee_id !== toUserId) {
      return NextResponse.json({ error: 'Kolegova směna už mu není přiřazena' }, { status: 400 })
    }
    const today = todayPrague()
    if (fromShift.date < today || toShift.date < today) {
      return NextResponse.json({ error: 'Jedna ze směn už proběhla' }, { status: 400 })
    }

    // Duplicitní pending swap?
    const dup = await client.query(
      `SELECT id FROM "ShiftSwap" WHERE from_shift_id = $1 AND to_shift_id = $2 AND status = 'pending' LIMIT 1`,
      [fromShiftId, toShiftId]
    )
    if (dup.rows.length > 0) {
      return NextResponse.json({ error: 'Výměna již byla navržena' }, { status: 409 })
    }

    const id = `sw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    await client.query(
      `INSERT INTO "ShiftSwap" (id, business_id, from_user_id, from_shift_id, to_user_id, to_shift_id, status, message)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)`,
      [id, session.bizId, session.userId, fromShiftId, toUserId, toShiftId, message ?? null]
    )
    return NextResponse.json({ id, status: 'pending' })
  } finally {
    client.release()
  }
}

/**
 * PATCH /api/shift-swaps?id=xxx
 * body: { action: 'accept' | 'reject' }
 * accept: jen toUser nebo manager. reject: toUser, fromUser (cancel) nebo manager.
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Chybí id' }, { status: 400 })

  const { action } = await req.json()
  if (action !== 'accept' && action !== 'reject') {
    return NextResponse.json({ error: 'Neplatná akce' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    const { rows } = await client.query('SELECT * FROM "ShiftSwap" WHERE id = $1', [id])
    if (rows.length === 0) return NextResponse.json({ error: 'Výměna neexistuje' }, { status: 404 })
    const swap = rows[0]
    if (swap.business_id !== session.bizId && session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (swap.status !== 'pending') {
      return NextResponse.json({ error: `Výměna je už ${swap.status}` }, { status: 400 })
    }

    const isManager = session.role === 'manager' || session.role === 'superadmin'
    const isToUser  = session.userId === swap.to_user_id
    const isFromUser = session.userId === swap.from_user_id

    if (action === 'accept') {
      if (!isToUser && !isManager) {
        return NextResponse.json({ error: 'Jen adresát nebo manažer může přijmout výměnu' }, { status: 403 })
      }
      // Znovu načíst obě směny a ověřit
      const shifts = await client.query(
        `SELECT id, business_id, date, start_time, end_time, assigned_employee_id
         FROM "Shift" WHERE id IN ($1, $2)`,
        [swap.from_shift_id, swap.to_shift_id]
      )
      if (shifts.rows.length !== 2) {
        return NextResponse.json({ error: 'Směna neexistuje' }, { status: 404 })
      }
      const fromShift = shifts.rows.find(r => r.id === swap.from_shift_id)!
      const toShift   = shifts.rows.find(r => r.id === swap.to_shift_id)!

      if (fromShift.assigned_employee_id !== swap.from_user_id) {
        await client.query(`UPDATE "ShiftSwap" SET status = 'cancelled', resolved_at = NOW() WHERE id = $1`, [id])
        return NextResponse.json({ error: 'Původní směna už není přiřazena — výměna zrušena.' }, { status: 409 })
      }
      if (toShift.assigned_employee_id !== swap.to_user_id) {
        await client.query(`UPDATE "ShiftSwap" SET status = 'cancelled', resolved_at = NOW() WHERE id = $1`, [id])
        return NextResponse.json({ error: 'Cílová směna už není přiřazena — výměna zrušena.' }, { status: 409 })
      }

      // Konflikt check po výměně:
      // from_user dostane toShift → koliduje s něčím jiným, co má from_user?
      const c1 = await findShiftConflict(client, {
        employeeId: swap.from_user_id,
        businessId: swap.business_id,
        date: toShift.date,
        startTime: toShift.start_time,
        endTime: toShift.end_time,
        excludeShiftId: fromShift.id, // po swapu se vzdá fromShift
      })
      if (c1) return NextResponse.json({ error: formatConflictMessage(c1) }, { status: 409 })

      const c2 = await findShiftConflict(client, {
        employeeId: swap.to_user_id,
        businessId: swap.business_id,
        date: fromShift.date,
        startTime: fromShift.start_time,
        endTime: fromShift.end_time,
        excludeShiftId: toShift.id,
      })
      if (c2) return NextResponse.json({ error: formatConflictMessage(c2) }, { status: 409 })

      // Atomicky prohodit
      await client.query('BEGIN')
      try {
        await client.query(
          `UPDATE "Shift" SET assigned_employee_id = $1 WHERE id = $2`,
          [swap.to_user_id, swap.from_shift_id]
        )
        await client.query(
          `UPDATE "Shift" SET assigned_employee_id = $1 WHERE id = $2`,
          [swap.from_user_id, swap.to_shift_id]
        )
        await client.query(
          `UPDATE "ShiftSwap" SET status = 'accepted', resolved_at = NOW() WHERE id = $1`,
          [id]
        )
        // Zamítnout ostatní pending swapy na tyto dvě směny
        await client.query(
          `UPDATE "ShiftSwap" SET status = 'cancelled', resolved_at = NOW()
           WHERE status = 'pending' AND id != $1
             AND (from_shift_id IN ($2, $3) OR to_shift_id IN ($2, $3))`,
          [id, swap.from_shift_id, swap.to_shift_id]
        )
        await client.query('COMMIT')
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
      return NextResponse.json({ ok: true, status: 'accepted' })
    }

    // action === 'reject'
    if (!isToUser && !isFromUser && !isManager) {
      return NextResponse.json({ error: 'Nemůžeš odmítnout cizí výměnu' }, { status: 403 })
    }
    const newStatus = isFromUser ? 'cancelled' : 'rejected'
    await client.query(
      `UPDATE "ShiftSwap" SET status = $1, resolved_at = NOW() WHERE id = $2`,
      [newStatus, id]
    )
    return NextResponse.json({ ok: true, status: newStatus })
  } finally {
    client.release()
  }
}

function rowToSwap(r: any) {
  return {
    id:         r.id,
    businessId: r.business_id,
    fromUserId: r.from_user_id,
    fromShiftId: r.from_shift_id,
    toUserId:   r.to_user_id,
    toShiftId:  r.to_shift_id,
    status:     r.status,
    message:    r.message ?? undefined,
    createdAt:  r.created_at,
    resolvedAt: r.resolved_at,
    fromShift: {
      id:         r.from_shift_id,
      date:       r.from_shift_date,
      startTime:  r.from_shift_start,
      endTime:    r.from_shift_end,
      roleNeeded: r.from_shift_role,
      branchId:   r.from_branch_id,
      branchName: r.from_branch_name,
    },
    toShift: {
      id:         r.to_shift_id,
      date:       r.to_shift_date,
      startTime:  r.to_shift_start,
      endTime:    r.to_shift_end,
      roleNeeded: r.to_shift_role,
      branchId:   r.to_branch_id,
      branchName: r.to_branch_name,
    },
    fromUser: { id: r.from_user_id, name: r.from_user_name, color: r.from_user_color },
    toUser:   { id: r.to_user_id,   name: r.to_user_name,   color: r.to_user_color   },
  }
}
