import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import { randomUUID } from 'crypto'

const TOKEN_TTL_MINUTES = 3

export async function GET(req: NextRequest) {
  const bizId = req.nextUrl.searchParams.get('bizId')
  if (!bizId) return NextResponse.json({ error: 'Missing bizId' }, { status: 400 })

  const client = await pool.connect()
  try {
    // Try to find a still-valid token
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

    // Generate new token
    const token     = randomUUID().replace(/-/g, '')
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000)
    const id        = `qt-${Date.now()}`

    await client.query(
      `INSERT INTO "QrToken" (id, business_id, token, expires_at) VALUES ($1,$2,$3,$4)`,
      [id, bizId, token, expiresAt.toISOString()]
    )

    // Clean up old tokens
    await client.query(
      `DELETE FROM "QrToken" WHERE business_id = $1 AND expires_at < NOW()`,
      [bizId]
    )

    return NextResponse.json({ token, expiresAt: expiresAt.toISOString() })
  } finally {
    client.release()
  }
}
