import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import { getSession } from '@/lib/session'
import { todayPrague } from '@/lib/tz'

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shiftId } = await req.json()
  if (!shiftId) return NextResponse.json({ error: 'Chybí shiftId' }, { status: 400 })

  const client = await pool.connect()
  try {
    const { rows } = await client.query(
      'SELECT business_id, assigned_employee_id, date FROM "Shift" WHERE id = $1',
      [shiftId]
    )
    if (rows.length === 0) return NextResponse.json({ error: 'Směna neexistuje' }, { status: 404 })
    const s = rows[0]
    if (s.business_id !== session.bizId && session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    // Employee only gives up their own shifts; manager/superadmin can release any
    if (session.role === 'employee' && s.assigned_employee_id !== session.userId) {
      return NextResponse.json({ error: 'Tuto směnu nemáš přiřazenou.' }, { status: 403 })
    }
    if (!s.assigned_employee_id) {
      return NextResponse.json({ error: 'Směna už je volná.' }, { status: 400 })
    }
    // Employee nemůže "vzdát" směnu, která už proběhla; manager smí kvůli opravám.
    if (session.role === 'employee' && s.date < todayPrague()) {
      return NextResponse.json({ error: 'Minulou směnu už nelze dát pryč.' }, { status: 400 })
    }

    await client.query(
      `UPDATE "Shift" SET assigned_employee_id = NULL, status = 'open' WHERE id = $1`,
      [shiftId]
    )
    return NextResponse.json({ ok: true })
  } finally {
    client.release()
  }
}
