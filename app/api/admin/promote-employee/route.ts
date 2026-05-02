import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'

// Povýší existujícího zaměstnance (User.role='employee') na manažera (User.role='manager')
// V STEJNÉM biznisu — žádný přesun, žádný nový účet.
// Pro každou pobočku biznisu vytvoří/upgradne EmployeeBranch s role='manager' + plné permissions.
//
// VŠE V TRANSAKCI — při jakékoliv chybě ROLLBACK.
// Žádné DELETE, žádný update jiného sloupce než User.role.
// Žádný zásah do Shift, WorkLog, ClockSession, ShiftApplication.
//
// POST /api/admin/promote-employee
//   ?secret=ksh-init-2026
//   body: { userId: string, bizId: string, dry?: boolean }
//
// Pokud dry=true → vše proběhne v transakci a pak se ROLLBACK (preview).

const ALL_PERMISSIONS = [
  'ASSIGN_SHIFTS',
  'MANAGE_OPEN_SHIFTS',
  'VIEW_TEAM',
  'VIEW_ALL_HOURS',
  'APPROVE_REQUESTS',
]

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== 'ksh-init-2026') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body.userId !== 'string' || typeof body.bizId !== 'string') {
    return NextResponse.json({ error: 'Body must be { userId, bizId, dry? }' }, { status: 400 })
  }
  const userId: string = body.userId
  const bizId: string = body.bizId
  const dry: boolean = !!body.dry

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1) Zamči řádek usera (FOR UPDATE) a načti aktuální stav
    const userRes = await client.query(
      `SELECT id, name, email, role, business_id, color, phone
       FROM "User"
       WHERE id = $1
       FOR UPDATE`,
      [userId]
    )
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'User not found', userId }, { status: 404 })
    }
    const userBefore = userRes.rows[0]

    // 2) Hard validace — user musí být ve specifikovaném bizu
    if (userBefore.business_id !== bizId) {
      await client.query('ROLLBACK')
      return NextResponse.json({
        error: 'User is in a different business than requested — refusing to modify',
        expectedBizId: bizId,
        actualBizId: userBefore.business_id,
      }, { status: 409 })
    }

    // 3) Hard validace — biznis existuje
    const bizRes = await client.query(
      `SELECT id, name, location FROM "Business" WHERE id = $1`,
      [bizId]
    )
    if (bizRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Business not found', bizId }, { status: 404 })
    }
    const business = bizRes.rows[0]

    // 4) Soft validace — pokud už je manager, neprováděj povýšení znovu (idempotence)
    const wasAlreadyManager = userBefore.role === 'manager'
    if (userBefore.role !== 'employee' && userBefore.role !== 'manager') {
      await client.query('ROLLBACK')
      return NextResponse.json({
        error: 'User has unexpected role — refusing to modify',
        actualRole: userBefore.role,
      }, { status: 409 })
    }

    // 5) Načti pobočky biznisu
    const branchesRes = await client.query(
      `SELECT id, name, address FROM "Branch" WHERE business_id = $1 ORDER BY created_at`,
      [bizId]
    )
    const branches = branchesRes.rows

    // 6) Načti existující EmployeeBranch pro tohoto usera (před změnou)
    const ebBeforeRes = await client.query(
      `SELECT eb.id, eb.branch_id, eb.role, eb.permissions, b.name as branch_name
       FROM "EmployeeBranch" eb
       JOIN "Branch" b ON b.id = eb.branch_id
       WHERE eb.user_id = $1 AND b.business_id = $2`,
      [userId, bizId]
    )
    const ebBefore = ebBeforeRes.rows

    // ── PROVEDENÍ ZMĚN ──────────────────────────────────────────────────────

    // 7) Povýšení User.role (jen pokud ještě není manager)
    let userPromoted = false
    if (!wasAlreadyManager) {
      const upd = await client.query(
        `UPDATE "User"
         SET role = 'manager'
         WHERE id = $1 AND business_id = $2 AND role = 'employee'
         RETURNING id, role`,
        [userId, bizId]
      )
      if (upd.rowCount !== 1) {
        await client.query('ROLLBACK')
        return NextResponse.json({
          error: 'UPDATE did not affect exactly 1 row — refusing',
          rowCount: upd.rowCount,
        }, { status: 500 })
      }
      userPromoted = true
    }

    // 8) Pro každou pobočku: INSERT EmployeeBranch s role=manager + plné permissions
    //    (ON CONFLICT — pokud už existuje, upgradne na manager + plné permissions)
    const branchOps: Record<string, unknown>[] = []
    for (let i = 0; i < branches.length; i++) {
      const br = branches[i]
      const newId = `eb-promote-${Date.now()}-${i}`
      const r = await client.query(
        `INSERT INTO "EmployeeBranch" (id, user_id, branch_id, role, permissions)
         VALUES ($1, $2, $3, 'manager', $4)
         ON CONFLICT (user_id, branch_id) DO UPDATE
           SET role = 'manager', permissions = EXCLUDED.permissions
         RETURNING id, role, permissions, (xmax = 0) AS inserted`,
        [newId, userId, br.id, ALL_PERMISSIONS]
      )
      branchOps.push({
        branchId: br.id,
        branchName: br.name,
        ebId: r.rows[0].id,
        action: r.rows[0].inserted ? 'inserted' : 'updated',
        role: r.rows[0].role,
        permissions: r.rows[0].permissions,
      })
    }

    // 9) Načti finální stav po změnách (pro audit)
    const userAfterRes = await client.query(
      `SELECT id, name, email, role, business_id, color, phone FROM "User" WHERE id = $1`,
      [userId]
    )
    const ebAfterRes = await client.query(
      `SELECT eb.id, eb.branch_id, eb.role, eb.permissions, b.name as branch_name
       FROM "EmployeeBranch" eb
       JOIN "Branch" b ON b.id = eb.branch_id
       WHERE eb.user_id = $1 AND b.business_id = $2`,
      [userId, bizId]
    )

    // 10) Sanity check — počty směn/worklogs se NESMĚLY změnit
    const shiftCount = await client.query(
      `SELECT COUNT(*)::int AS c FROM "Shift" WHERE assigned_employee_id = $1`,
      [userId]
    )
    const workLogCount = await client.query(
      `SELECT COUNT(*)::int AS c FROM "WorkLog" WHERE employee_id = $1`,
      [userId]
    )
    const applicationCount = await client.query(
      `SELECT COUNT(*)::int AS c FROM "ShiftApplication" WHERE employee_id = $1`,
      [userId]
    )

    // 11) Commit nebo rollback (dry-run)
    if (dry) {
      await client.query('ROLLBACK')
    } else {
      await client.query('COMMIT')
    }

    return NextResponse.json({
      ok: true,
      dry,
      committed: !dry,
      business,
      before: {
        user: userBefore,
        employeeBranches: ebBefore,
      },
      after: {
        user: userAfterRes.rows[0],
        employeeBranches: ebAfterRes.rows,
      },
      changes: {
        userPromoted,
        wasAlreadyManager,
        branchOps,
      },
      preserved: {
        shiftsAssigned: shiftCount.rows[0].c,
        workLogs: workLogCount.rows[0].c,
        shiftApplications: applicationCount.rows[0].c,
      },
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e: unknown) {
    try { await client.query('ROLLBACK') } catch {}
    console.error('[promote-employee] error:', e)
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Internal error', message }, { status: 500 })
  } finally {
    client.release()
  }
}
