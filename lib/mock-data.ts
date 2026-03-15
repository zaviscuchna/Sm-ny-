import { addDays, format, startOfWeek } from 'date-fns'
import type { User, Business, Shift, ShiftApplication, TimeOffRequest, BusinessStats } from '@/types'

// ─── Businesses ────────────────────────────────────────────────────────────────

export const BUSINESSES: Business[] = [
  { id: 'biz-1', name: 'Kavárna Aroma',  location: 'Mánesova 12, Praha 2' },
  { id: 'biz-2', name: 'Bistro Mango',   location: 'Dejvická 8, Praha 6'  },
  { id: 'biz-3', name: 'Kavárna Neon',   location: 'Náměstí Svobody 5, Brno' },
]

/** Backward-compat alias */
export const BUSINESS = BUSINESSES[0]

// ─── Users ─────────────────────────────────────────────────────────────────────

export const SUPER_ADMIN: User = {
  id: 'u-sa',
  name: 'Admin',
  email: 'admin@demo.cz',
  role: 'superadmin',
  phone: '+420 777 000 001',
  color: '#0f172a',
}

export const DEV_USER: User = {
  id: 'u-dev',
  name: 'Záviš Čuchna',
  email: 'dev@ksh.cz',
  role: 'superadmin',
  phone: '+420 777 000 000',
  color: '#6366f1',
}

// — Kavárna Aroma (biz-1)
export const MANAGER: User = {
  id: 'u-0',
  name: 'Jan Novák',
  email: 'manager@demo.cz',
  role: 'manager',
  phone: '+420 602 111 222',
  color: '#6366f1',
}

export const EMPLOYEES: User[] = [
  { id: 'u-1', name: 'Tereza Marková',   email: 'tereza@demo.cz',  role: 'employee', phone: '+420 601 111 001', color: '#f59e0b' },
  { id: 'u-2', name: 'Lukáš Dvořák',    email: 'lukas@demo.cz',   role: 'employee', phone: '+420 601 111 002', color: '#10b981' },
  { id: 'u-3', name: 'Barbora Horáková', email: 'bara@demo.cz',    role: 'employee', phone: '+420 601 111 003', color: '#ec4899' },
  { id: 'u-4', name: 'Marek Procházka', email: 'marek@demo.cz',   role: 'employee', phone: '+420 601 111 004', color: '#3b82f6' },
  { id: 'u-5', name: 'Aneta Čechová',   email: 'aneta@demo.cz',   role: 'employee', phone: '+420 601 111 005', color: '#8b5cf6' },
  { id: 'u-6', name: 'Ondřej Šimánek',  email: 'ondrej@demo.cz',  role: 'employee', phone: '+420 601 111 006', color: '#14b8a6' },
]

// — Bistro Mango (biz-2)
export const MANAGER_B2: User = {
  id: 'u-m2',
  name: 'Marie Horáková',
  email: 'mango@demo.cz',
  role: 'manager',
  phone: '+420 602 222 333',
  color: '#f97316',
}

export const EMPLOYEES_B2: User[] = [
  { id: 'u-b2-1', name: 'Radka Kyselová',  email: 'radka@demo.cz',  role: 'employee', color: '#f97316' },
  { id: 'u-b2-2', name: 'Pavel Klíma',     email: 'pavel@demo.cz',  role: 'employee', color: '#06b6d4' },
  { id: 'u-b2-3', name: 'Jana Červenková', email: 'jana2@demo.cz',  role: 'employee', color: '#84cc16' },
  { id: 'u-b2-4', name: 'Tomáš Vlček',    email: 'tomas2@demo.cz', role: 'employee', color: '#a855f7' },
]

// — Kavárna Neon (biz-3)
export const MANAGER_B3: User = {
  id: 'u-m3',
  name: 'Petr Beneš',
  email: 'neon@demo.cz',
  role: 'manager',
  phone: '+420 602 333 444',
  color: '#0ea5e9',
}

