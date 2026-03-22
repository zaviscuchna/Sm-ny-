import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import { format } from 'date-fns'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const bizId = searchParams.get('bizId')
  const date  = searchParams.get('date') ?? format(new Date(), 'yyyy-MM-dd')
  if (!bizId) return NextResponse.json([], { status: 400 })

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
