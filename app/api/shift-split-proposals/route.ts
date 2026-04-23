import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import { getSession } from '@/lib/session'
import { findShiftConflict, formatConflictMessage } from '@/lib/conflicts'
import { todayPrague } from '@/lib/tz'
import type { PoolClient } from 'pg'

/**
 * Návrhy rozdělení směny mezi zaměstnanci.
 *
 * Zaměstnanec A (proposer) navrhne, že si vezme půlku směny zaměstnance B.
 * B potvrdí → server atomicky rozdělí směnu a přiřadí A jeho půlku.
 * B odmítne → proposal je ve stavu rejected.
 *
 * Manager vidí všechny návrhy v rámci biznisu (GET), ale nemusí je potvrzovat.
 *
 * Tabulka se vytvoří idempotentně při prvním volání (CREATE TABLE IF NOT EXISTS),
 * takže není potřeba manuální migrace.
 */

async function ensureTable(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "ShiftSplitProposal" (
      "id"             TEXT NOT NULL PRIMARY KEY,
      "business_id"    TEXT NOT NULL,
      "shift_id"       TEXT NOT NULL,
      "from_user_id"   TEXT NOT NULL,
      "to_user_id"     TEXT NOT NULL,
      "split_time"     TEXT NOT NULL,
      "proposer_half"  TEXT NOT NULL DEFAULT 'second',
      "message"        TEXT,
      "status"         TEXT NOT NULL DEFAULT 'pending',
      "created_at"     TIMESTAMPTZ DEFAULT NOW(),
      "resolved_at"    TIMESTAMPTZ
    )
  `)
  await client.query(`CREATE INDEX IF NOT EXISTS "ShiftSplitProposal_to_user_idx" ON "ShiftSplitProposal"("to_user_id", "status")`)
  await client.query(`CREATE INDEX IF NOT EXISTS "ShiftSplitProposal_from_user_idx" ON "ShiftSplitProposal"("from_user_id", "status")`)
  await client.query(`CREATE INDEX IF NOT EXISTS "ShiftSplitProposal_biz_idx" ON "ShiftSplitProposal"("business_id")`)
}

function rowToProposal(r: any) {
  return {
    id:            r.id,
    businessId:    r.business_id,
    shiftId:       r.shift_id,
    fromUserId:    r.from_user_id,
    toUserId:      r.to_user_id,
    splitTime:     r.split_time,
    proposerHalf:  r.proposer_half as 'first' | 'second',
    message:       r.message ?? undefined,
    status:        r.status,
    createdAt:     r.created_at,
    resolvedAt:    r.resolved_at,
    shift: r.shift_date ? {
      id:         r.shift_id,
      date:       r.shift_date,
      startTime:  r.shift_start,
      endTime:    r.shift_end,
      roleNeeded: r.shift_role,
      branchId:   r.shift_branch_id,
      branchName: r.shift_branch_name,
    } : undefined,
    fromUser: { id: r.from_user_id, name: r.from_user_name, color: r.from_user_color },
    toUser:   { id: r.to_user_id,   name: r.to_user_name,   color: r.to_user_color },
  }
}

const SELECT_WITH_JOINS = `
  SELECT
    p.*,
    s.date AS shift_date, s.start_time AS shift_start, s.end_time AS shift_end,
    s.role_needed AS shift_role, s.branch_id AS shift_branch_id,
    b.name AS shift_branch_name,
    fu.name AS from_user_name, fu.color AS from_user_color,
    tu.name AS to_user_name,   tu.color AS to_user_color
  FROM "ShiftSplitProposal" p
  LEFT JOIN "Shift" s  ON s.id = p.shift_id
  LEFT JOIN "Branch" b ON b.id = s.branch_id
  LEFT JOIN "User" fu ON fu.id = p.from_user_id
  LEFT JOIN "User" tu ON tu.id = p.to_user_id
`

/**
 * GET /api/shift-split-proposals
 *   ?direction=incoming — návrhy pro mě k odsouhlasení (to_user_id = me)
 *   ?direction=outgoing — návrhy, které jsem odeslal (from_user_id = me)
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
    await ensureTable(client)

    let q = `${SELECT_WITH_JOINS} WHERE p.business_id = $1 AND p.status = $2`
    const params: any[] = [session.bizId, status]

    if (session.role === 'employee') {
      if (direction === 'incoming') q += ` AND p.to_user_id = $3`
      else if (direction === 'outgoing') q += ` AND p.from_user_id = $3`
      else q += ` AND (p.to_user_id = $3 OR p.from_user_id = $3)`
      params.push(session.userId)
    } else {
      // Manager vidí všechny návrhy v biznisu (pasivně)
      if (direction === 'incoming') { q += ` AND p.to_user_id = $3`; params.push(session.userId) }
      else if (direction === 'outgoing') { q += ` AND p.from_user_id = $3`; params.push(session.userId) }
    }

    q += ' ORDER BY p.created_at DESC'
    const res = await client.query(q, params)
    return NextResponse.json(res.rows.map(rowToProposal))
  } finally {
    client.release()
  }
}

/**
 * POST /api/shift-split-proposals
 * body: { shiftId, splitTime (HH:MM), proposerHalf: 'first'|'second', message? }
 * Navrhovatel = session.userId, cíl = assigned_employee_id té směny
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { shiftId, splitTime, message } = body
  const proposerHalf: 'first' | 'second' = body.proposerHalf === 'first' ? 'first' : 'second'

  if (!shiftId || !splitTime) {
    return NextResponse.json({ error: 'Chybí shiftId nebo splitTime' }, { status: 400 })
  }
  if (!/^\d{2}:\d{2}$/.test(splitTime)) {
    return NextResponse.json({ error: 'Neplatný formát času (HH:MM)' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    await ensureTable(client)

    const { rows } = await client.query(
      `SELECT id, business_id, date, start_time, end_time, assigned_employee_id
       FROM "Shift" WHERE id = $1`, [shiftId]
    )
    if (rows.length === 0) return NextResponse.json({ error: 'Směna neexistuje' }, { status: 404 })
    const shift = rows[0]

    if (shift.business_id !== session.bizId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!shift.assigned_employee_id) {
      return NextResponse.json({ error: 'Směna je volná — přihlas se normálně, nemusíš ji dělit' }, { status: 400 })
    }
    if (shift.assigned_employee_id === session.userId) {
      return NextResponse.json({ error: 'Nelze navrhnout rozdělení vlastní směny' }, { status: 400 })
    }

    const today = todayPrague()
    if (shift.date < today) {
      return NextResponse.json({ error: 'Směna už proběhla' }, { status: 400 })
    }

    if (splitTime <= shift.start_time || splitTime >= shift.end_time) {
      return NextResponse.json({ error: `Čas rozdělení musí být mezi ${shift.start_time} a ${shift.end_time}` }, { status: 400 })
    }

    // Konflikt check — proposer nesmí mít jinou směnu v čase své půlky
    const myStart = proposerHalf === 'first' ? shift.start_time : splitTime
    const myEnd   = proposerHalf === 'first' ? splitTime         : shift.end_time
    const conflict = await findShiftConflict(client, {
      employeeId: session.userId,
      businessId: shift.business_id,
      date: shift.date,
      startTime: myStart,
      endTime: myEnd,
      excludeShiftId: null,
    })
    if (conflict) {
      return NextResponse.json({ error: formatConflictMessage(conflict) }, { status: 409 })
    }

    // Duplicitní pending proposal na stejnou směnu od stejného člověka?
    const dup = await client.query(
      `SELECT id FROM "ShiftSplitProposal"
       WHERE shift_id = $1 AND from_user_id = $2 AND status = 'pending' LIMIT 1`,
      [shiftId, session.userId]
    )
    if (dup.rows.length > 0) {
      return NextResponse.json({ error: 'Už jsi navrhl rozdělení této směny — počkej na odpověď' }, { status: 409 })
    }

    const id = `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    await client.query(
      `INSERT INTO "ShiftSplitProposal"
       (id, business_id, shift_id, from_user_id, to_user_id, split_time, proposer_half, message, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')`,
      [id, session.bizId, shiftId, session.userId, shift.assigned_employee_id, splitTime, proposerHalf, message ?? null]
    )

    return NextResponse.json({ id, status: 'pending' })
  } finally {
    client.release()
  }
}

