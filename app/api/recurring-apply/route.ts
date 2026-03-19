import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'

// POST — apply to all open shifts in a recurring group
export async function POST(req: NextRequest) {
  const { recurringGroupId, employeeId, employeeName, bizId } = await req.json()
  if (!recurringGroupId || !employeeId || !bizId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    // Get all open shifts in the group
    const { rows: shifts } = await client.query(
      `SELECT id FROM "Shift" WHERE recurring_group_id = $1 AND business_id = $2 AND status = 'open'`,
      [recurringGroupId, bizId]
    )

    if (shifts.length === 0) {
      return NextResponse.json({ count: 0 })
    }

    const now = new Date().toISOString().slice(0, 10)
    const created: string[] = []

    for (const shift of shifts) {
      // Skip if already applied
      const { rows: existing } = await client.query(
        `SELECT id FROM "ShiftApplication" WHERE shift_id = $1 AND employee_id = $2`,
        [shift.id, employeeId]
      )
      if (existing.length > 0) continue

      const appId = `app-${Date.now()}-${Math.random().toString(36).slice(2)}`
      await client.query(
        `INSERT INTO "ShiftApplication" (id, shift_id, employee_id, employee_name, business_id, status, created_at)
         VALUES ($1,$2,$3,$4,$5,'pending',$6)`,
        [appId, shift.id, employeeId, employeeName, bizId, now]
      )
      created.push(shift.id)
    }

    return NextResponse.json({ count: created.length, shiftIds: created })
  } finally {
    client.release()
  }
}
