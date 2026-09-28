import type { AppData, Profile, RosterEntry, Swap } from '../types'
import { isMe, isWorking } from './roster'
import { formatLongDate, uid } from './time'

export type Candidate = {
  employee: string
  kind: 'intercambio' | 'cesion'
  entry: RosterEntry | null // the coworker's shift that day, if any
}

/**
 * Coworkers from the general schedule who could take a shift on a given date:
 * those working another time slot (direct trade) and those off that day (cover).
 */
export function swapCandidates(roster: RosterEntry[], profile: Profile, date: string, start: string, end: string): Candidate[] {
  const others = [...new Set(roster.map((e) => e.employee))].filter((name) => !isMe(name, profile))
  const result: Candidate[] = []
  for (const employee of others) {
    const that = roster.filter((e) => e.employee === employee && e.date === date)
    const working = that.find(isWorking)
    if (working) {
      if (working.start !== start || working.end !== end) result.push({ employee, kind: 'intercambio', entry: working })
    } else {
      result.push({ employee, kind: 'cesion', entry: that[0] ?? null })
    }
  }
  return result.sort((a, b) => a.kind.localeCompare(b.kind) || a.employee.localeCompare(b.employee, 'es'))
}

export function newSwap(fields: Omit<Swap, 'id' | 'status' | 'createdAt'>): Swap {
  return { ...fields, id: uid(), status: 'pendiente', createdAt: Date.now() }
}

/** Message the worker sends the coworker (and supervisor) to arrange the change. */
export function swapMessage(swap: Swap, me: string): string {
  const day = formatLongDate(swap.date)
  const lines =
    swap.kind === 'intercambio'
      ? [
          `Hola ${swap.coworker}, ¿cambiamos turno el ${day}?`,
          `Tú harías mi turno ${swap.start}-${swap.end}${swap.role ? ` (${swap.role})` : ''} y yo el tuyo ${swap.coworkerStart}-${swap.coworkerEnd}.`,
        ]
      : [
          `Hola ${swap.coworker}, ¿me puedes cubrir el turno del ${day}?`,
          `Horario ${swap.start}-${swap.end}${swap.role ? ` (${swap.role})` : ''}.`,
        ]
  if (swap.note) lines.push(swap.note)
  if (me) lines.push(`— ${me}`)
  return lines.join('\n')
}

/**
 * Applies an accepted change: updates the worker's calendar and the local copy of the
 * general schedule so both views stay consistent.
 */
export function applyAcceptedSwap(data: AppData, swap: Swap): AppData {
  const matchesMine = (s: { date: string; start: string; end: string }) =>
    s.date === swap.date && s.start === swap.start && s.end === swap.end

  let shifts = data.shifts
  if (swap.kind === 'intercambio') {
    shifts = shifts.map((s) =>
      matchesMine(s)
        ? { ...s, start: swap.coworkerStart, end: swap.coworkerEnd, source: 'cambio' as const, flights: [], notes: `Cambio con ${swap.coworker}` }
        : s,
    )
  } else {
    shifts = shifts.filter((s) => !matchesMine(s))
  }

  const roster = data.roster.map((e) => {
    if (e.date !== swap.date) return e
    if (isMe(e.employee, data.profile) && e.start === swap.start && e.end === swap.end) {
      return swap.kind === 'intercambio'
        ? { ...e, start: swap.coworkerStart, end: swap.coworkerEnd }
        : { ...e, start: '', end: '', label: `CUBRE ${swap.coworker}`.toUpperCase() }
    }
    if (e.employee === swap.coworker) {
      if (swap.kind === 'intercambio' && e.start === swap.coworkerStart && e.end === swap.coworkerEnd) {
        return { ...e, start: swap.start, end: swap.end }
      }
      if (swap.kind === 'cesion' && !isWorking(e)) return { ...e, start: swap.start, end: swap.end, label: '' }
    }
    return e
  })
  // A coworker with no line that day (not in the roster) still takes the shift.
  const coworkerHasDay = data.roster.some((e) => e.employee === swap.coworker && e.date === swap.date)
  if (swap.kind === 'cesion' && !coworkerHasDay && data.roster.some((e) => e.employee === swap.coworker)) {
    roster.push({ employee: swap.coworker, date: swap.date, start: swap.start, end: swap.end, role: swap.role, flights: '', label: '' })
  }

  return {
    ...data,
    shifts,
    roster,
    swaps: data.swaps.map((s) => (s.id === swap.id ? { ...s, status: 'aceptado' } : s)),
  }
}
