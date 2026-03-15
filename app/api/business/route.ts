import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'

export async function GET(req: NextRequest) {
  const bizId = req.nextUrl.searchParams.get('bizId')
  if (!bizId) return NextResponse.json({ error: 'Missing bizId' }, { status: 400 })

  const client = await pool.connect()
  try {
    const res = await client.query('SELECT positions FROM "Business" WHERE id = $1', [bizId])
    if (res.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const positions: string[] = JSON.parse(res.rows[0].positions || '[]')
    return NextResponse.json({ positions })
  } finally {
    client.release()
  }
}

export async function PATCH(req: NextRequest) {
  const { bizId, positions } = await req.json()
  if (!bizId || !Array.isArray(positions)) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    await client.query(
      'UPDATE "Business" SET positions = $1 WHERE id = $2',
      [JSON.stringify(positions), bizId]
    )
    return NextResponse.json({ ok: true })
  } finally {
    client.release()
  }
}
