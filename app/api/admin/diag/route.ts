import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'

// Diagnostický endpoint — pouze pro akutní krizi, chráněn secretem.
// GET /api/admin/diag?secret=ksh-init-2026
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== 'ksh-init-2026') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const client = await pool.connect()
  try {
    const bizRes = await client.query(`
      SELECT
        b.id,
        b.name,
        (SELECT COUNT(*) FROM "User"         u  WHERE u.business_id = b.id) AS user_count,
        (SELECT COUNT(*) FROM "Shift"        s  WHERE s.business_id = b.id) AS shift_total,
        (SELECT COUNT(*) FROM "Shift"        s  WHERE s.business_id = b.id AND s.status = 'open') AS open_total,
        (SELECT COUNT(*) FROM "Branch"       br WHERE br.business_id = b.id) AS branch_count,
        (SELECT COUNT(*) FROM "WorkLog"      w  WHERE w.business_id = b.id) AS worklog_total,
        (SELECT COUNT(*) FROM "ClockSession" c  WHERE c.business_id = b.id) AS clock_total,
        (SELECT MIN(date) FROM "WorkLog"     w  WHERE w.business_id = b.id) AS worklog_first_date,
        (SELECT MAX(date) FROM "WorkLog"     w  WHERE w.business_id = b.id) AS worklog_last_date
      FROM "Business" b
      ORDER BY b.name
    `)

    const monthly = await client.query(`
      SELECT
        business_id,
        to_char(date::date, 'YYYY-MM') AS ym,
        COUNT(*)::int                  AS n,
        COUNT(*) FILTER (WHERE status = 'open')::int   AS open_n,
        COUNT(*) FILTER (WHERE status != 'open')::int  AS assigned_n
      FROM "Shift"
      GROUP BY business_id, ym
      ORDER BY business_id, ym
    `)

    // Shifty v blízkosti dneška (+/- 60 dní)
    const near = await client.query(`
      SELECT
        s.id, s.business_id, s.date, s.start_time, s.end_time,
        s.status, s.branch_id, s.assigned_employee_id,
        u.name AS assigned_name
      FROM "Shift" s
      LEFT JOIN "User" u ON u.id = s.assigned_employee_id
      WHERE s.date::date BETWEEN (CURRENT_DATE - INTERVAL '60 days') AND (CURRENT_DATE + INTERVAL '60 days')
      ORDER BY s.date
      LIMIT 200
    `)

    // Celkové rozpětí dat v DB
    const range = await client.query(`
      SELECT
        business_id,
        MIN(date::date) AS first_date,
        MAX(date::date) AS last_date,
        COUNT(*)::int   AS total
      FROM "Shift"
      GROUP BY business_id
    `)

    return NextResponse.json({
      now: new Date().toISOString(),
      businesses: bizRes.rows,
      monthly: monthly.rows,
      range: range.rows,
      nearTodayCount: near.rowCount,
      nearToday: near.rows,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } finally {
    client.release()
  }
}
