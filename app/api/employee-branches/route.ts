import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'

// GET /api/employee-branches?branchId=xxx — employees in a branch
// GET /api/employee-branches?userId=xxx — branches for an employee
// GET /api/employee-branches?bizId=xxx — all employee-branch mappings for a business
export async function GET(req: NextRequest) {
  const branchId = req.nextUrl.searchParams.get('branchId')
  const userId = req.nextUrl.searchParams.get('userId')
  const bizId = req.nextUrl.searchParams.get('bizId')

  const client = await pool.connect()
  try {
    let res
    if (branchId) {
      res = await client.query(
        `SELECT eb.*, u.name as user_name, u.email as user_email, u.color as user_color, u.phone as user_phone, u.role as user_role
         FROM "EmployeeBranch" eb
         JOIN "User" u ON u.id = eb.user_id
         WHERE eb.branch_id = $1
         ORDER BY u.name`,
        [branchId]
      )
    } else if (userId) {
      res = await client.query(
        `SELECT eb.*, b.name as branch_name, b.address as branch_address
         FROM "EmployeeBranch" eb
         JOIN "Branch" b ON b.id = eb.branch_id
         WHERE eb.user_id = $1
         ORDER BY b.name`,
        [userId]
      )
    } else if (bizId) {
      res = await client.query(
        `SELECT eb.*, u.name as user_name, u.email as user_email, u.color as user_color,
                b.name as branch_name
         FROM "EmployeeBranch" eb
         JOIN "User" u ON u.id = eb.user_id
         JOIN "Branch" b ON b.id = eb.branch_id
         WHERE b.business_id = $1
         ORDER BY b.name, u.name`,
        [bizId]
      )
    } else {
      return NextResponse.json([], { status: 400 })
    }

    return NextResponse.json(res.rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      branchId: r.branch_id,
      role: r.role,
      permissions: r.permissions ?? [],
      user: r.user_name ? {
        id: r.user_id,
        name: r.user_name,
        email: r.user_email,
        color: r.user_color,
        phone: r.user_phone,
        role: r.user_role,
      } : undefined,
      branch: r.branch_name ? {
        id: r.branch_id,
        name: r.branch_name,
        address: r.branch_address,
      } : undefined,
    })))
  } finally {
    client.release()
  }
}

// POST /api/employee-branches — assign employee to branch
export async function POST(req: NextRequest) {
  const { userId, branchId, role, permissions } = await req.json()
  if (!userId || !branchId) {
    return NextResponse.json({ error: 'Missing userId or branchId' }, { status: 400 })
  }

  const id = `eb-${Date.now()}`
  const client = await pool.connect()
  try {
    await client.query(
      `INSERT INTO "EmployeeBranch" (id, user_id, branch_id, role, permissions)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, branch_id) DO UPDATE SET role = $4, permissions = $5`,
      [id, userId, branchId, role ?? 'employee', permissions ?? []]
    )
    return NextResponse.json({ id, userId, branchId, role: role ?? 'employee', permissions: permissions ?? [] })
  } finally {
    client.release()
  }
}

// PATCH /api/employee-branches — update permissions
export async function PATCH(req: NextRequest) {
  const { id, userId, branchId, permissions, role } = await req.json()

  const client = await pool.connect()
  try {
    if (id) {
      const sets: string[] = []
      const vals: any[] = []
      let idx = 1
      if (permissions !== undefined) { sets.push(`permissions = $${idx++}`); vals.push(permissions) }
      if (role !== undefined) { sets.push(`role = $${idx++}`); vals.push(role) }
      if (sets.length > 0) {
        vals.push(id)
        await client.query(`UPDATE "EmployeeBranch" SET ${sets.join(', ')} WHERE id = $${idx}`, vals)
      }
    } else if (userId && branchId) {
      const sets: string[] = []
      const vals: any[] = []
      let idx = 1
      if (permissions !== undefined) { sets.push(`permissions = $${idx++}`); vals.push(permissions) }
      if (role !== undefined) { sets.push(`role = $${idx++}`); vals.push(role) }
      if (sets.length > 0) {
        vals.push(userId)
        vals.push(branchId)
        await client.query(
          `UPDATE "EmployeeBranch" SET ${sets.join(', ')} WHERE user_id = $${idx} AND branch_id = $${idx + 1}`,
          vals
        )
      }
    }
    return NextResponse.json({ ok: true })
  } finally {
    client.release()
  }
}

// DELETE /api/employee-branches?id=xxx — remove employee from branch
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const client = await pool.connect()
  try {
    await client.query('DELETE FROM "EmployeeBranch" WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } finally {
    client.release()
  }
}
