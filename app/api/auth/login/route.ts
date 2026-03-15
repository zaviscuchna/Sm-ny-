import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  const client = await pool.connect()
  try {
    const userRes = await client.query(
      'SELECT * FROM "User" WHERE email = $1',
      [email.toLowerCase()]
    )
    if (userRes.rows.length === 0) return NextResponse.json(null)

    const user = userRes.rows[0]
    const bizRes = await client.query(
      'SELECT * FROM "Business" WHERE id = $1',
      [user.business_id]
    )
    const biz = bizRes.rows[0] ?? null

    return NextResponse.json({
      user: {
        id:         user.id,
        name:       user.name,
        email:      user.email,
        role:       user.role,
        color:      user.color,
        businessId: user.business_id,
      },
      business: biz ? { id: biz.id, name: biz.name, location: biz.location } : null,
      joinCode:  biz?.join_code ?? null,
    })
  } finally {
    client.release()
  }
}