/**
 * PATCH /api/shift-split-proposals?id=xxx
 * body: { action: 'accept' | 'reject' }
 * accept: jen to_user nebo manager. reject: to_user, from_user (cancel) nebo manager.
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
    await ensureTable(client)

    const { rows } = await client.query('SELECT * FROM "ShiftSplitProposal" WHERE id = $1', [id])
    if (rows.length === 0) return NextResponse.json({ error: 'Návrh neexistuje' }, { status: 404 })
    const proposal = rows[0]

    if (proposal.business_id !== session.bizId && session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (proposal.status !== 'pending') {
      return NextResponse.json({ error: `Návrh je už ${proposal.status}` }, { status: 400 })
    }

    const isManager = session.role === 'manager' || session.role === 'superadmin'
    const isToUser = session.userId === proposal.to_user_id
    const isFromUser = session.userId === proposal.from_user_id

    if (action === 'reject') {
      if (!isToUser && !isFromUser && !isManager) {
        return NextResponse.json({ error: 'Nemůžeš odmítnout cizí návrh' }, { status: 403 })
      }
      const newStatus = isFromUser && !isToUser ? 'cancelled' : 'rejected'
      await client.query(
        `UPDATE "ShiftSplitProposal" SET status = $1, resolved_at = NOW() WHERE id = $2`,
        [newStatus, id]
      )
      return NextResponse.json({ ok: true, status: newStatus })
    }

    // action === 'accept'
    if (!isToUser && !isManager) {
      return NextResponse.json({ error: 'Jen majitel směny nebo manažer může přijmout rozdělení' }, { status: 403 })
    }

    // Znovu načíst směnu a ověřit
    const shiftRes = await client.query(
      `SELECT id, business_id, date, start_time, end_time, assigned_employee_id, role_needed, branch_id, notes, recurring_group_id
       FROM "Shift" WHERE id = $1`,
      [proposal.shift_id]
    )
    if (shiftRes.rows.length === 0) {
      await client.query(`UPDATE "ShiftSplitProposal" SET status='cancelled', resolved_at=NOW() WHERE id=$1`, [id])
      return NextResponse.json({ error: 'Směna už neexistuje — návrh zrušen' }, { status: 409 })
    }
    const shift = shiftRes.rows[0]

    if (shift.assigned_employee_id !== proposal.to_user_id) {
      await client.query(`UPDATE "ShiftSplitProposal" SET status='cancelled', resolved_at=NOW() WHERE id=$1`, [id])
      return NextResponse.json({ error: 'Směna už není přiřazena původnímu majiteli — návrh zrušen' }, { status: 409 })
    }

    const today = todayPrague()
    if (shift.date < today) {
      return NextResponse.json({ error: 'Směna už proběhla' }, { status: 400 })
    }

    const { split_time: splitTime, proposer_half: proposerHalf, from_user_id: proposerId } = proposal

    if (splitTime <= shift.start_time || splitTime >= shift.end_time) {
      return NextResponse.json({ error: 'Čas rozdělení je mimo směnu (asi se směna mezitím upravila) — návrh zrušen' }, { status: 409 })
    }

    // Konflikt check pro proposera v jeho půlce
    const myStart = proposerHalf === 'first' ? shift.start_time : splitTime
    const myEnd   = proposerHalf === 'first' ? splitTime         : shift.end_time
    const c = await findShiftConflict(client, {
      employeeId: proposerId,
      businessId: shift.business_id,
      date: shift.date,
      startTime: myStart,
      endTime: myEnd,
      excludeShiftId: null,
    })
    if (c) return NextResponse.json({ error: formatConflictMessage(c) }, { status: 409 })

    // Atomické rozdělení
    await client.query('BEGIN')
    try {
      const newId = `sh-split-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

      if (proposerHalf === 'second') {
        // Majitel zůstává na první půlce (start..splitTime), proposer bere druhou (splitTime..end)
        await client.query(
          `UPDATE "Shift" SET end_time = $1, recurring_group_id = NULL WHERE id = $2`,
          [splitTime, shift.id]
        )
        await client.query(
          `INSERT INTO "Shift"
           (id, business_id, branch_id, date, start_time, end_time, role_needed, assigned_employee_id, status, notes, recurring_group_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'assigned',$9,NULL)`,
          [newId, shift.business_id, shift.branch_id, shift.date, splitTime, shift.end_time, shift.role_needed, proposerId, shift.notes]
        )
      } else {
        // Proposer bere první půlku (start..splitTime), majitel zůstává na druhé (splitTime..end)
        await client.query(
          `UPDATE "Shift" SET start_time = $1, recurring_group_id = NULL WHERE id = $2`,
          [splitTime, shift.id]
        )
        await client.query(
          `INSERT INTO "Shift"
           (id, business_id, branch_id, date, start_time, end_time, role_needed, assigned_employee_id, status, notes, recurring_group_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'assigned',$9,NULL)`,
          [newId, shift.business_id, shift.branch_id, shift.date, shift.start_time, splitTime, shift.role_needed, proposerId, shift.notes]
        )
      }

      await client.query(
        `UPDATE "ShiftSplitProposal" SET status='accepted', resolved_at=NOW() WHERE id=$1`,
        [id]
      )
      // Zamítnout ostatní pending proposaly na stejnou směnu
      await client.query(
        `UPDATE "ShiftSplitProposal" SET status='cancelled', resolved_at=NOW()
         WHERE shift_id = $1 AND status = 'pending' AND id != $2`,
        [proposal.shift_id, id]
      )
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    }

    return NextResponse.json({ ok: true, status: 'accepted' })
  } finally {
    client.release()
  }
}
