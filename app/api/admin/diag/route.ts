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
        b.join_code,
        (SELECT COUNT(*) FROM "User" u WHERE u.business_id = b.id) AS user_count,
        (SELECT COUNT(*) FROM "Shift" s WHERE s.business_id = b.id) AS shift_count,
        (SELECT COUNT(*) FROM "Shift" s WHERE s.business_id = b.id AND s.branch_id IS NULL) AS shifts_without_branch,
        (SELECT COUNT(*) FROM "Shift" s WHERE s.business_id = b.id AND s.status = 'open') AS open_shifts,
        (SELECT COUNT(*) FROM "Shift" s WHERE s.business_id = b.id AND s.status = 'assigned') AS assigned_shifts,
        (SELECT COUNT(*) FROM "Branch" br WHERE br.business_id = b.id) AS branch_count
      FROM "Business" b
      ORDER BY b.name
    `)

    const recentShifts = await client.query(`
      SELECT
        s.id,
        s.business_id,
        s.date,
        s.start_time,
        s.end_time,
        s.role_needed,
        s.status,
        s.branch_id,
        s.assigned_employee_id,
        u.name AS assigned_name
      FROM "Shift" s
      LEFT JOIN "User" u ON u.id = s.assigned_employee_id
      ORDER BY s.date DESC
      LIMIT 30
    `)

    const recentUsers = await client.query(`
      SELECT id, name, email, role, business_id
      FROM "User"
      ORDER BY id DESC
      LIMIT 30
    `)

    return NextResponse.json({
      businesses: bizRes.rows,
      recentShifts: recentShifts.rows,
      recentUsers: recentUsers.rows,
      now: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } finally {
    client.release()
  }
}
