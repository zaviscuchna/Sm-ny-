import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== 'ksh-init-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== 'ksh-init-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
