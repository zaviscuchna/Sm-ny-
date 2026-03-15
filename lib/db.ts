/**
 * Unified data-access layer.
 * Demo businesses (biz-1, biz-2, biz-3) → mock-data.ts
 * Registered businesses (biz-reg-*) → Supabase
 */

import { supabase } from './supabase'
import {
  SHIFTS, EMPLOYEES, EMPLOYEES_B2, EMPLOYEES_B3,
  SHIFTS_B2, SHIFTS_B3, getDayCoverage,
} from './mock-data'
import type { User, Business, Shift } from '@/types'
import type { WorkLog } from './work-logs'

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isRegistered(bizId: string): boolean {
  return bizId.startsWith('biz-reg-')
}

function calcHours(clockIn: string, clockOut: string): number {
  const [ih, im] = clockIn.split(':').map(Number)
  const [oh, om] = clockOut.split(':').map(Number)
  return Math.round(((oh + om / 60) - (ih + im / 60)) * 10) / 10
}

function rowToShift(row: any, employee?: User | null): Shift {
  return {
    id:               row.id,
    businessId:       row.business_id,
    date:             row.date,
    startTime:        row.start_time,
    endTime:          row.end_time,
    roleNeeded:       row.role_needed,
    status:           row.status,
    notes:            row.notes ?? undefined,
    assignedEmployee: employee ?? undefined,
  }
}

function rowToUser(row: any): User {
  return {
    id:    row.id,
    name:  row.name,
    email: row.email,
    role:  row.role,
    color: row.color,
    phone: row.phone ?? undefined,
  }
}

function rowToLog(row: any): WorkLog {
  return {
    id:           row.id,
    employeeId:   row.employee_id,
    employeeName: row.employee_name,
    date:         row.date,
    clockIn:      row.clock_in,
    clockOut:     row.clock_out,
    hours:        parseFloat(row.hours),
    notes:        row.notes ?? undefined,
  }
}

// ─── Mock helpers per business ────────────────────────────────────────────────

function mockShifts(bizId: string): Shift[] {
  if (bizId === 'biz-1') return SHIFTS
  if (bizId === 'biz-2') return SHIFTS_B2
  if (bizId === 'biz-3') return SHIFTS_B3
  return SHIFTS // fallback
}

function mockEmployees(bizId: string): User[] {
  if (bizId === 'biz-1') return EMPLOYEES
  if (bizId === 'biz-2') return EMPLOYEES_B2
  if (bizId === 'biz-3') return EMPLOYEES_B3
  return EMPLOYEES
}

// ─── Businesses ───────────────────────────────────────────────────────────────

export async function dbCreateBusiness(
  name: string,
  location: string,
): Promise<{ business: Business; joinCode: string }> {
  const id       = `biz-reg-${Date.now()}`
  const joinCode = String(Math.floor(100000 + Math.random() * 900000))

  const { error } = await supabase
    .from('businesses')
    .insert({ id, name, location, join_code: joinCode })

  if (error) throw new Error(error.message)
  return { business: { id, name, location }, joinCode }
}

export async function dbGetBusinessByJoinCode(
  code: string,
): Promise<{ business: Business; joinCode: string } | null> {
  const { data, error } = await supabase
    .from('businesses')
    .select()
    .eq('join_code', code.trim())
    .maybeSingle()

  if (error || !data) return null
  return {
    business: { id: data.id, name: data.name, location: data.location },
    joinCode: data.join_code,
  }
}

