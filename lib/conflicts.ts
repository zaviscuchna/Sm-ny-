import type { PoolClient } from 'pg'

export interface ShiftConflict {
  id: string
  date: string
  startTime: string
  endTime: string
  branchName: string | null
}

/**
 * Zjistí, zda přiřazení zaměstnance na zadaný čas/den koliduje s jinou
 * jeho směnou (napříč pobočkami v rámci stejného business_id).
 *
 * Overlap logika: nová směna (start, end) se překrývá s existující (a, b), když
 *   start < b AND end > a.
 *
 * @param excludeShiftId — id směny, kterou právě upravujeme (aby se sama nezapočítala)
 */
export async function findShiftConflict(
  client: PoolClient,
  params: {
    employeeId: string
    businessId: string
    date: string
    startTime: string
    endTime: string
    excludeShiftId?: string | null
  },
): Promise<ShiftConflict | null> {
  const { employeeId, businessId, date, startTime, endTime, excludeShiftId } = params

  const q = `
    SELECT s.id, s.date, s.start_time, s.end_time, b.name AS branch_name
    FROM "Shift" s
    LEFT JOIN "Branch" b ON b.id = s.branch_id
    WHERE s.assigned_employee_id = $1
      AND s.business_id = $2
      AND s.date = $3
      AND s.start_time < $5
      AND s.end_time > $4
      ${excludeShiftId ? 'AND s.id != $6' : ''}
    LIMIT 1
  `
  const vals: any[] = [employeeId, businessId, date, startTime, endTime]
  if (excludeShiftId) vals.push(excludeShiftId)

  const { rows } = await client.query(q, vals)
  if (rows.length === 0) return null
  const r = rows[0]
  return {
    id: r.id,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    branchName: r.branch_name ?? null,
  }
}

export function formatConflictMessage(c: ShiftConflict, employeeName?: string): string {
  const who = employeeName ? `${employeeName} má` : 'Má'
  const where = c.branchName ? ` v pobočce ${c.branchName}` : ''
  return `${who} už směnu ${c.startTime}–${c.endTime}${where} ve stejný den.`
}
