import { useState } from 'react'
import type { Profile, RosterEntry, Shift, Swap, SwapKind, SwapStatus } from '../types'
import { shareText } from '../lib/store'
import { newSwap, swapCandidates, swapMessage, type Candidate } from '../lib/swaps'
import { formatLongDate, todayISO } from '../lib/time'
import { Sheet } from './Sheet'

type Props = {
  shifts: Shift[]
  roster: RosterEntry[]
  profile: Profile
  swaps: Swap[]
  selectedId: string
  onSelect: (id: string) => void
  onCreate: (swap: Swap) => void
  onStatus: (id: string, status: SwapStatus) => void
  onAccept: (swap: Swap) => void
}

const STATUS_LABEL: Record<SwapStatus, string> = {
  pendiente: 'Pendiente', aceptado: 'Aceptado', rechazado: 'Rechazado', cancelado: 'Cancelado',
}

type Draft = { kind: SwapKind; coworker: string; coworkerStart: string; coworkerEnd: string; note: string }

export function SwapsTab({ shifts, roster, profile, swaps, selectedId, onSelect, onCreate, onStatus, onAccept }: Props) {
  const today = todayISO()
  const upcoming = shifts.filter((s) => s.date >= today)
  const shift = upcoming.find((s) => s.id === selectedId) ?? null
  const [draft, setDraft] = useState<Draft | null>(null)
  const [search, setSearch] = useState('')

  const candidates = shift ? swapCandidates(roster, profile, shift.date, shift.start, shift.end) : []
  const filtered = candidates.filter((c) => c.employee.toLowerCase().includes(search.trim().toLowerCase()))
  const trade = filtered.filter((c) => c.kind === 'intercambio')
  const cover = filtered.filter((c) => c.kind === 'cesion')

  const propose = (c: Candidate) => setDraft({
    kind: c.kind, coworker: c.employee, coworkerStart: c.entry?.start ?? '', coworkerEnd: c.entry?.end ?? '', note: '',
  })

  const pendingSwap = shift && draft
    ? newSwap({ ...draft, date: shift.date, start: shift.start, end: shift.end, role: shift.role })
    : null
  const draftValid = draft && draft.coworker.trim() && (draft.kind === 'cesion' || (draft.coworkerStart && draft.coworkerEnd))

  const send = async () => {
    if (!pendingSwap) return
    onCreate(pendingSwap)
    setDraft(null)
    await shareText(swapMessage(pendingSwap, profile.name))
  }

  const sorted = [...swaps].sort((a, b) => (a.status === 'pendiente' ? 0 : 1) - (b.status === 'pendiente' ? 0 : 1) || b.createdAt - a.createdAt)

  return (
    <div className="tab">
      <div className="card">
        <h3>Pedir un cambio</h3>
        {!upcoming.length ? (
          <p className="hint">No tienes turnos próximos en el calendario.</p>
        ) : (
          <label className="field">
            <span>¿Qué turno quieres cambiar?</span>
            <select value={shift?.id ?? ''} onChange={(e) => onSelect(e.target.value)}>
              <option value="">Elige un turno…</option>
              {upcoming.map((s) => (
                <option key={s.id} value={s.id}>{formatLongDate(s.date)} · {s.start}-{s.end}{s.role && ` · ${s.role}`}</option>
              ))}
            </select>
          </label>
        )}

        {shift && roster.length > 0 && (
          <>
            <input className="search" type="search" placeholder="Buscar compañero…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <CandidateList title="Trabajan en otro horario · intercambio" list={trade} onPick={propose} />
            <CandidateList title="Libres ese día · te pueden cubrir" list={cover} onPick={propose} />
            {!filtered.length && <p className="hint">Nadie disponible en el horario general para ese día.</p>}
          </>
        )}
        {shift && (
          <button className="btn ghost full" onClick={() => setDraft({ kind: 'intercambio', coworker: '', coworkerStart: '', coworkerEnd: '', note: '' })}>
            Escribir el cambio a mano
          </button>
        )}
        {shift && !roster.length && <p className="hint">Carga el horario de la empresa para ver quién puede cambiarte.</p>}
      </div>

      <h3 className="list-title">Mis solicitudes</h3>
      {!sorted.length && <p className="empty-state">Aún no has pedido cambios.</p>}
      {sorted.map((s) => (
        <article className={`swap-card ${s.status}`} key={s.id}>
          <header>
            <div>
              <b className="capitalize">{formatLongDate(s.date)}</b>
              <div className="shift-meta">
                {s.kind === 'intercambio'
                  ? <>Mi {s.start}-{s.end} ⇄ {s.coworkerStart}-{s.coworkerEnd} de <b>{s.coworker}</b></>
                  : <><b>{s.coworker}</b> me cubre {s.start}-{s.end}</>}
              </div>
            </div>
            <span className={`status ${s.status}`}>{STATUS_LABEL[s.status]}</span>
          </header>
          {s.note && <p className="shift-notes">{s.note}</p>}
          {s.status === 'pendiente' && (
            <div className="swap-actions">
              <button className="btn small primary" onClick={() => confirm('¿Confirmas que el cambio está aprobado? Se actualizará tu calendario.') && onAccept(s)}>Aceptado</button>
              <button className="btn small ghost" onClick={() => onStatus(s.id, 'rechazado')}>Rechazado</button>
              <button className="btn small ghost" onClick={() => shareText(swapMessage(s, profile.name))}>Reenviar</button>
              <button className="btn small ghost danger" onClick={() => onStatus(s.id, 'cancelado')}>Cancelar</button>
            </div>
          )}
        </article>
      ))}

      {draft && shift && (
        <Sheet title="Proponer cambio" onClose={() => setDraft(null)}>
          <p className="hint capitalize">{formatLongDate(shift.date)} · tu turno {shift.start}-{shift.end}</p>
          <div className="segmented">
            {(['intercambio', 'cesion'] as const).map((k) => (
              <button key={k} className={draft.kind === k ? 'active' : ''} onClick={() => setDraft({ ...draft, kind: k })}>
                {k === 'intercambio' ? 'Intercambiar turnos' : 'Que me cubra'}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Compañero/a</span>
            <input value={draft.coworker} onChange={(e) => setDraft({ ...draft, coworker: e.target.value })} />
          </label>
          {draft.kind === 'intercambio' && (
            <div className="row-2">
              <label className="field">
                <span>Su entrada</span>
                <input type="time" value={draft.coworkerStart} onChange={(e) => setDraft({ ...draft, coworkerStart: e.target.value })} />
              </label>
              <label className="field">
                <span>Su salida</span>
                <input type="time" value={draft.coworkerEnd} onChange={(e) => setDraft({ ...draft, coworkerEnd: e.target.value })} />
              </label>
            </div>
          )}
          <label className="field">
            <span>Mensaje (opcional)</span>
            <textarea rows={2} value={draft.note} placeholder="Te lo devuelvo cuando quieras 🙂" onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </label>
          {pendingSwap && draftValid && <pre className="message-preview">{swapMessage(pendingSwap, profile.name)}</pre>}
          <div className="actions">
            <button className="btn primary" disabled={!draftValid} onClick={send}>Guardar y enviar</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

function CandidateList({ title, list, onPick }: { title: string; list: Candidate[]; onPick: (c: Candidate) => void }) {
  if (!list.length) return null
  return (
    <section className="roster-group">
      <h4>{title} <span className="muted">· {list.length}</span></h4>
      <ul>
        {list.map((c) => (
          <li key={c.employee}>
            <span className="grow">{c.employee}</span>
            <span className="muted">
              {c.entry?.start ? `${c.entry.start}-${c.entry.end}${c.entry.role ? ` · ${c.entry.role}` : ''}` : c.entry?.label || 'Libre'}
            </span>
            <button className="btn small" onClick={() => onPick(c)}>Proponer</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
