export type Role = 'superadmin' | 'manager' | 'employee'
export type ShiftStatus = 'assigned' | 'open' | 'confirmed' | 'pending'
export type ApplicationStatus = 'pending' | 'approved' | 'rejected'
export type TimeOffStatus = 'pending' | 'approved' | 'rejected'
export type DayCoverage = 'full' | 'partial' | 'empty'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  avatar?: string
  phone?: string
  color?: string // avatar background color
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
  date: string // ISO date string YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string   // HH:mm
  roleNeeded: string
  assignedEmployee?: User
  status: ShiftStatus
  notes?: string
  recurringGroupId?: string
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
  date: string // YYYY-MM-DD
  label: string // "Po", "Út", ...
  dayNum: number // 1, 2, ...
  shifts: Shift[]
  coverage: DayCoverage
  requiredStaff: number
  assignedStaff: number
}
