import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import { getSession, SessionPayload } from '@/lib/session'

function requireManager(session: SessionPayload | null): NextResponse | null {
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'manager' && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bizId = req.nextUrl.searchParams.get('bizId') || session.bizId
  if (bizId !== session.bizId && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const client = await pool.connect()
  try {
    const res = await client.query(
      'SELECT * FROM "Branch" WHERE business_id = $1 ORDER BY created_at ASC',
      [bizId]
    )
    return NextResponse.json(res.rows.map(r => ({
      id: r.id,
      name: r.name,
      address: r.address,
      businessId: r.business_id,
      createdAt: r.created_at,
    })))
  } finally {
    client.release()
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  const err = requireManager(session)
  if (err) return err

  const { bizId, name, address } = await req.json()
  if (!bizId || !name) {
    return NextResponse.json({ error: 'Missing bizId or name' }, { status: 400 })
  }
  if (bizId !== session!.bizId && session!.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const id = `br-${Date.now()}`
  const client = await pool.connect()
  try {
    await client.query(
      'INSERT INTO "Branch" (id, name, address, business_id) VALUES ($1, $2, $3, $4)',
      [id, name.trim(), (address ?? '').trim(), bizId]
    )
    return NextResponse.json({ id, name: name.trim(), address: (address ?? '').trim(), businessId: bizId })
  } finally {
    client.release()
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req)
  const err = requireManager(session)
  if (err) return err

  const { id, name, address } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const client = await pool.connect()
  try {
    const { rows } = await client.query('SELECT business_id FROM "Branch" WHERE id = $1', [id])
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (rows[0].business_id !== session!.bizId && session!.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sets: string[] = []
    const vals: any[] = []
    let idx = 1
    if (name !== undefined) { sets.push(`name = $${idx++}`); vals.push(name.trim()) }
    if (address !== undefined) { sets.push(`address = $${idx++}`); vals.push(address.trim()) }
    if (sets.length > 0) {
      vals.push(id)
      await client.query(`UPDATE "Branch" SET ${sets.join(', ')} WHERE id = $${idx}`, vals)
    }
    return NextResponse.json({ ok: true })
  } finally {
    client.release()
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession(req)
  const err = requireManager(session)
  if (err) return err

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const client = await pool.connect()
  try {
    const { rows } = await client.query('SELECT business_id FROM "Branch" WHERE id = $1', [id])
    if (rows.length === 0) return NextResponse.json({ ok: true })
    if (rows[0].business_id !== session!.bizId && session!.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await client.query('DELETE FROM "EmployeeBranch" WHERE branch_id = $1', [id])
    await client.query('UPDATE "Shift" SET branch_id = NULL WHERE branch_id = $1', [id])
    await client.query('DELETE FROM "Branch" WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } finally {
    client.release()
  }
}
