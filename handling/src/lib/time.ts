export const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const pad = (n: number) => String(n).padStart(2, '0')

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/** Local calendar date as YYYY-MM-DD (never UTC, so late-night shifts stay on their day). */
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayISO = () => toISO(new Date())

export function addDays(iso: string, days: number): string {
  const d = fromISO(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

/** "martes 6 de octubre" */
export function formatLongDate(iso: string): string {
  const d = fromISO(iso)
  return `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}`
}

/** Accepts 6, 600, 0600, 6:00, 6.00, 6h00, 6h and returns HH:MM, or null if it is not a time. */
export function normalizeTime(raw: string): string | null {
  const s = raw.trim().toLowerCase()
  let m = s.match(/^(\d{1,2})\s*[:.h]\s*(\d{2})$/)
  if (!m) m = s.match(/^(\d{1,2})(\d{2})$/)
  if (!m) {
    const only = s.match(/^(\d{1,2})\s*h?$/)
    if (only) m = [only[0], only[1], '00'] as RegExpMatchArray
  }
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null
  return `${pad(h === 24 ? 0 : h)}:${pad(min)}`
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Length of a shift in minutes; an end before the start rolls over midnight. */
export function shiftMinutes(start: string, end: string): number {
  if (!start || !end) return 0
  const s = toMinutes(start)
  let e = toMinutes(end)
  if (e <= s) e += 24 * 60
  return e - s
}

export const endsNextDay = (start: string, end: string) =>
  Boolean(start && end) && toMinutes(end) <= toMinutes(start)

/** Minutes of the shift that fall in the night band (22:00–06:00). */
export function nightMinutes(start: string, end: string): number {
  if (!start || !end) return 0
  const s = toMinutes(start)
  const e = s + shiftMinutes(start, end)
  // Night bands across two days, in minutes from the start day's midnight.
  const bands: [number, number][] = [[0, 360], [1320, 1800], [2760, 3240]]
  return bands.reduce((acc, [a, b]) => acc + Math.max(0, Math.min(e, b) - Math.max(s, a)), 0)
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${pad(m)} min` : `${h} h`
}

/** Weeks (Monday first) covering a month, each day as ISO or null for padding. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= days; d++) cells.push(toISO(new Date(year, month, d)))
  while (cells.length % 7) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** Monday of the week that contains the date. */
export function weekStart(iso: string): string {
  const d = fromISO(iso)
  return addDays(iso, -((d.getDay() + 6) % 7))
}

/** Lowercase, no accents, single spaces — for matching names and headers. */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}
