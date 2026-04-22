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
    const res = await client.query('SELECT positions FROM "Business" WHERE id = $1', [bizId])
    if (res.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const positions: string[] = JSON.parse(res.rows[0].positions || '[]')
    return NextResponse.json({ positions })
  } finally {
    client.release()
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'manager' && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { bizId, positions } = await req.json()
  if (!bizId || !Array.isArray(positions)) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }
  if (bizId !== session.bizId && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
