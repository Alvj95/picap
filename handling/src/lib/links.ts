import type { IncomingSwap, Swap, SwapKind } from '../types'

/**
 * Swap requests travel as links inside the WhatsApp message, so two phones can agree on a
 * change without a server: the coworker opens the request link, answers, and sends back an
 * answer link that updates the requester's app.
 */
export type RequestPayload = {
  t: 'req'
  id: string
  kind: SwapKind
  from: string
  to: string
  date: string
  start: string
  end: string
  role: string
  cs: string
  ce: string
  note: string
}
export type AnswerPayload = { t: 'ans'; id: string; ok: boolean; by: string; note: string }
export type LinkPayload = RequestPayload | AnswerPayload

const PARAM = 'cambio'

function encode(payload: LinkPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function appUrl(): string {
  return `${location.origin}${location.pathname}`
}

export function requestLink(swap: Swap, me: string): string {
  const payload: RequestPayload = {
    t: 'req', id: swap.id, kind: swap.kind, from: me, to: swap.coworker, date: swap.date, start: swap.start,
    end: swap.end, role: swap.role, cs: swap.coworkerStart, ce: swap.coworkerEnd, note: swap.note,
  }
  return `${appUrl()}#${PARAM}=${encode(payload)}`
}

export function answerLink(incoming: IncomingSwap, ok: boolean, by: string, note: string): string {
  return `${appUrl()}#${PARAM}=${encode({ t: 'ans', id: incoming.id, ok, by, note })}`
}

/** Reads a request/answer from a URL hash such as "#cambio=…"; null if there is none or it is broken. */
export function readLink(hash: string): LinkPayload | null {
  const m = hash.match(new RegExp(`${PARAM}=([A-Za-z0-9_-]+)`))
  if (!m) return null
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const data = JSON.parse(new TextDecoder().decode(bytes)) as LinkPayload
    if (data.t === 'req' && data.id && data.date && data.start && data.end) return data
    if (data.t === 'ans' && data.id && typeof data.ok === 'boolean') return data
  } catch {
    // Truncated or edited link.
  }
  return null
}

export function incomingFromRequest(p: RequestPayload): IncomingSwap {
  return {
    id: p.id, kind: p.kind, from: p.from, to: p.to, date: p.date, start: p.start, end: p.end, role: p.role,
    coworkerStart: p.cs, coworkerEnd: p.ce, note: p.note, status: 'pendiente', receivedAt: Date.now(),
  }
}
