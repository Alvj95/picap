import type { Shift } from '../types'
import { addDays, endsNextDay } from './time'

const stamp = (date: string, time: string) => `${date.replaceAll('-', '')}T${time.replace(':', '')}00`
const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')

/** iCalendar file so shifts can be added to Google Calendar, Outlook or the phone calendar. */
export function shiftsToICS(shifts: Shift[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const events = shifts.map((s) => {
    const endDate = endsNextDay(s.start, s.end) ? addDays(s.date, 1) : s.date
    const flights = s.flights.map((f) => [f.number, f.destination, f.std && `STD ${f.std}`, f.counters && `mostr. ${f.counters}`].filter(Boolean).join(' '))
    const description = [...flights, s.notes].filter(Boolean).join('\n')
    return [
      'BEGIN:VEVENT',
      `UID:${s.id}@turnos-handling`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(s.date, s.start)}`,
      `DTEND:${stamp(endDate, s.end)}`,
      `SUMMARY:${escape(`Turno ${s.role || 'handling'} ${s.start}-${s.end}`)}`,
      description && `DESCRIPTION:${escape(description)}`,
      'END:VEVENT',
    ].filter(Boolean).join('\r\n')
  })
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Turnos Handling//ES', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR', ''].join('\r\n')
}