export const EMPLOYEES_B3: User[] = [
  { id: 'u-b3-1', name: 'Simona Pokorná', email: 'simona@demo.cz',  role: 'employee', color: '#f43f5e' },
  { id: 'u-b3-2', name: 'Jakub Novotný',  email: 'jakub2@demo.cz', role: 'employee', color: '#22d3ee' },
  { id: 'u-b3-3', name: 'Kateřina Malá',  email: 'katka@demo.cz',  role: 'employee', color: '#fbbf24' },
  { id: 'u-b3-4', name: 'Vojtěch Král',   email: 'vojta@demo.cz',  role: 'employee', color: '#4ade80' },
  { id: 'u-b3-5', name: 'Lenka Dušková',  email: 'lenka@demo.cz',  role: 'employee', color: '#818cf8' },
]

export const ALL_USERS: User[] = [
  SUPER_ADMIN,
  DEV_USER,
  MANAGER, ...EMPLOYEES,
  MANAGER_B2, ...EMPLOYEES_B2,
  MANAGER_B3, ...EMPLOYEES_B3,
]

// ─── Shifts helpers ────────────────────────────────────────────────────────────

function getWeekStart(offset = 0): Date {
  const today = new Date()
  const monday = startOfWeek(today, { weekStartsOn: 1 })
  return addDays(monday, offset * 7)
}

function makeShift(
  id: string,
  bizId: string,
  dateOffset: number,
  start: string,
  end: string,
  role: string,
  employee: User | undefined,
  status: Shift['status'],
  notes?: string
): Shift {
  const date = format(addDays(getWeekStart(), dateOffset), 'yyyy-MM-dd')
  return { id, businessId: bizId, date, startTime: start, endTime: end, roleNeeded: role, assignedEmployee: employee, status, notes }
}

// ─── Kavárna Aroma shifts (biz-1) ──────────────────────────────────────────────

export const SHIFTS: Shift[] = [
  makeShift('s-01', 'biz-1', 0, '07:00', '15:00', 'Baristka',     EMPLOYEES[0], 'confirmed'),
  makeShift('s-02', 'biz-1', 0, '13:00', '21:00', 'Obsluha',      EMPLOYEES[3], 'assigned'),
  makeShift('s-03', 'biz-1', 0, '07:00', '15:00', 'Pomocná síla', undefined,    'open'),

  makeShift('s-04', 'biz-1', 1, '07:00', '15:00', 'Baristka',     EMPLOYEES[2], 'confirmed'),
  makeShift('s-05', 'biz-1', 1, '15:00', '21:00', 'Obsluha',      EMPLOYEES[1], 'assigned'),

  makeShift('s-06', 'biz-1', 2, '07:00', '15:00', 'Baristka',     EMPLOYEES[4], 'assigned'),
  makeShift('s-07', 'biz-1', 2, '13:00', '21:00', 'Obsluha',      undefined,    'open'),
  makeShift('s-08', 'biz-1', 2, '07:00', '13:00', 'Pomocná síla', EMPLOYEES[5], 'pending'),

  makeShift('s-09', 'biz-1', 3, '07:00', '15:00', 'Baristka',     EMPLOYEES[0], 'assigned'),
  makeShift('s-10', 'biz-1', 3, '15:00', '21:00', 'Obsluha',      EMPLOYEES[2], 'assigned'),
  makeShift('s-11', 'biz-1', 3, '07:00', '15:00', 'Pomocná síla', undefined,    'open'),

  makeShift('s-12', 'biz-1', 4, '07:00', '15:00', 'Baristka',     EMPLOYEES[1], 'confirmed'),
  makeShift('s-13', 'biz-1', 4, '13:00', '21:00', 'Obsluha',      EMPLOYEES[3], 'assigned'),
  makeShift('s-14', 'biz-1', 4, '07:00', '15:00', 'Pomocná síla', EMPLOYEES[5], 'assigned'),

  makeShift('s-15', 'biz-1', 5, '08:00', '16:00', 'Baristka',     EMPLOYEES[4], 'assigned'),
  makeShift('s-16', 'biz-1', 5, '12:00', '20:00', 'Obsluha',      undefined,    'open'),

  makeShift('s-17', 'biz-1', 6, '09:00', '17:00', 'Baristka',     undefined,    'open'),
  makeShift('s-18', 'biz-1', 6, '09:00', '17:00', 'Obsluha',      EMPLOYEES[2], 'assigned'),

  makeShift('s-19', 'biz-1', 7, '07:00', '15:00', 'Baristka',     EMPLOYEES[0], 'assigned'),
  makeShift('s-20', 'biz-1', 7, '13:00', '21:00', 'Obsluha',      undefined,    'open'),
]

