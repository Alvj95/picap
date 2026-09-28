import type { Flight, Profile, RosterEntry, Shift } from '../types'
import { normalizeText, normalizeTime, toISO, uid } from './time'

export type ParseResult = {
  entries: RosterEntry[]
  employees: string[]
  warnings: string[]
  format: 'lista' | 'cuadrante'
}

/** Split CSV/TSV text (pasted from Excel or exported by the company) into cells. */
export function splitRows(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '')
  if (!lines.length) return []
  const header = lines[0]
  const delimiter = ['\t', ';', ','].reduce((best, d) =>
    header.split(d).length > header.split(best).length ? d : best,
  )
  return lines.map((line) => splitLine(line, delimiter))
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell.trim() === '') quoted = true
    else if (ch === delimiter) { cells.push(cell.trim()); cell = '' }
    else cell += ch
  }
  cells.push(cell.trim())
  return cells
}

/**
 * Reads a date written as 2026-10-05, 05/10/2026, 5-10-26, 05/10 or just a day number
 * ("5", "Lun 5"). Missing parts come from the reference month.
 */
export function parseDate(raw: string, refYear: number, refMonth: number): string | null {
  const s = raw.trim()
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (m) return validDate(+m[1], +m[2], +m[3])
  m = s.match(/(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?/)
  if (m) {
    const year = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : refYear
    return validDate(year, +m[2], +m[1])
  }
  m = s.match(/^(?:[a-záéíóúñ.]+\s*)?(\d{1,2})(?:\s*[a-záéíóúñ.]+)?$/i)
  if (m) return validDate(refYear, refMonth + 1, +m[1])
  return null
}

function validDate(y: number, m: number, d: number): string | null {
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return toISO(date)
}

const TIME = String.raw`\d{1,2}(?:\s*[:.h]\s*\d{2}|\d{2})?`
const RANGE = new RegExp(String.raw`(${TIME})\s*(?:-|–|—|a|al|to|>)\s*(${TIME})`, 'i')

/** "06:00-14:00 CKI" → { start, end, rest: "CKI" }. Anything else is treated as a label (LIBRE, VAC…). */
export function parseCell(raw: string): { start: string; end: string; rest: string } | null {
  const m = raw.match(RANGE)
  if (!m) return null
  const start = normalizeTime(m[1])
  const end = normalizeTime(m[2])
  if (!start || !end) return null
  const rest = (raw.slice(0, m.index) + ' ' + raw.slice((m.index ?? 0) + m[0].length)).replace(/\s+/g, ' ').trim()
  return { start, end, rest }
}

const COLUMNS = {
  employee: ['empleado', 'nombre', 'trabajador', 'agente', 'colaborador', 'apellidos y nombre', 'nombre y apellidos', 'personal'],
  date: ['fecha', 'dia', 'date'],
  start: ['entrada', 'inicio', 'desde', 'hora entrada', 'hora inicio', 'start'],
  end: ['salida', 'fin', 'hasta', 'hora salida', 'hora fin', 'end'],
  range: ['horario', 'turno', 'jornada'],
  role: ['puesto', 'funcion', 'posicion', 'area', 'rol', 'servicio', 'tarea'],
  flights: ['vuelos', 'vuelo', 'flights', 'flight'],
}

function findColumn(headers: string[], names: string[]): number {
  const exact = headers.findIndex((h) => names.includes(h))
  if (exact >= 0) return exact
  return headers.findIndex((h) => names.some((n) => h.startsWith(n)))
}

/**
 * Parses the company's general schedule. Two layouts are understood:
 *  - lista: one row per shift with columns Fecha, Empleado, Entrada, Salida (or Horario), Puesto, Vuelos.
 *  - cuadrante: one row per employee and one column per day, cells like "06:00-14:00" or "LIBRE".
 */
export function parseRoster(text: string, refYear: number, refMonth: number): ParseResult {
  const rows = splitRows(text)
  if (rows.length < 2) throw new Error('El horario necesita una fila de encabezados y al menos una fila de datos.')
  const headers = rows[0].map(normalizeText)
  const warnings: string[] = []
  const entries: RosterEntry[] = []

  const col = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, names]) => [key, findColumn(headers, names)]),
  ) as Record<keyof typeof COLUMNS, number>

  const hasTimes = (col.start >= 0 && col.end >= 0) || col.range >= 0
  const dateColumns = rows[0]
    .map((h, i) => ({ i, date: i === 0 ? null : parseDate(h, refYear, refMonth) }))
    .filter((c): c is { i: number; date: string } => c.date !== null)

  if (col.date >= 0 && col.employee >= 0 && hasTimes) {
    rows.slice(1).forEach((row, n) => {
      const line = n + 2
      const employee = row[col.employee]?.trim()
      const date = parseDate(row[col.date] ?? '', refYear, refMonth)
      if (!employee) return
      if (!date) { warnings.push(`Fila ${line}: fecha no reconocida "${row[col.date] ?? ''}".`); return }
      let start = col.start >= 0 ? normalizeTime(row[col.start] ?? '') : null
      let end = col.end >= 0 ? normalizeTime(row[col.end] ?? '') : null
      let label = ''
      if ((!start || !end) && col.range >= 0) {
        const cell = parseCell(row[col.range] ?? '')
        if (cell) ({ start, end } = cell)
        else label = (row[col.range] ?? '').trim()
      }
      if (!start || !end) {
        label ||= [row[col.start], row[col.end]].filter(Boolean).join(' ').trim()
        if (!label) { warnings.push(`Fila ${line}: sin hora de entrada/salida.`); return }
      }
      entries.push({
        employee,
        date,
        start: start && end ? start : '',
        end: start && end ? end : '',
        role: col.role >= 0 ? (row[col.role] ?? '').trim() : '',
        flights: col.flights >= 0 ? (row[col.flights] ?? '').trim() : '',
        label: start && end ? '' : label.toUpperCase(),
      })
    })
    return finish(entries, warnings, 'lista')
  }

  if (dateColumns.length >= 2) {
    rows.slice(1).forEach((row) => {
      const employee = row[0]?.trim()
      if (!employee) return
      for (const { i, date } of dateColumns) {
        const raw = (row[i] ?? '').trim()
        if (!raw) continue
        const cell = parseCell(raw)
        entries.push(
          cell
            ? { employee, date, start: cell.start, end: cell.end, role: cell.rest, flights: '', label: '' }
            : { employee, date, start: '', end: '', role: '', flights: '', label: raw.toUpperCase() },
        )
      }
    })
    return finish(entries, warnings, 'cuadrante')
  }

  throw new Error(
    'No reconozco el formato. Usa columnas Fecha, Empleado, Entrada, Salida (una fila por turno) ' +
      'o un cuadrante con los empleados en la primera columna y un día por columna.',
  )
}

