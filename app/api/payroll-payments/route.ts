import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import { getSession } from '@/lib/session'

// Auto-create table on first use — safe to run repeatedly
async function ensureTable() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "PayrollPayment" (
        id          TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        business_id TEXT NOT NULL,
        month       TEXT NOT NULL,
        is_paid     BOOLEAN NOT NULL DEFAULT FALSE,
        paid_at     TIMESTAMPTZ,
        paid_by_id  TEXT,
        UNIQUE(employee_id, business_id, month)
      )
    `)
  } finally {
    client.release()
  }
}

// GET ?bizId=&month=YYYY-MM — only managers
export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'manager' && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const bizId = searchParams.get('bizId') || session.bizId
  const month = searchParams.get('month')

  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })
  if (bizId !== session.bizId && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureTable()

  const client = await pool.connect()
  try {
    const { rows } = await client.query(
      `SELECT employee_id, is_paid, paid_at, paid_by_id FROM "PayrollPayment"
       WHERE business_id = $1 AND month = $2`,
      [bizId, month]
    )
    const result: Record<string, boolean> = {}
    for (const row of rows) {
      result[row.employee_id] = row.is_paid
    }
    return NextResponse.json(result)
  } finally {
    client.release()
  }
}

// POST { bizId, employeeId, month, isPaid } — toggle, only managers
export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'manager' && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { bizId, employeeId, month, isPaid } = await req.json()
  if (!bizId || !employeeId || !month || typeof isPaid !== 'boolean') {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  if (bizId !== session.bizId && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureTable()

  const client = await pool.connect()
  try {
    const id = `pp-${employeeId}-${month}`
    await client.query(
      `INSERT INTO "PayrollPayment" (id, employee_id, business_id, month, is_paid, paid_at, paid_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (employee_id, business_id, month)
       DO UPDATE SET is_paid = $5, paid_at = $6, paid_by_id = $7`,
      [id, employeeId, bizId, month, isPaid, isPaid ? new Date().toISOString() : null, isPaid ? session.userId : null]
    )
    return NextResponse.json({ ok: true, isPaid })
  } finally {
    client.release()
  }
}
