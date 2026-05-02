import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bizId = req.nextUrl.searchParams.get('bizId') || session.bizId
  if (bizId !== session.bizId && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const client = await pool.connect()
  try {
    const res = await client.query(
      'SELECT * FROM "User" WHERE business_id = $1 AND role IN (\'employee\', \'manager\') ORDER BY name',
      [bizId]
    )
    const employees = res.rows.map(r => ({
      id:    r.id,
      name:  r.name,
      email: r.email,
      role:  r.role,
      color: r.color,
      phone: r.phone ?? undefined,
    }))
    return NextResponse.json(employees)
  } finally {
    client.release()
  }
}
