import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import bcrypt from 'bcryptjs'
import { setSessionCookie } from '@/lib/session'

const AVATAR_COLORS = ['#6366f1','#f59e0b','#10b981','#ec4899','#3b82f6','#8b5cf6','#14b8a6','#f97316']
const randomColor = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]

export async function POST(req: NextRequest) {
  const { type, name, email, password, businessName, location, joinCode } = await req.json()

  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Heslo musí mít alespoň 6 znaků.' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    // Check if email exists
    const existing = await client.query(
      'SELECT id FROM "User" WHERE email = $1',
      [email.toLowerCase()]
    )
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Tento e-mail je již registrován.' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    let bizId: string
    let bizName: string
    let bizLocation: string
    let code: string

    if (type === 'manager') {
      bizId       = `biz-reg-${Date.now()}`
      bizName     = businessName!
      bizLocation = location ?? ''
      code        = String(Math.floor(100000 + Math.random() * 900000))

      await client.query(
        'INSERT INTO "Business" (id, name, location, join_code) VALUES ($1,$2,$3,$4)',
        [bizId, bizName, bizLocation, code]
      )
    } else {
      const bizRes = await client.query(
        'SELECT * FROM "Business" WHERE join_code = $1',
        [joinCode?.trim()]
      )
      if (bizRes.rows.length === 0) {
        return NextResponse.json({ error: 'Kód podniku nebyl nalezen.' }, { status: 400 })
      }
      const biz = bizRes.rows[0]
      bizId       = biz.id
      bizName     = biz.name
      bizLocation = biz.location
      code        = biz.join_code
    }

    const userId = `u-reg-${Date.now()}`
    const color  = randomColor()
    const role   = type === 'manager' ? 'manager' : 'employee'

    await client.query(
      'INSERT INTO "User" (id, name, email, role, color, business_id, password_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [userId, name, email.toLowerCase(), role, color, bizId, passwordHash]
    )

    const res = NextResponse.json({
      user:     { id: userId, name, email: email.toLowerCase(), role, color, businessId: bizId },
      business: { id: bizId, name: bizName, location: bizLocation },
      joinCode: code,
    })
    setSessionCookie(res, {
      userId: userId,
      bizId:  bizId,
      role:   role as 'manager' | 'employee',
      name:   name,
      email:  email.toLowerCase(),
    }, 30)
    return res
  } finally {
    client.release()
  }
}
