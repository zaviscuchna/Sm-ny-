import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import { getSession } from '@/lib/session'
import { todayPrague } from '@/lib/tz'

/**
 * Hromadné odhlášení zaměstnance z přiřazených směn.
 *
 * POST /api/shifts/bulk-unassign
 * body: {
 *   employeeId: string,
 *   fromDate?: string (YYYY-MM-DD, default = dnes Prague),
 *   toDate?: string,
 *   groupId?: string,       // omezit jen na tuto sérii
 *   preview?: boolean       // true = jen spočítat, neměnit
 * }
 *
 * Pravidla:
 * - Manager smí odhlásit kohokoliv, employee jen sebe
 * - Nikdy se nesahá na minulé směny (date < today)
 * - Limit 2000 směn najednou (ochrana před přehlédnutím)
 * - Vše v transakci
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { employeeId, groupId, preview } = body
  const fromDate: string = body.fromDate ?? todayPrague()
  const toDate: string | null = body.toDate ?? null

  if (!employeeId) {
    return NextResponse.json({ error: 'Chybí employeeId' }, { status: 400 })
  }

  const isManager = session.role === 'manager' || session.role === 'superadmin'
  if (!isManager && employeeId !== session.userId) {
    return NextResponse.json({ error: 'Zaměstnanec může odhlásit jen sebe' }, { status: 403 })
  }

  // Bezpečnost: fromDate nesmí být v minulosti (chrání před nechtěným zásahem do minulých záznamů)
  const today = todayPrague()
  const effectiveFrom = fromDate < today ? today : fromDate
  if (toDate && toDate < effectiveFrom) {
    return NextResponse.json({ error: 'toDate musí být >= fromDate' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    // Nejprve preview — spočítat co by se odhlásilo
    const conditions: string[] = [
      `business_id = $1`,
      `assigned_employee_id = $2`,
      `date >= $3`,
    ]
    const params: any[] = [session.bizId, employeeId, effectiveFrom]
    let idx = 4
    if (toDate) { conditions.push(`date <= $${idx++}`); params.push(toDate) }
    if (groupId) { conditions.push(`recurring_group_id = $${idx++}`); params.push(groupId) }

    const where = conditions.join(' AND ')

    const previewRes = await client.query(
      `SELECT id, date, start_time, end_time, role_needed, recurring_group_id, branch_id
       FROM "Shift" WHERE ${where}
       ORDER BY date, start_time
       LIMIT 2000`,
      params
    )

    const affectedCount = previewRes.rowCount ?? 0

    if (preview) {
      return NextResponse.json({
        count: affectedCount,
        shifts: previewRes.rows.map(r => ({
          id: r.id,
          date: r.date,
          startTime: r.start_time,
          endTime: r.end_time,
          roleNeeded: r.role_needed,
          recurringGroupId: r.recurring_group_id ?? undefined,
          branchId: r.branch_id ?? undefined,
        })),
      })
    }

    if (affectedCount === 0) {
      return NextResponse.json({ count: 0, unassigned: [] })
    }

    // Atomický update — pouze ID které jsme vyčetli v preview
    const ids = previewRes.rows.map(r => r.id)

    await client.query('BEGIN')
    try {
      const upd = await client.query(
        `UPDATE "Shift"
           SET assigned_employee_id = NULL, status = 'open'
         WHERE id = ANY($1::text[])
           AND business_id = $2
           AND assigned_employee_id = $3
           AND date >= $4
         RETURNING id`,
        [ids, session.bizId, employeeId, effectiveFrom]
      )
      await client.query('COMMIT')
      return NextResponse.json({
        count: upd.rowCount ?? 0,
        unassigned: upd.rows.map(r => r.id),
      })
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    }
  } finally {
    client.release()
  }
}
