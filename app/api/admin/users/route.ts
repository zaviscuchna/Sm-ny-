import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const client = await pool.connect()
  try {
    const res = await client.query(`
      SELECT u.id, u.name, u.email, u.role, u.color,
             u.password_hash IS NOT NULL AS has_password,
             b.name AS business_name, b.join_code
      FROM "User" u
      LEFT JOIN "Business" b ON b.id = u.business_id
      ORDER BY u.id DESC
    `)
    return NextResponse.json(res.rows)
  } finally {
    client.release()
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession(req)
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

  const client = await pool.connect()
  try {
    await client.query('DELETE FROM "User" WHERE email = $1', [email.toLowerCase()])
    return NextResponse.json({ ok: true, deleted: email })
  } finally {
    client.release()
  }
}
