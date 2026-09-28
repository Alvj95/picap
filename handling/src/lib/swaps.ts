import type { AppData, IncomingSwap, Profile, RosterEntry, Swap } from '../types'
import { answerLink, incomingFromRequest, requestLink, type LinkPayload } from './links'
import { isMe, isWorking } from './roster'
import { endsNextDay, formatLongDate, uid } from './time'

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

export function newSwap(fields: Omit<Swap, 'id' | 'status' | 'createdAt' | 'answeredAt' | 'reply' | 'emailedAt'>): Swap {
  return { ...fields, id: uid(), status: 'pendiente', createdAt: Date.now(), answeredAt: null, reply: '', emailedAt: null }
}

const slot = (start: string, end: string) => `${start}-${end}${endsNextDay(start, end) ? ' (+1)' : ''}`

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
  lines.push('', 'Acéptalo o recházalo desde la app Turnos Handling:', requestLink(swap, me))
  return lines.join('\n')
}

/** The coworker's answer, with the link that records it in the requester's app. */
export function answerMessage(incoming: IncomingSwap, ok: boolean, me: string, note: string): string {
  const day = formatLongDate(incoming.date)
  return [
    ok
      ? `✅ ${incoming.from}, acepto el cambio del ${day}. Ya puedes enviarlo a programación.`
      : `❌ ${incoming.from}, no puedo hacer el cambio del ${day}.`,
    ...(note ? [note] : []),
    ...(me ? [`— ${me}`] : []),
    '',
    'Ábrelo para registrar la respuesta en la app:',
    answerLink(incoming, ok, me, note),
  ].join('\n')
}

export type Email = { to: string; subject: string; body: string }

/** Email to the scheduling office asking it to approve a change the coworker already accepted. */
export function schedulingEmail(swap: Swap, profile: { name: string; employeeId: string; schedulingEmail: string }): Email {
  const day = formatLongDate(swap.date)
  const me = profile.name + (profile.employeeId ? ` (nº ${profile.employeeId})` : '')
  const subject = `Solicitud de cambio de turno – ${swap.date} – ${profile.name} / ${swap.coworker}`
  const detail =
    swap.kind === 'intercambio'
      ? [
          `Solicitamos intercambiar nuestros turnos del ${day}:`,
          `  • ${profile.name}: pasa de ${slot(swap.start, swap.end)} a ${slot(swap.coworkerStart, swap.coworkerEnd)}`,
          `  • ${swap.coworker}: pasa de ${slot(swap.coworkerStart, swap.coworkerEnd)} a ${slot(swap.start, swap.end)}`,
        ]
      : [
          `Solicito que ${swap.coworker} cubra mi turno del ${day}:`,
          `  • Turno: ${slot(swap.start, swap.end)}${swap.role ? ` (${swap.role})` : ''}`,
        ]
  const accepted = swap.answeredAt
    ? `${swap.coworker} aceptó el cambio el ${new Date(swap.answeredAt).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}.`
    : `${swap.coworker} ha aceptado el cambio.`
  const body = ['Buenos días,', '', ...detail, '', accepted, ...(swap.note ? [`Motivo: ${swap.note}`] : []), '',
    'Quedamos a la espera de su aprobación.', '', 'Un saludo,', me].join('\n')
  return { to: profile.schedulingEmail, subject, body }
}

export const mailtoUrl = (e: Email) =>
  `mailto:${encodeURIComponent(e.to)}?subject=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(e.body)}`

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
    swaps: data.swaps.map((s) => (s.id === swap.id ? { ...s, status: 'aprobado' } : s)),
  }
}

/** Records the coworker's answer (from their answer link) on the request I sent. */
export function recordAnswer(data: AppData, id: string, ok: boolean, note: string): AppData {
  return {
    ...data,
    swaps: data.swaps.map((s) =>
      s.id === id && (s.status === 'pendiente' || s.status === 'aceptado_companero' || s.status === 'rechazado')
        ? { ...s, status: ok ? 'aceptado_companero' : 'rechazado', answeredAt: Date.now(), reply: note }
        : s,
    ),
  }
}

/**
 * The coworker's side of an approved change: my calendar and roster copy take the new shift.
 * For a trade this is the same operation as the sender's, seen from my side.
 */
export function applyIncomingSwap(data: AppData, inc: IncomingSwap): AppData {
  const done = (d: AppData): AppData => ({
    ...d,
    incoming: d.incoming.map((x) => (x.id === inc.id ? { ...x, status: 'aplicado' } : x)),
  })
  if (inc.kind === 'intercambio') {
    const mirrored: Swap = {
      ...newSwap({ kind: 'intercambio', date: inc.date, start: inc.coworkerStart, end: inc.coworkerEnd, role: inc.role,
        coworker: inc.from, coworkerStart: inc.start, coworkerEnd: inc.end, note: '' }),
      id: '',
    }
    return done(applyAcceptedSwap(data, mirrored))
  }
  const shift = {
    id: uid(), date: inc.date, start: inc.start, end: inc.end, role: inc.role, flights: [],
    notes: `Cubro a ${inc.from}`, source: 'cambio' as const,
  }
  const roster = data.roster.map((e) => {
    if (e.date !== inc.date) return e
    if (e.employee === inc.from && e.start === inc.start && e.end === inc.end) {
      return { ...e, start: '', end: '', label: `CUBRE ${data.profile.name}`.toUpperCase() }
    }
    if (isMe(e.employee, data.profile) && !isWorking(e)) return { ...e, start: inc.start, end: inc.end, label: '' }
    return e
  })
  const shifts = [...data.shifts, shift].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
  return done({ ...data, shifts, roster })
}

/** Handles an opened request/answer link: returns the new state and what to tell the user. */
export function receiveLink(d: AppData, link: LinkPayload): { data: AppData; notice: string } {
  if (link.t === 'req') {
    if (d.swaps.some((s) => s.id === link.id)) {
      return { data: d, notice: 'Esta solicitud la enviaste tú. Compártela con tu compañero para que la acepte.' }
    }
    if (d.incoming.some((i) => i.id === link.id)) return { data: d, notice: `Ya tienes esta solicitud de ${link.from}.` }
    const profile = d.profile.name ? d.profile : { ...d.profile, name: link.to }
    return {
      data: { ...d, profile, incoming: [...d.incoming, incomingFromRequest(link)] },
      notice: `📩 ${link.from} te ha enviado una solicitud de cambio.`,
    }
  }
  const swap = d.swaps.find((s) => s.id === link.id)
  if (!swap) {
    return { data: d, notice: 'No encuentro esa solicitud en este teléfono. Ábrelo en el móvil desde el que la enviaste.' }
  }
  return {
    data: recordAnswer(d, link.id, link.ok, link.note),
    notice: link.ok
      ? `✅ ${link.by || swap.coworker} aceptó tu cambio. Ya puedes enviar el correo a programación.`
      : `❌ ${link.by || swap.coworker} rechazó tu cambio.`,
  }
}
