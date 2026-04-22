/**
 * Client-side data access layer.
 * Demo businesses (biz-1, biz-2, biz-3) → mock-data.ts
 * Registered businesses (biz-reg-*) → API routes → Prisma → PostgreSQL
 */

import {
  SHIFTS, EMPLOYEES, EMPLOYEES_B2, EMPLOYEES_B3,
  SHIFTS_B2, SHIFTS_B3,
} from './mock-data'
import type { User, Business, Shift, Branch, EmployeeBranch, Permission } from '@/types'
import type { WorkLog } from './work-logs'

async function safeArray<T>(url: string): Promise<T[]> {
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json().catch(() => null)
    return Array.isArray(data) ? (data as T[]) : []
  } catch { return [] }
}

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
  return safeArray<User>(`/api/employees?bizId=${bizId}`)
}

// ─── Shifts ───────────────────────────────────────────────────────────────────

export async function getShiftsForBusiness(bizId: string, branchId?: string | null): Promise<Shift[]> {
  if (!isRegistered(bizId)) {
    const all = mockShifts(bizId)
    return branchId ? all.filter(s => s.branchId === branchId) : all
  }
  const q = new URLSearchParams({ bizId })
  if (branchId) q.set('branchId', branchId)
  return safeArray<Shift>(`/api/shifts?${q}`)
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
  return safeArray<WorkLog>(`/api/work-logs?bizId=${bizId}&employeeId=${employeeId}`)
}

export async function getLogsForBusiness(bizId: string, yearMonth: string): Promise<WorkLog[]> {
  if (!isRegistered(bizId)) {
    const { getAllMonthLogs } = await import('./work-logs')
    return getAllMonthLogs(yearMonth)
  }
  return safeArray<WorkLog>(`/api/work-logs?bizId=${bizId}&month=${yearMonth}`)
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

// ─── Branches ────────────────────────────────────────────────────────────────

export async function getBranchesForBusiness(bizId: string): Promise<Branch[]> {
  if (!isRegistered(bizId)) return []
  return safeArray<Branch>(`/api/branches?bizId=${bizId}`)
}

export async function createBranch(bizId: string, name: string, address?: string): Promise<Branch> {
  const res = await fetch('/api/branches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bizId, name, address }),
  })
  if (!res.ok) throw new Error('Chyba při vytváření pobočky')
  return res.json()
}

export async function deleteBranch(id: string): Promise<void> {
  await fetch(`/api/branches?id=${id}`, { method: 'DELETE' })
}

// ─── Employee Branches / Permissions ─────────────────────────────────────────

export async function getEmployeeBranches(params: { branchId?: string; userId?: string; bizId?: string }): Promise<EmployeeBranch[]> {
  const query = new URLSearchParams()
  if (params.branchId) query.set('branchId', params.branchId)
  if (params.userId) query.set('userId', params.userId)
  if (params.bizId) query.set('bizId', params.bizId)
  return safeArray<EmployeeBranch>(`/api/employee-branches?${query}`)
}

export async function assignEmployeeToBranch(userId: string, branchId: string, role?: string, permissions?: Permission[]): Promise<void> {
  await fetch('/api/employee-branches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, branchId, role, permissions }),
  })
}

export async function updateEmployeePermissions(id: string, permissions: Permission[]): Promise<void> {
  await fetch('/api/employee-branches', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, permissions }),
  })
}

export async function removeEmployeeFromBranch(id: string): Promise<void> {
  await fetch(`/api/employee-branches?id=${id}`, { method: 'DELETE' })
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
