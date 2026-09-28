import { useState } from 'react'
import type { IncomingSwap, Profile, RosterEntry, Shift, Swap, SwapKind, SwapStatus } from '../types'
import { shareText } from '../lib/store'
import { answerMessage, mailtoUrl, newSwap, schedulingEmail, swapCandidates, swapMessage, type Candidate } from '../lib/swaps'
import { formatLongDate, todayISO } from '../lib/time'
import { Sheet } from './Sheet'

type Props = {
  shifts: Shift[]
  roster: RosterEntry[]
  profile: Profile
  swaps: Swap[]
  incoming: IncomingSwap[]
  selectedId: string
  onSelect: (id: string) => void
  onCreate: (swap: Swap) => void
  onUpdate: (id: string, patch: Partial<Swap>) => void
  onApprove: (swap: Swap) => void
  onSchedulingEmail: (email: string) => void
  onAnswer: (id: string, ok: boolean) => void
  onApplyIncoming: (incoming: IncomingSwap) => void
}

const STATUS_LABEL: Record<SwapStatus, string> = {
  pendiente: 'Esperando compañero',
  aceptado_companero: 'Aceptado por compañero',
  enviado_programacion: 'En programación',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  denegado: 'Denegado',
  cancelado: 'Cancelado',
}
const STEPS: SwapStatus[] = ['pendiente', 'aceptado_companero', 'enviado_programacion', 'aprobado']
const STEP_LABEL = ['Enviada', 'Compañero', 'Programación', 'Aprobado']
const FINAL: SwapStatus[] = ['aprobado', 'rechazado', 'denegado', 'cancelado']

type Draft = { kind: SwapKind; coworker: string; coworkerStart: string; coworkerEnd: string; note: string }

const when = (t: number | null) => (t ? new Date(t).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) : '')

export function SwapsTab(props: Props) {
  const { shifts, roster, profile, swaps, incoming, selectedId, onSelect, onCreate } = props
  const today = todayISO()
  const upcoming = shifts.filter((s) => s.date >= today)
  const shift = upcoming.find((s) => s.id === selectedId) ?? null
  const [draft, setDraft] = useState<Draft | null>(null)
  const [search, setSearch] = useState('')
  const [answering, setAnswering] = useState<{ item: IncomingSwap; ok: boolean } | null>(null)

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

  const rank = (i: IncomingSwap) => (i.status === 'pendiente' || i.status === 'aceptado' ? 0 : 1)
  const sent = [...swaps].sort((a, b) => b.createdAt - a.createdAt)
  const activeSent = sent.filter((s) => !FINAL.includes(s.status))
  const pastSent = sent.filter((s) => FINAL.includes(s.status))
  const received = [...incoming].sort((a, b) => rank(a) - rank(b) || b.receivedAt - a.receivedAt)
  const toAnswer = incoming.filter((i) => i.status === 'pendiente').length

  return (
    <div className="tab">
      {received.length > 0 && (
        <>
          <h3 className="list-title">Solicitudes recibidas {toAnswer > 0 && <span className="count">{toAnswer}</span>}</h3>
          {received.map((i) => (
            <IncomingCard key={i.id} item={i} onAnswer={(ok) => setAnswering({ item: i, ok })} onApply={() => props.onApplyIncoming(i)} />
          ))}
        </>
      )}

      {activeSent.length > 0 && (
        <>
          <h3 className="list-title">Mis solicitudes en curso</h3>
          {activeSent.map((s) => <SentCard key={s.id} swap={s} {...props} />)}
        </>
      )}

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

      {!sent.length && <p className="empty-state">Aún no has pedido cambios.</p>}
      {pastSent.length > 0 && (
        <>
          <h3 className="list-title">Historial</h3>
          {pastSent.map((s) => <SentCard key={s.id} swap={s} {...props} />)}
        </>
      )}

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
          <p className="hint">Tu compañero recibirá un enlace para aceptar o rechazar. Cuando acepte, te aparecerá el botón para enviar el correo a programación.</p>
          <div className="actions">
            <button className="btn primary" disabled={!draftValid} onClick={send}>Enviar solicitud</button>
          </div>
        </Sheet>
      )}

      {answering && (
        <AnswerSheet
          item={answering.item}
          ok={answering.ok}
          me={profile.name}
          onClose={() => setAnswering(null)}
          onSend={async (note) => {
            props.onAnswer(answering.item.id, answering.ok)
            setAnswering(null)
            await shareText(answerMessage(answering.item, answering.ok, profile.name, note))
          }}
        />
      )}
    </div>
  )
}