export const OPEN_SHIFTS = SHIFTS.filter(s => s.status === 'open')

// ─── Bistro Mango shifts (biz-2) ───────────────────────────────────────────────

export const SHIFTS_B2: Shift[] = [
  makeShift('b2-01', 'biz-2', 0, '08:00', '16:00', 'Obsluha',      EMPLOYEES_B2[0], 'confirmed'),
  makeShift('b2-02', 'biz-2', 0, '12:00', '20:00', 'Obsluha',      undefined,        'open'),
  makeShift('b2-03', 'biz-2', 1, '08:00', '16:00', 'Kuchař',       EMPLOYEES_B2[1], 'assigned'),
  makeShift('b2-04', 'biz-2', 2, '08:00', '16:00', 'Obsluha',      EMPLOYEES_B2[2], 'confirmed'),
  makeShift('b2-05', 'biz-2', 3, '12:00', '20:00', 'Kuchař',       undefined,        'open'),
  makeShift('b2-06', 'biz-2', 4, '08:00', '16:00', 'Obsluha',      EMPLOYEES_B2[3], 'assigned'),
  makeShift('b2-07', 'biz-2', 5, '10:00', '18:00', 'Obsluha',      EMPLOYEES_B2[0], 'assigned'),
  makeShift('b2-08', 'biz-2', 6, '10:00', '18:00', 'Kuchař',       undefined,        'open'),
]

// ─── Kavárna Neon shifts (biz-3) ───────────────────────────────────────────────

export const SHIFTS_B3: Shift[] = [
  makeShift('b3-01', 'biz-3', 0, '07:00', '15:00', 'Barista',      EMPLOYEES_B3[0], 'confirmed'),
  makeShift('b3-02', 'biz-3', 0, '15:00', '22:00', 'Barista',      EMPLOYEES_B3[1], 'confirmed'),
  makeShift('b3-03', 'biz-3', 1, '07:00', '15:00', 'Obsluha',      EMPLOYEES_B3[2], 'assigned'),
  makeShift('b3-04', 'biz-3', 2, '07:00', '15:00', 'Barista',      undefined,        'open'),
  makeShift('b3-05', 'biz-3', 2, '15:00', '22:00', 'Barista',      EMPLOYEES_B3[3], 'assigned'),
  makeShift('b3-06', 'biz-3', 3, '07:00', '15:00', 'Obsluha',      EMPLOYEES_B3[4], 'confirmed'),
  makeShift('b3-07', 'biz-3', 4, '07:00', '15:00', 'Barista',      EMPLOYEES_B3[0], 'assigned'),
  makeShift('b3-08', 'biz-3', 4, '15:00', '22:00', 'Barista',      undefined,        'open'),
  makeShift('b3-09', 'biz-3', 5, '10:00', '18:00', 'Obsluha',      EMPLOYEES_B3[1], 'assigned'),
  makeShift('b3-10', 'biz-3', 6, '10:00', '18:00', 'Barista',      undefined,        'open'),
]

// ─── All shifts combined ───────────────────────────────────────────────────────

export const ALL_SHIFTS = [...SHIFTS, ...SHIFTS_B2, ...SHIFTS_B3]

// ─── Applications & Time Off ───────────────────────────────────────────────────

