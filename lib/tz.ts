const TZ = 'Europe/Prague'

const dateFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const timeFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function todayPrague(d: Date = new Date()): string {
  return dateFmt.format(d)
}

export function nowTimePrague(d: Date = new Date()): string {
  return timeFmt.format(d)
}

export function parsePragueDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00+02:00`)
}

export function compareDateStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
