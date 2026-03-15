import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'

function calcHours(clockIn: string, clockOut: string): number {
  const [ih, im] = clockIn.split(':').map(Number)
  const [oh, om] = clockOut.split(':').map(Number)
  return Math.round(((oh + om / 60) - (ih + im / 60)) * 10) / 10
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const bizId      = searchParams.get('bizId')
  const employeeId = searchParams.get('employeeId')
  const month      = searchParams.get('month')

  if (!bizId) return NextResponse.json([], { status: 400 })

  const client = await pool.connect()
  try {
    let res
    if (employeeId) {
      res = await client.query(
        'SELECT * FROM "WorkLog" WHERE employee_id = $1 AND business_id = $2 ORDER BY date DESC',
        [employeeId, bizId]
      )
    } else if (month) {
      const [y, m] = month.split('-').map(Number)
      const nextM = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
      res = await client.query(
        `SELECT * FROM "WorkLog" WHERE business_id = $1 AND date >= $2 AND date < $3 ORDER BY date DESC`,
        [bizId, `${month}-01`, `${nextM}-01`]
      )
    } else {
      return NextResponse.json([])
    }
    return NextResponse.json(res.rows.map(rowToLog))
  } finally {
    client.release()
  }
}

export async function POST(req: NextRequest) {
  const { log, bizId } = await req.json()
  const id    = `wl-${Date.now()}`
  const hours = calcHours(log.clockIn, log.clockOut)

  const client = await pool.connect()
  try {
    await client.query(
      `INSERT INTO "WorkLog" (id, employee_id, employee_name, business_id, date, clock_in, clock_out, hours, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, log.employeeId, log.employeeName, bizId, log.date, log.clockIn, log.clockOut, hours, log.notes ?? null]
    )
    return NextResponse.json({ id, hours, ...log })
  } finally {
    client.release()
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false }, { status: 400 })
  const client = await pool.connect()
  try {
    await client.query('DELETE FROM "WorkLog" WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } finally {
    client.release()
  }
}

function rowToLog(row: any) {
  return {
    id:           row.id,
    employeeId:   row.employee_id,
    employeeName: row.employee_name,
    date:         row.date,
    clockIn:      row.clock_in,
    clockOut:     row.clock_out,
    hours:        parseFloat(row.hours),
    notes:        row.notes ?? undefined,
  }
}