export const SHIFT_APPLICATIONS: ShiftApplication[] = [
  {
    id: 'app-1',
    shift: SHIFTS.find(s => s.id === 's-03')!,
    employee: EMPLOYEES[1],
    status: 'pending',
    createdAt: format(new Date(), 'yyyy-MM-dd'),
  },
  {
    id: 'app-2',
    shift: SHIFTS.find(s => s.id === 's-07')!,
    employee: EMPLOYEES[4],
    status: 'pending',
    createdAt: format(addDays(new Date(), -1), 'yyyy-MM-dd'),
  },
  {
    id: 'app-3',
    shift: SHIFTS.find(s => s.id === 's-16')!,
    employee: EMPLOYEES[5],
    status: 'approved',
    createdAt: format(addDays(new Date(), -2), 'yyyy-MM-dd'),
  },
]

export const TIME_OFF_REQUESTS: TimeOffRequest[] = [
  {
    id: 'to-1',
    employee: EMPLOYEES[0],
    startDate: format(addDays(new Date(), 5), 'yyyy-MM-dd'),
    endDate:   format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    reason: 'Rodinná akce',
    status: 'pending',
    createdAt: format(addDays(new Date(), -1), 'yyyy-MM-dd'),
  },
  {
    id: 'to-2',
    employee: EMPLOYEES[3],
    startDate: format(addDays(new Date(), 10), 'yyyy-MM-dd'),
    endDate:   format(addDays(new Date(), 12), 'yyyy-MM-dd'),
    reason: 'Dovolená',
    status: 'approved',
    createdAt: format(addDays(new Date(), -3), 'yyyy-MM-dd'),
  },
]

// ─── Helper functions ──────────────────────────────────────────────────────────

export function getEmployeeShifts(employeeId: string): Shift[] {
  return SHIFTS.filter(s => s.assignedEmployee?.id === employeeId)
}

export function getWeeklyHours(employeeId: string): number {
  const weekStart = getWeekStart()
  const weekEnd = addDays(weekStart, 7)
  return SHIFTS
    .filter(s => {
      if (s.assignedEmployee?.id !== employeeId) return false
      const d = new Date(s.date)
      return d >= weekStart && d < weekEnd
    })
    .reduce((acc, s) => {
      const [sh, sm] = s.startTime.split(':').map(Number)
      const [eh, em] = s.endTime.split(':').map(Number)
      return acc + (eh + em / 60) - (sh + sm / 60)
    }, 0)
}

export function getDayCoverage(dateStr: string): { coverage: 'full' | 'partial' | 'empty'; assigned: number; total: number } {
  const dayShifts = SHIFTS.filter(s => s.date === dateStr)
  const total = dayShifts.length
  if (total === 0) return { coverage: 'empty', assigned: 0, total: 0 }
  const assigned = dayShifts.filter(s => s.status !== 'open').length
  const ratio = assigned / total
  return {
    coverage: ratio >= 0.8 ? 'full' : ratio >= 0.4 ? 'partial' : 'empty',
    assigned,
    total,
  }
}

// ─── Business stats (pro super admin dashboard) ───────────────────────────────

const BIZ_META: Record<string, {
  shifts: Shift[]
  employees: User[]
  manager: User
}> = {
  'biz-1': { shifts: SHIFTS,    employees: EMPLOYEES,    manager: MANAGER    },
  'biz-2': { shifts: SHIFTS_B2, employees: EMPLOYEES_B2, manager: MANAGER_B2 },
  'biz-3': { shifts: SHIFTS_B3, employees: EMPLOYEES_B3, manager: MANAGER_B3 },
}

export function getBusinessStats(bizId: string): BusinessStats {
  const biz = BUSINESSES.find(b => b.id === bizId)!
  const meta = BIZ_META[bizId]
  const open = meta.shifts.filter(s => s.status === 'open').length
  const confirmed = meta.shifts.filter(s => s.status === 'confirmed').length
  const total = meta.shifts.length
  const ratio = total > 0 ? (total - open) / total : 1
  return {
    business: biz,
    manager: meta.manager,
    employeeCount: meta.employees.length,
    totalShifts: total,
    openShifts: open,
    confirmedShifts: confirmed,
    weekCoverage: ratio >= 0.8 ? 'full' : ratio >= 0.5 ? 'partial' : 'low',
  }
}

export const ALL_BUSINESS_STATS: BusinessStats[] = BUSINESSES.map(b => getBusinessStats(b.id))