function Steps({ status }: { status: SwapStatus }) {
  const at = STEPS.indexOf(status)
  if (at < 0) return null
  return (
    <ol className="steps">
      {STEP_LABEL.map((label, i) => <li key={label} className={i <= at ? 'done' : ''}>{label}</li>)}
    </ol>
  )
}

function SentCard({ swap: s, profile, onUpdate, onApprove, onSchedulingEmail }: Props & { swap: Swap }) {
  const [email, setEmail] = useState(profile.schedulingEmail)
  const [copied, setCopied] = useState(false)
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim())
  const mail = schedulingEmail(s, { ...profile, schedulingEmail: email.trim() })

  const sendEmail = () => {
    if (email.trim() !== profile.schedulingEmail) onSchedulingEmail(email.trim())
    window.location.href = mailtoUrl(mail)
    onUpdate(s.id, { status: 'enviado_programacion', emailedAt: Date.now() })
  }
  const copyEmail = async () => {
    await navigator.clipboard?.writeText(`Para: ${mail.to}\nAsunto: ${mail.subject}\n\n${mail.body}`).catch(() => {})
    setCopied(true)
  }

  return (
    <article className={`swap-card ${s.status}`}>
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
      <Steps status={s.status} />
      {s.note && <p className="shift-notes">Tú: {s.note}</p>}
      {s.reply && <p className="shift-notes">{s.coworker}: {s.reply}</p>}

      {s.status === 'pendiente' && (
        <div className="swap-actions">
          <button className="btn small ghost" onClick={() => shareText(swapMessage(s, profile.name))}>Reenviar solicitud</button>
          <button className="btn small ghost" onClick={() => onUpdate(s.id, { status: 'aceptado_companero', answeredAt: Date.now() })}>Aceptó por otro medio</button>
          <button className="btn small ghost danger" onClick={() => onUpdate(s.id, { status: 'cancelado' })}>Cancelar</button>
        </div>
      )}

      {s.status === 'aceptado_companero' && (
        <div className="callout">
          <p>✅ <b>{s.coworker}</b> aceptó el cambio{s.answeredAt && ` el ${when(s.answeredAt)}`}. Ahora envíalo a programación para que lo apruebe.</p>
          {!profile.schedulingEmail && (
            <label className="field">
              <span>Correo de programación (solo la primera vez)</span>
              <input type="email" inputMode="email" placeholder="programacion@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          )}
          <button className="btn primary full" disabled={!validEmail} onClick={sendEmail}>✉️ Enviar correo a programación</button>
          {validEmail && <p className="hint">Se abrirá tu app de correo con el mensaje listo para <b>{email.trim()}</b>.</p>}
          <details className="email-preview">
            <summary>Ver el correo</summary>
            <p><b>Asunto:</b> {mail.subject}</p>
            <pre>{mail.body}</pre>
            <button className="btn small ghost" onClick={copyEmail}>{copied ? 'Copiado ✓' : 'Copiar texto'}</button>
          </details>
          <button className="btn small ghost danger" onClick={() => onUpdate(s.id, { status: 'cancelado' })}>Cancelar cambio</button>
        </div>
      )}

      {s.status === 'enviado_programacion' && (
        <>
          <p className="hint">Enviado a programación el {when(s.emailedAt)}. Cuando te respondan, márcalo aquí.</p>
          <div className="swap-actions">
            <button className="btn small primary" onClick={() => confirm('¿Programación aprobó el cambio? Se actualizará tu calendario.') && onApprove(s)}>Programación lo aprobó</button>
            <button className="btn small ghost danger" onClick={() => onUpdate(s.id, { status: 'denegado' })}>Lo denegó</button>
            <button className="btn small ghost" onClick={sendEmail}>Reenviar correo</button>
          </div>
        </>
      )}
      {s.status === 'aprobado' && (
        <p className="hint">Cambio aplicado a tu calendario. Recuérdale a {s.coworker} que también lo marque como aprobado en su app.</p>
      )}
    </article>
  )
}

function IncomingCard({ item: i, onAnswer, onApply }: { item: IncomingSwap; onAnswer: (ok: boolean) => void; onApply: () => void }) {
  const label = { pendiente: 'Por responder', aceptado: 'Aceptada', rechazado: 'Rechazada', aplicado: 'Aprobada' }[i.status]
  return (
    <article className={`swap-card incoming ${i.status}`}>
      <header>
        <div>
          <b className="capitalize">{formatLongDate(i.date)}</b>
          <div className="shift-meta">
            {i.kind === 'intercambio'
              ? <><b>{i.from}</b> te propone: tú harías su {i.start}-{i.end}{i.role && ` (${i.role})`} y {i.from} tu {i.coworkerStart}-{i.coworkerEnd}</>
              : <><b>{i.from}</b> te pide que le cubras {i.start}-{i.end}{i.role && ` (${i.role})`}</>}
          </div>
        </div>
        <span className={`status ${i.status === 'pendiente' ? 'pendiente' : i.status === 'rechazado' ? 'rechazado' : 'aceptado_companero'}`}>{label}</span>
      </header>
      {i.note && <p className="shift-notes">{i.from}: {i.note}</p>}
      {i.status === 'pendiente' && (
        <div className="swap-actions">
          <button className="btn small primary" onClick={() => onAnswer(true)}>Aceptar</button>
          <button className="btn small ghost danger" onClick={() => onAnswer(false)}>Rechazar</button>
        </div>
      )}
      {i.status === 'aceptado' && (
        <>
          <p className="hint">{i.from} lo enviará a programación. Cuando lo aprueben, actualiza tu calendario.</p>
          <div className="swap-actions">
            <button className="btn small primary" onClick={() => confirm('¿Programación aprobó el cambio? Se actualizará tu calendario.') && onApply()}>Programación lo aprobó</button>
          </div>
        </>
      )}
    </article>
  )
}

function AnswerSheet({ item, ok, me, onClose, onSend }: {
  item: IncomingSwap; ok: boolean; me: string; onClose: () => void; onSend: (note: string) => void
}) {
  const [note, setNote] = useState('')
  return (
    <Sheet title={ok ? 'Aceptar cambio' : 'Rechazar cambio'} onClose={onClose}>
      <p className="hint capitalize">{formatLongDate(item.date)} · {item.from}</p>
      <label className="field">
        <span>Mensaje para {item.from} (opcional)</span>
        <textarea rows={2} value={note} placeholder={ok ? 'Sin problema 👍' : 'Ese día no puedo, lo siento'} onChange={(e) => setNote(e.target.value)} />
      </label>
      {!me && <p className="error">Pon tu nombre en el perfil para que {item.from} sepa quién responde.</p>}
      <p className="hint">Se enviará a {item.from} un enlace con tu respuesta{ok && '; con él le aparecerá el botón para mandar el correo a programación'}.</p>
      <div className="actions">
        <button className={`btn ${ok ? 'primary' : 'danger'}`} onClick={() => onSend(note.trim())}>{ok ? 'Aceptar y responder' : 'Rechazar y responder'}</button>
      </div>
    </Sheet>
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
