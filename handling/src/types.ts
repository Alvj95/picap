/** A flight the worker handles during a shift (check-in, boarding…). */
export type Flight = {
  id: string
  number: string // e.g. IB6401
  destination: string // IATA code or city
  std: string // scheduled departure, HH:MM
  counters: string // check-in counters, e.g. "12-18"
  notes: string
}

export type ShiftSource = 'manual' | 'empresa' | 'cambio'

/** One worked shift in the worker's own calendar. */
export type Shift = {
  id: string
  date: string // YYYY-MM-DD (day the shift starts)
  start: string // HH:MM
  end: string // HH:MM — earlier than start means it ends the next day
  role: string // Check-in, Rampa, Embarque…
  flights: Flight[]
  notes: string
  source: ShiftSource
}

/** One line of the general schedule published by the company. */
export type RosterEntry = {
  employee: string
  date: string
  start: string // empty when it is a day off / absence
  end: string
  role: string
  flights: string // raw flight text, parsed on demand
  label: string // non-work code such as LIBRE, VAC, BAJA
}

export type SwapKind = 'intercambio' | 'cesion'
/**
 * Life of a request I send: the coworker answers (aceptado_companero / rechazado), then I
 * email the scheduling office (enviado_programacion), which approves or denies it.
 */
export type SwapStatus =
  | 'pendiente'
  | 'aceptado_companero'
  | 'enviado_programacion'
  | 'aprobado'
  | 'rechazado'
  | 'denegado'
  | 'cancelado'

/** A shift change the worker proposes to a coworker. */
export type Swap = {
  id: string
  kind: SwapKind // intercambio: we trade shifts · cesion: coworker covers my shift
  date: string
  start: string
  end: string
  role: string
  coworker: string
  coworkerStart: string // coworker's shift that day (for intercambio)
  coworkerEnd: string
  note: string
  status: SwapStatus
  createdAt: number
  answeredAt: number | null // when the coworker accepted or rejected
  reply: string // coworker's message with the answer
  emailedAt: number | null // when I sent it to the scheduling office
}

export type IncomingStatus = 'pendiente' | 'aceptado' | 'rechazado' | 'aplicado'

/** A request a coworker sent me (opened from their link). */
export type IncomingSwap = {
  id: string // same id as the sender's Swap, so my answer finds it
  kind: SwapKind
  from: string // who asks
  to: string // me, as the sender wrote it
  date: string
  start: string // the sender's shift
  end: string
  role: string
  coworkerStart: string // my shift that day (intercambio)
  coworkerEnd: string
  note: string
  status: IncomingStatus
  receivedAt: number
}

export type Profile = {
  name: string // must match how the company roster writes it
  employeeId: string
  schedulingEmail: string // scheduling office ("programación") that approves changes
}

export type AppData = {
  version: 1
  profile: Profile
  shifts: Shift[]
  roster: RosterEntry[]
  rosterName: string
  rosterImportedAt: number | null
  swaps: Swap[]
  incoming: IncomingSwap[]
}
