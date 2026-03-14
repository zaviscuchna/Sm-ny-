import type { Shift } from '@/types'

// Formát datumu pro Google Calendar: YYYYMMDDTHHmmss
function toGCalDate(date: string, time: string): string {
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`
}

// Google Calendar — otevře v novém tabu
export function openInGoogleCalendar(shift: Shift, businessName: string) {
  const start = toGCalDate(shift.date, shift.startTime)
  const end   = toGCalDate(shift.date, shift.endTime)

  const params = new URLSearchParams({
    action:  'TEMPLATE',
    text:    `Směna — ${shift.roleNeeded} (${businessName})`,
    dates:   `${start}/${end}`,
    details: `Role: ${shift.roleNeeded}\nProvozovna: ${businessName}${shift.notes ? `\nPoznámka: ${shift.notes}` : ''}`,
    location: businessName,
  })

  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank')
}

// ICS soubor — Apple Calendar, Outlook, libovolný kalendář
export function downloadICS(shifts: Shift[], businessName: string, filename = 'smeny.ics') {
  const toICSDate = (date: string, time: string) =>
    `${date.replace(/-/g, '')}T${time.replace(':', '')}00`

  const uid = () => Math.random().toString(36).substring(2) + Date.now()

  const events = shifts.map(s => [
    'BEGIN:VEVENT',
    `UID:${uid()}@smenky`,
    `DTSTART:${toICSDate(s.date, s.startTime)}`,
    `DTEND:${toICSDate(s.date, s.endTime)}`,
    `SUMMARY:Směna — ${s.roleNeeded} (${businessName})`,
    `DESCRIPTION:Role: ${s.roleNeeded}\\nProvozovna: ${businessName}${s.notes ? `\\nPoznámka: ${s.notes}` : ''}`,
    `LOCATION:${businessName}`,
    `STATUS:CONFIRMED`,
    'END:VEVENT',
  ].join('\r\n')).join('\r\n')

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Směny organizátor//CS',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    events,
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
