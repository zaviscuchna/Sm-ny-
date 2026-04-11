export type Role = 'superadmin' | 'manager' | 'employee'
export type ShiftStatus = 'assigned' | 'open' | 'confirmed' | 'pending' | 'planned' | 'completed' | 'cancelled'
export type ApplicationStatus = 'pending' | 'approved' | 'rejected'
export type TimeOffStatus = 'pending' | 'approved' | 'rejected'
export type DayCoverage = 'full' | 'partial' | 'empty'

export type Permission =
  | 'ASSIGN_SHIFTS'
  | 'MANAGE_OPEN_SHIFTS'
  | 'VIEW_TEAM'
  | 'VIEW_ALL_HOURS'
  | 'APPROVE_REQUESTS'

export const ALL_PERMISSIONS: { key: Permission; label: string; description: string }[] = [
  { key: 'ASSIGN_SHIFTS',      label: 'Přidělovat směny',       description: 'Může přidělovat směny ostatním zaměstnancům' },
  { key: 'MANAGE_OPEN_SHIFTS', label: 'Spravovat volné směny',  description: 'Může vytvářet a rušit otevřené směny' },
  { key: 'VIEW_TEAM',          label: 'Zobrazit tým',           description: 'Vidí seznam zaměstnanců pobočky' },
  { key: 'VIEW_ALL_HOURS',     label: 'Zobrazit hodiny všech',  description: 'Vidí odpracované hodiny všech zaměstnanců' },
  { key: 'APPROVE_REQUESTS',   label: 'Schvalovat žádosti',     description: 'Může schvalovat žádosti o směny' },
]

export interface User {
  id: string
  name: string
  email: string
  role: Role
  avatar?: string
  phone?: string
  color?: string
}

export interface Branch {
  id: string
  name: string
  address: string
  businessId: string
  createdAt?: string
}

export interface EmployeeBranch {
  id: string
  userId: string
  branchId: string
  role: string
  permissions: Permission[]
  user?: User
  branch?: Branch
}

export interface Business {
  id: string
  name: string
  location: string
  positions?: string[]
}

export interface Shift {
  id: string
  businessId: string
  branchId?: string
  date: string
  startTime: string
  endTime: string
  roleNeeded: string
  assignedEmployee?: User
  status: ShiftStatus
  notes?: string
  recurringGroupId?: string
  actualStart?: string
  actualEnd?: string
  branch?: Branch
}

export interface ShiftApplication {
  id: string
  shift: Shift
  employee: User
  status: ApplicationStatus
  createdAt: string
}

export interface TimeOffRequest {
  id: string
  employee: User
  startDate: string
  endDate: string
  reason: string
  status: TimeOffStatus
  createdAt: string
}

export interface BusinessStats {
  business: Business
  manager: User | null
  employeeCount: number
  totalShifts: number
  openShifts: number
  confirmedShifts: number
  weekCoverage: 'full' | 'partial' | 'low'
}

export interface WeekDay {
  date: string
  label: string
  dayNum: number
  shifts: Shift[]
  coverage: DayCoverage
  requiredStaff: number
  assignedStaff: number
}
