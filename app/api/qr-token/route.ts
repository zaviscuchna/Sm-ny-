import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import { randomUUID } from 'crypto'
import { getSession } from '@/lib/session'

const TOKEN_TTL_MINUTES = 3

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'manager' && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const bizId = req.nextUrl.searchParams.get('bizId') || session.bizId
  if (bizId !== session.bizId && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const client = await pool.connect()
  try {
    const existing = await client.query(
      `SELECT token, expires_at FROM "QrToken"
       WHERE business_id = $1 AND expires_at > NOW()
       ORDER BY expires_at DESC LIMIT 1`,
      [bizId]
    )

    if (existing.rows.length > 0) {
      return NextResponse.json({
        token:     existing.rows[0].token,
        expiresAt: existing.rows[0].expires_at,
      })
    }

    const token     = randomUUID().replace(/-/g, '')
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000)
    const id        = `qt-${Date.now()}`

    await client.query(
      `INSERT INTO "QrToken" (id, business_id, token, expires_at) VALUES ($1,$2,$3,$4)`,
      [id, bizId, token, expiresAt.toISOString()]
    )

    await client.query(
      `DELETE FROM "QrToken" WHERE business_id = $1 AND expires_at < NOW()`,
      [bizId]
    )

    return NextResponse.json({ token, expiresAt: expiresAt.toISOString() })
  } finally {
    client.release()
  }
}
