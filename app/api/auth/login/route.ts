import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import bcrypt from 'bcryptjs'
import { setSessionCookie } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { email, password, rememberMe } = await req.json()

  const client = await pool.connect()
  try {
    const userRes = await client.query(
      'SELECT * FROM "User" WHERE email = $1',
      [email.toLowerCase()]
    )
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'Účet nenalezen. Zaregistruj se prosím.' }, { status: 404 })
    }

    const user = userRes.rows[0]

    if (user.password_hash) {
      const ok = await bcrypt.compare(password ?? '', user.password_hash)
      if (!ok) return NextResponse.json({ error: 'Špatné heslo.' }, { status: 401 })
    }

    const bizRes = await client.query(
      'SELECT * FROM "Business" WHERE id = $1',
      [user.business_id]
    )
    const biz = bizRes.rows[0] ?? null

    const res = NextResponse.json({
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
    await setSessionCookie(res, {
      userId: user.id,
      bizId:  user.business_id,
      role:   user.role,
      name:   user.name,
      email:  user.email,
    }, rememberMe ? 30 : 1)
    return res
  } finally {
    client.release()
  }
}
