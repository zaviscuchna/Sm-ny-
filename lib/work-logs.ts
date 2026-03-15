export interface WorkLog {
  id: string
  employeeId: string
  employeeName: string
  date: string      // yyyy-MM-dd
  clockIn: string   // HH:mm
  clockOut: string  // HH:mm
  notes?: string
  hours: number
}

const LS_KEY = 'smenky_work_logs'

export function getWorkLogs(): WorkLog[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function calcHours(clockIn: string, clockOut: string): number {
  const [ih, im] = clockIn.split(':').map(Number)
  const [oh, om] = clockOut.split(':').map(Number)
  return Math.round(((oh + om / 60) - (ih + im / 60)) * 10) / 10
}

export function saveWorkLog(entry: Omit<WorkLog, 'id' | 'hours'>): WorkLog {
  const log: WorkLog = {
    ...entry,
    id: `wl-${Date.now()}`,
    hours: calcHours(entry.clockIn, entry.clockOut),
  }
  const all = getWorkLogs()
  all.unshift(log) // newest first
  localStorage.setItem(LS_KEY, JSON.stringify(all))
  return log
}

export function deleteWorkLog(id: string): void {
  const all = getWorkLogs().filter(l => l.id !== id)
  localStorage.setItem(LS_KEY, JSON.stringify(all))
}

export function getEmployeeLogs(employeeId: string): WorkLog[] {
  return getWorkLogs().filter(l => l.employeeId === employeeId)
}

export function getMonthLogs(employeeId: string, yearMonth: string): WorkLog[] {
  return getWorkLogs().filter(l => l.employeeId === employeeId && l.date.startsWith(yearMonth))
}

export function getAllMonthLogs(yearMonth: string): WorkLog[] {
  return getWorkLogs().filter(l => l.date.startsWith(yearMonth))
}

export function sumHours(logs: WorkLog[]): number {
  return Math.round(logs.reduce((acc, l) => acc + l.hours, 0) * 10) / 10
}

// Seed demo logs so manager payroll view isn't empty on first load
export function seedDemoLogs(employees: { id: string; name: string }[]): void {
  if (typeof window === 'undefined') return
  if (localStorage.getItem('smenky_logs_seeded')) return
  const today = new Date()
  const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const demos: Omit<WorkLog, 'id' | 'hours'>[] = []
  employees.forEach(emp => {
    for (let d = 1; d <= today.getDate() - 1; d++) {
      // every other day
      if (d % 2 !== 0) continue
      const dateStr = `${month}-${String(d).padStart(2, '0')}`
      demos.push({ employeeId: emp.id, employeeName: emp.name, date: dateStr, clockIn: '07:00', clockOut: '15:00' })
    }
  })
  const seeded = demos.map(e => ({
    ...e,
    id: `wl-demo-${e.employeeId}-${e.date}`,
    hours: calcHours(e.clockIn, e.clockOut),
  }))
  localStorage.setItem(LS_KEY, JSON.stringify(seeded))
  localStorage.setItem('smenky_logs_seeded', '1')
}
