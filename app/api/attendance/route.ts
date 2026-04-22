import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import { getSession } from '@/lib/session'
import { todayPrague } from '@/lib/tz'

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const bizId = searchParams.get('bizId') || session.bizId
  const date  = searchParams.get('date') ?? todayPrague()
  if (bizId !== session.bizId && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const client = await pool.connect()
  try {
    const res = await client.query(
      `SELECT * FROM "ClockSession"
       WHERE business_id = $1 AND date = $2
       ORDER BY clock_in ASC`,
      [bizId, date]
    )
    return NextResponse.json(res.rows.map(r => ({
      id:           r.id,
      employeeId:   r.employee_id,
      employeeName: r.employee_name,
      date:         r.date,
      clockIn:      r.clock_in,
      clockOut:     r.clock_out ?? null,
      hours:        r.hours ? parseFloat(r.hours) : null,
    })))
  } finally {
    client.release()
  }
}