export async function dbGetBusiness(
  id: string,
): Promise<{ business: Business; joinCode: string } | null> {
  const { data, error } = await supabase
    .from('businesses')
    .select()
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null
  return {
    business: { id: data.id, name: data.name, location: data.location },
    joinCode: data.join_code,
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function dbCreateUser(opts: {
  id: string
  name: string
  email: string
  role: string
  businessId: string
  color: string
}): Promise<void> {
  const { error } = await supabase.from('users').insert({
    id:          opts.id,
    name:        opts.name,
    email:       opts.email.toLowerCase(),
    role:        opts.role,
    business_id: opts.businessId,
    color:       opts.color,
  })
  if (error) throw new Error(error.message)
}

export async function dbGetUserByEmail(
  email: string,
): Promise<(User & { businessId?: string }) | null> {
  const { data, error } = await supabase
    .from('users')
    .select()
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (error || !data) return null
  return { ...rowToUser(data), businessId: data.business_id ?? undefined }
}

// ─── Employees per business ───────────────────────────────────────────────────

export async function getEmployeesForBusiness(bizId: string): Promise<User[]> {
  if (!isRegistered(bizId)) return mockEmployees(bizId)

  const { data, error } = await supabase
    .from('users')
    .select()
    .eq('business_id', bizId)
    .order('name')

  if (error || !data) return []
  return data.map(rowToUser)
}

// ─── Shifts ───────────────────────────────────────────────────────────────────

export async function getShiftsForBusiness(bizId: string): Promise<Shift[]> {
  if (!isRegistered(bizId)) return mockShifts(bizId)

  // Fetch shifts + all employees for this business
  const [{ data: shiftRows, error }, { data: empRows }] = await Promise.all([
    supabase.from('shifts').select().eq('business_id', bizId).order('date'),
    supabase.from('users').select().eq('business_id', bizId),
  ])

  if (error || !shiftRows) return []

  const empMap: Record<string, User> = {}
  for (const e of empRows ?? []) empMap[e.id] = rowToUser(e)

  return shiftRows.map(row =>
    rowToShift(row, row.assigned_employee_id ? empMap[row.assigned_employee_id] : null),
  )
}

export async function createShiftsInDB(
  shifts: Array<Omit<Shift, 'assignedEmployee'> & { assignedEmployeeId?: string }>,
): Promise<void> {
  const rows = shifts.map(s => ({
    id:                   s.id,
    business_id:          s.businessId,
    date:                 s.date,
    start_time:           s.startTime,
    end_time:             s.endTime,
    role_needed:          s.roleNeeded,
    assigned_employee_id: s.assignedEmployeeId ?? null,
    status:               s.status,
    notes:                s.notes ?? null,
  }))

  const { error } = await supabase.from('shifts').insert(rows)
  if (error) throw new Error(error.message)
}

// ─── Work Logs ────────────────────────────────────────────────────────────────

export async function getLogsForEmployee(
  employeeId: string,
  bizId: string,
): Promise<WorkLog[]> {
  if (!isRegistered(bizId)) {
    // Fall back to localStorage
    const { getEmployeeLogs } = await import('./work-logs')
    return getEmployeeLogs(employeeId)
  }

  const { data, error } = await supabase
    .from('work_logs')
    .select()
    .eq('employee_id', employeeId)
    .eq('business_id', bizId)
    .order('date', { ascending: false })

  if (error || !data) return []
  return data.map(rowToLog)
}

export async function getLogsForBusiness(
  bizId: string,
  yearMonth: string,
): Promise<WorkLog[]> {
  if (!isRegistered(bizId)) {
    const { getAllMonthLogs } = await import('./work-logs')
    return getAllMonthLogs(yearMonth)
  }

  // month range e.g. "2026-03" → 2026-03-01 to 2026-04-01
  const [y, m] = yearMonth.split('-').map(Number)
  const nextM   = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('work_logs')
    .select()
    .eq('business_id', bizId)
    .gte('date', `${yearMonth}-01`)
    .lt('date', `${nextM}-01`)
    .order('date', { ascending: false })

  if (error || !data) return []
  return data.map(rowToLog)
}

export async function saveLogToDB(
  log: Omit<WorkLog, 'id' | 'hours'>,
  bizId: string,
): Promise<WorkLog> {
  if (!isRegistered(bizId)) {
    const { saveWorkLog } = await import('./work-logs')
    return saveWorkLog(log)
  }

  const id    = `wl-${Date.now()}`
  const hours = calcHours(log.clockIn, log.clockOut)

  const { error } = await supabase.from('work_logs').insert({
    id,
    employee_id:   log.employeeId,
    employee_name: log.employeeName,
    business_id:   bizId,
    date:          log.date,
    clock_in:      log.clockIn,
    clock_out:     log.clockOut,
    hours,
    notes:         log.notes ?? null,
  })

  if (error) throw new Error(error.message)
  return { id, hours, ...log }
}

export async function deleteLogFromDB(id: string, bizId: string): Promise<void> {
  if (!isRegistered(bizId)) {
    const { deleteWorkLog } = await import('./work-logs')
    deleteWorkLog(id)
    return
  }
  const { error } = await supabase.from('work_logs').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
