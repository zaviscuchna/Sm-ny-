import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'

// GET /api/branches?bizId=xxx — list branches for a business
export async function GET(req: NextRequest) {
  const bizId = req.nextUrl.searchParams.get('bizId')
  if (!bizId) return NextResponse.json([], { status: 400 })

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

// POST /api/branches — create a new branch
export async function POST(req: NextRequest) {
  const { bizId, name, address } = await req.json()
  if (!bizId || !name) {
    return NextResponse.json({ error: 'Missing bizId or name' }, { status: 400 })
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

// PATCH /api/branches — update branch name/address
export async function PATCH(req: NextRequest) {
  const { id, name, address } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const client = await pool.connect()
  try {
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

// DELETE /api/branches?id=xxx — delete a branch
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const client = await pool.connect()
  try {
    // Remove employee-branch assignments first
    await client.query('DELETE FROM "EmployeeBranch" WHERE branch_id = $1', [id])
    // Unlink shifts from this branch (don't delete them)
    await client.query('UPDATE "Shift" SET branch_id = NULL WHERE branch_id = $1', [id])
    // Delete branch
    await client.query('DELETE FROM "Branch" WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } finally {
    client.release()
  }
}