function finish(entries: RosterEntry[], warnings: string[], format: ParseResult['format']): ParseResult {
  if (!entries.length) throw new Error('No encontré ningún turno en el horario.')
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
  const employees = [...new Set(entries.map((e) => e.employee))].sort((a, b) => a.localeCompare(b, 'es'))
  return { entries, employees, warnings, format }
}

export const isWorking = (e: RosterEntry) => Boolean(e.start && e.end)

/** Whether a roster name refers to the user (by employee number or by name, in any word order). */
export function isMe(employee: string, profile: Pick<Profile, 'name' | 'employeeId'>): boolean {
  const who = normalizeText(employee)
  const id = normalizeText(profile.employeeId)
  if (id && who.split(/[^a-z0-9]+/).includes(id)) return true
  const name = normalizeText(profile.name)
  if (!name) return false
  if (who === name) return true
  const words = (s: string) => s.replace(/[^a-z0-9ñ ]/g, ' ').split(' ').filter((w) => w.length > 1).sort().join(' ')
  return words(who) === words(name)
}

/** Flight text such as "IB6401 MAD 08:30; UX1093 LIS 10:15" → flights. */
export function parseFlights(text: string): Flight[] {
  return text
    .split(/[;\n|]+|,(?!\d)/)
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean)
    .map((part) => {
      const number = part.match(/\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4}[A-Z]?)\b/)
      const std = part.match(/\b(\d{1,2})[:.h](\d{2})\b/)
      const rest = number ? part.replace(number[0], ' ') : part
      const destination = rest.match(/\b[A-Z]{3}\b/)
      return {
        id: uid(),
        number: number ? number[1] + number[2] : part.split(/\s+/)[0],
        destination: destination?.[0] ?? '',
        std: std ? normalizeTime(`${std[1]}:${std[2]}`) ?? '' : '',
        counters: '',
        notes: '',
      }
    })
}

/** Turns the user's own roster lines into calendar shifts. */
export function shiftsFromRoster(roster: RosterEntry[], profile: Profile): Shift[] {
  return roster
    .filter((e) => isWorking(e) && isMe(e.employee, profile))
    .map((e) => ({
      id: uid(),
      date: e.date,
      start: e.start,
      end: e.end,
      role: e.role,
      flights: parseFlights(e.flights),
      notes: '',
      source: 'empresa' as const,
    }))
}

/**
 * Replaces the company-sourced shifts on the roster's dates with the fresh ones, keeping
 * shifts the user added by hand or got through a swap. Returns the merged list.
 */
export function mergeCompanyShifts(current: Shift[], roster: RosterEntry[], profile: Profile): Shift[] {
  const covered = new Set(roster.map((e) => e.date))
  const incoming = shiftsFromRoster(roster, profile)
  const kept = current.filter((s) => !(s.source === 'empresa' && covered.has(s.date)))
  // Keep the flights the user already typed for a company shift that did not change.
  for (const shift of incoming) {
    const previous = current.find(
      (s) => s.source === 'empresa' && s.date === shift.date && s.start === shift.start && s.end === shift.end,
    )
    if (previous && !shift.flights.length) {
      shift.flights = previous.flights
      shift.notes = previous.notes
    }
  }
  return [...kept, ...incoming].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
}
