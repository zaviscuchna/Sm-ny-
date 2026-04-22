import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import { getSession } from '@/lib/session'
import { todayPrague, nowTimePrague } from '@/lib/tz'

function calcHours(clockIn: string, clockOut: string): number {
  const [ih, im] = clockIn.split(':').map(Number)
  const [oh, om] = clockOut.split(':').map(Number)
  return Math.round(((oh + om / 60) - (ih + im / 60)) * 10) / 10
}

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const bizId      = searchParams.get('bizId') || session.bizId
  const employeeId = searchParams.get('employeeId') || session.userId
  if (bizId !== session.bizId && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (session.role === 'employee' && employeeId !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const today  = todayPrague()
  const client = await pool.connect()
  try {
    const res = await client.query(
      `SELECT * FROM "ClockSession"
       WHERE business_id = $1 AND employee_id = $2 AND date = $3 AND clock_out IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [bizId, employeeId, today]
    )
    if (res.rows.length > 0) {
      return NextResponse.json({ status: 'clocked_in', clockIn: res.rows[0].clock_in, sessionId: res.rows[0].id })
    }
    return NextResponse.json({ status: 'clocked_out' })
  } finally {
    client.release()
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token, bizId, employeeId, employeeName } = await req.json()
  if (!token || !bizId || !employeeId || !employeeName) {
    return NextResponse.json({ error: 'Chybí parametry' }, { status: 400 })
  }
  if (bizId !== session.bizId && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (session.role === 'employee' && employeeId !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const client = await pool.connect()
  try {
    const tokenRes = await client.query(
      `SELECT id FROM "QrToken" WHERE business_id = $1 AND token = $2 AND expires_at > NOW()`,
      [bizId, token]
    )
    if (tokenRes.rows.length === 0) {
      return NextResponse.json({ error: 'QR kód vypršel nebo je neplatný. Načti nový.' }, { status: 400 })
    }

    const today = todayPrague()
    const now   = nowTimePrague()

    const openSession = await client.query(
      `SELECT * FROM "ClockSession"
       WHERE business_id = $1 AND employee_id = $2 AND date = $3 AND clock_out IS NULL`,
      [bizId, employeeId, today]
    )

    if (openSession.rows.length === 0) {
      const id = `cs-${Date.now()}`
      await client.query(
        `INSERT INTO "ClockSession" (id, business_id, employee_id, employee_name, date, clock_in)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, bizId, employeeId, employeeName, today, now]
      )
      return NextResponse.json({ action: 'clock_in', time: now })
    } else {
      const csRow  = openSession.rows[0]
      const hours  = calcHours(csRow.clock_in, now)
      await client.query(
        `UPDATE "ClockSession" SET clock_out = $1, hours = $2 WHERE id = $3`,
        [now, hours, csRow.id]
      )
      const wlId = `wl-qr-${Date.now()}`
      await client.query(
        `INSERT INTO "WorkLog" (id, employee_id, employee_name, business_id, date, clock_in, clock_out, hours, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO NOTHING`,
        [wlId, employeeId, employeeName, bizId, today, csRow.clock_in, now, hours, 'QR docházka']
      )
      return NextResponse.json({ action: 'clock_out', time: now, hours })
    }
  } finally {
    client.release()
  }
}
