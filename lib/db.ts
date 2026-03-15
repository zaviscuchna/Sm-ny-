/**
 * Client-side data access layer.
 * Demo businesses (biz-1, biz-2, biz-3) → mock-data.ts
 * Registered businesses (biz-reg-*) → API routes → Prisma → PostgreSQL
 */

import {
  SHIFTS, EMPLOYEES, EMPLOYEES_B2, EMPLOYEES_B3,
  SHIFTS_B2, SHIFTS_B3,
} from './mock-data'
import type { User, Business, Shift } from '@/types'
import type { WorkLog } from './work-logs'

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isRegistered(bizId: string): boolean {
  return bizId.startsWith('biz-reg-')
}

function mockShifts(bizId: string): Shift[] {
  if (bizId === 'biz-1') return SHIFTS
  if (bizId === 'biz-2') return SHIFTS_B2
  if (bizId === 'biz-3') return SHIFTS_B3
  return SHIFTS
}

function mockEmployees(bizId: string): User[] {
  if (bizId === 'biz-1') return EMPLOYEES
  if (bizId === 'biz-2') return EMPLOYEES_B2
  if (bizId === 'biz-3') return EMPLOYEES_B3
  return EMPLOYEES
}

// ─── Employees ────────────────────────────────────────────────────────────────

export async function getEmployeesForBusiness(bizId: string): Promise<User[]> {
  if (!isRegistered(bizId)) return mockEmployees(bizId)
  const res = await fetch(`/api/employees?bizId=${bizId}`)
  if (!res.ok) return []
  return res.json()
}

// ─── Shifts ───────────────────────────────────────────────────────────────────

export async function getShiftsForBusiness(bizId: string): Promise<Shift[]> {
  if (!isRegistered(bizId)) return mockShifts(bizId)
  const res = await fetch(`/api/shifts?bizId=${bizId}`)
  if (!res.ok) return []
  return res.json()
}

export async function createShiftsInDB(
  shifts: Array<Omit<Shift, 'assignedEmployee'> & { assignedEmployeeId?: string }>,
): Promise<void> {
  const res = await fetch('/api/shifts', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ shifts }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Chyba při ukládání směn')
  }
}

// ─── Work Logs ────────────────────────────────────────────────────────────────

export async function getLogsForEmployee(employeeId: string, bizId: string): Promise<WorkLog[]> {
  if (!isRegistered(bizId)) {
    const { getEmployeeLogs } = await import('./work-logs')
    return getEmployeeLogs(employeeId)
  }
  const res = await fetch(`/api/work-logs?bizId=${bizId}&employeeId=${employeeId}`)
  if (!res.ok) return []
  return res.json()
}

export async function getLogsForBusiness(bizId: string, yearMonth: string): Promise<WorkLog[]> {
  if (!isRegistered(bizId)) {
    const { getAllMonthLogs } = await import('./work-logs')
    return getAllMonthLogs(yearMonth)
  }
  const res = await fetch(`/api/work-logs?bizId=${bizId}&month=${yearMonth}`)
  if (!res.ok) return []
  return res.json()
}

export async function saveLogToDB(log: Omit<WorkLog, 'id' | 'hours'>, bizId: string): Promise<WorkLog> {
  if (!isRegistered(bizId)) {
    const { saveWorkLog } = await import('./work-logs')
    return saveWorkLog(log)
  }
  const res = await fetch('/api/work-logs', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ log, bizId }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Chyba při ukládání záznamu')
  }
  return res.json()
}

export async function deleteLogFromDB(id: string, bizId: string): Promise<void> {
  if (!isRegistered(bizId)) {
    const { deleteWorkLog } = await import('./work-logs')
    deleteWorkLog(id)
    return
  }
  await fetch(`/api/work-logs?id=${id}`, { method: 'DELETE' })
}

// ─── Businesses (used by AuthContext) ─────────────────────────────────────────

export async function dbCreateBusiness(
  name: string,
  location: string,
): Promise<{ business: Business; joinCode: string }> {
  // Handled via /api/auth/register — not called directly
  throw new Error('Use /api/auth/register instead')
}

export async function dbGetBusinessByJoinCode(
  code: string,
): Promise<{ business: Business; joinCode: string } | null> {
  // Called from register page — goes through /api/auth/register
  // Kept for compatibility
  return null
}

export async function dbGetBusiness(
  id: string,
): Promise<{ business: Business; joinCode: string } | null> {
  // Not needed anymore — login API returns business with joinCode
  return null
}

export async function dbGetUserByEmail(
  email: string,
): Promise<(User & { businessId?: string }) | null> {
  // Not needed anymore — login API returns user directly
  return null
}

export async function dbCreateUser(_opts: {
  id: string
  name: string
  email: string
  role: string
  businessId: string
  color: string
}): Promise<void> {
  // Not needed anymore — register API handles user creation
}
