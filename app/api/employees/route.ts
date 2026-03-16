import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'

export async function GET(req: NextRequest) {
  const bizId = req.nextUrl.searchParams.get('bizId')
  if (!bizId) return NextResponse.json([], { status: 400 })

  const client = await pool.connect()
  try {
    const res = await client.query(
      'SELECT * FROM "User" WHERE business_id = $1 AND role = \'employee\' ORDER BY name',
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
