import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'

// READ-ONLY diag endpoint pro nalezení usera podle emailu a kontroly biznisu.
// Vrátí kompletní stav (user, biznis, pobočky, EmployeeBranch, počty směn/worklogs)
// pro auditní inspekci PŘED jakoukoliv změnou.
//
// GET /api/admin/find-user?secret=ksh-init-2026&email=...&bizName=...
// Pokud je zadán bizName, hledá biznis ILIKE.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== 'ksh-init-2026') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const email = req.nextUrl.searchParams.get('email')?.toLowerCase().trim()
  const bizName = req.nextUrl.searchParams.get('bizName')?.trim()

  if (!email && !bizName) {
    return NextResponse.json({ error: 'Provide ?email=... or ?bizName=...' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    // 1) najdi usera (pokud zadán email)
    let user: Record<string, unknown> | null = null
    if (email) {
      const u = await client.query(
        `SELECT id, name, email, role, color, phone, business_id
         FROM "User" WHERE email = $1`,
        [email]
      )
      user = u.rows[0] ?? null
    }

    // 2) najdi biznis(y) podle názvu (volitelné)
    let businesses: Record<string, unknown>[] = []
    if (bizName) {
      const b = await client.query(
        `SELECT id, name, location, join_code FROM "Business" WHERE name ILIKE $1 ORDER BY name`,
        [`%${bizName}%`]
      )
      businesses = b.rows
    }

    // 3) pokud máme usera, dej kontext jeho biznisu + počty
    let userContext: Record<string, unknown> | null = null
    if (user) {
      const biz = await client.query(
        `SELECT id, name, location, join_code FROM "Business" WHERE id = $1`,
        [user.business_id]
      )
      const branches = await client.query(
        `SELECT id, name, address FROM "Branch" WHERE business_id = $1 ORDER BY created_at`,
        [user.business_id]
      )
      const empBranches = await client.query(
        `SELECT eb.id, eb.branch_id, eb.role, eb.permissions, b.name as branch_name
         FROM "EmployeeBranch" eb
         JOIN "Branch" b ON b.id = eb.branch_id
         WHERE eb.user_id = $1`,
        [user.id]
      )
      const shiftCount = await client.query(
        `SELECT COUNT(*)::int AS c FROM "Shift" WHERE assigned_employee_id = $1`,
        [user.id]
      )
      const futureShiftCount = await client.query(
        `SELECT COUNT(*)::int AS c FROM "Shift" WHERE assigned_employee_id = $1 AND date::date >= CURRENT_DATE`,
        [user.id]
      )
      const workLogCount = await client.query(
        `SELECT COUNT(*)::int AS c FROM "WorkLog" WHERE employee_id = $1`,
        [user.id]
      )
      const applicationCount = await client.query(
        `SELECT COUNT(*)::int AS c FROM "ShiftApplication" WHERE employee_id = $1`,
        [user.id]
      )
      userContext = {
        user,
        business: biz.rows[0] ?? null,
        branches: branches.rows,
        employeeBranches: empBranches.rows,
        counts: {
          shiftsTotal: shiftCount.rows[0].c,
          shiftsFuture: futureShiftCount.rows[0].c,
          workLogs: workLogCount.rows[0].c,
          shiftApplications: applicationCount.rows[0].c,
        },
      }
    }

    // 4) pokud byl zadán bizName, dej kompletní kontext nalezených biznisů
    const businessesContext = await Promise.all(businesses.map(async (b) => {
      const managers = await client.query(
        `SELECT id, name, email, role FROM "User" WHERE business_id = $1 AND role = 'manager' ORDER BY name`,
        [b.id]
      )
      const employees = await client.query(
        `SELECT id, name, email, role FROM "User" WHERE business_id = $1 AND role = 'employee' ORDER BY name`,
        [b.id]
      )
      const branches = await client.query(
        `SELECT id, name, address FROM "Branch" WHERE business_id = $1 ORDER BY created_at`,
        [b.id]
      )
      return {
        business: b,
        managers: managers.rows,
        employees: employees.rows,
        branches: branches.rows,
      }
    }))

    return NextResponse.json({
      now: new Date().toISOString(),
      query: { email: email ?? null, bizName: bizName ?? null },
      userContext,
      businessesContext,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } finally {
    client.release()
  }
}
