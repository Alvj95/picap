import { useMemo, useState } from 'react'
import type { RosterEntry, Shift } from '../types'
import { shiftsToICS } from '../lib/ics'
import { roleColor } from '../lib/roles'
import { downloadFile } from '../lib/store'
import {
  MONTHS, WEEKDAYS, addDays, endsNextDay, formatDuration, formatLongDate, fromISO, monthGrid, shiftMinutes, todayISO, uid,
} from '../lib/time'
import { ShiftForm } from './ShiftForm'

type Props = {
  shifts: Shift[]
  myRoster: RosterEntry[] // my own lines in the company schedule (days off, vacations…)
  onSave: (shift: Shift) => void
  onDelete: (id: string) => void
  onSwap: (shift: Shift) => void
}

const SOURCE_LABEL = { manual: 'Añadido por mí', empresa: 'Horario empresa', cambio: 'Cambio de turno' }

export function CalendarTab({ shifts, myRoster, onSave, onDelete, onSwap }: Props) {
  const today = todayISO()
  const [cursor, setCursor] = useState(() => { const d = fromISO(today); return { y: d.getFullYear(), m: d.getMonth() } })
  const [selected, setSelected] = useState(today)
  const [editing, setEditing] = useState<{ shift: Shift; isNew: boolean } | null>(null)

  const byDate = useMemo(() => {
    const map = new Map<string, Shift[]>()
    for (const s of shifts) map.set(s.date, [...(map.get(s.date) ?? []), s])
    return map
  }, [shifts])
  const labels = useMemo(() => new Map(myRoster.filter((e) => e.label).map((e) => [e.date, e.label])), [myRoster])

  const next = shifts.find((s) => s.date >= today)
  const dayShifts = byDate.get(selected) ?? []
  const weeks = monthGrid(cursor.y, cursor.m)

  const move = (delta: number) => setCursor(({ y, m }) => {
    const d = new Date(y, m + delta, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  /** Select a day and bring its month into view. */
  const select = (iso: string) => {
    const d = fromISO(iso)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
    setSelected(iso)
  }

  const addShift = () => setEditing({
    isNew: true,
    shift: { id: uid(), date: selected, start: '', end: '', role: '', flights: [], notes: '', source: 'manual' },
  })

  const exportMonth = () => {
    const prefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`
    const list = shifts.filter((s) => s.date.startsWith(prefix))
    if (!list.length) return alert('No hay turnos en este mes.')
    downloadFile(`turnos-${prefix}.ics`, shiftsToICS(list), 'text/calendar')
  }

  return (
    <div className="tab">
      {next && (
        <button className="next-card" onClick={() => select(next.date)}>
          <span className="next-kicker">{next.date === today ? 'Hoy trabajas' : 'Próximo turno'}</span>
          <span className="next-time">{next.start} – {next.end}</span>
          <span className="next-meta">
            {formatLongDate(next.date)}{next.role && ` · ${next.role}`}
            {next.flights.length > 0 && ` · ${next.flights.length} vuelo${next.flights.length > 1 ? 's' : ''}`}
          </span>
        </button>
      )}

      <div className="month-head">
        <button className="icon-btn" onClick={() => move(-1)} aria-label="Mes anterior">‹</button>
        <h2>{MONTHS[cursor.m]} {cursor.y}</h2>
        <button className="icon-btn" onClick={() => move(1)} aria-label="Mes siguiente">›</button>
        <button className="btn small ghost" onClick={() => select(today)}>Hoy</button>
      </div>

      <div className="calendar" role="grid">
        {WEEKDAYS.map((d) => <div className="cal-weekday" key={d}>{d}</div>)}
        {weeks.flat().map((iso, i) => {
          if (!iso) return <div className="cal-cell empty" key={`e${i}`} />
          const list = byDate.get(iso) ?? []
          const label = labels.get(iso)
          return (
            <button
              key={iso}
              className={`cal-cell${iso === selected ? ' selected' : ''}${iso === today ? ' today' : ''}`}
              onClick={() => setSelected(iso)}
              aria-label={`${formatLongDate(iso)}${list.length ? `, ${list.length} turno` : ''}`}
            >
              <span className="cal-day">{fromISO(iso).getDate()}</span>
              {list.slice(0, 2).map((s) => (
                <span className="cal-chip" key={s.id} style={{ background: roleColor(s.role) }}>{s.start}</span>
              ))}
              {!list.length && label && <span className="cal-label">{label.slice(0, 5)}</span>}
            </button>
          )
        })}
      </div>

      <div className="day-panel">
        <div className="section-title">
          <h3 className="capitalize">{formatLongDate(selected)}</h3>
          <button className="btn small primary" onClick={addShift}>+ Turno</button>
        </div>
        {!dayShifts.length && (
          <p className="empty-state">{labels.get(selected) ? `En el horario: ${labels.get(selected)}` : 'Sin turnos este día.'}</p>
        )}
        {dayShifts.map((s) => (
          <article className="shift-card" key={s.id} style={{ borderLeftColor: roleColor(s.role) }}>
            <header>
              <div>
                <div className="shift-time">{s.start} – {s.end}{endsNextDay(s.start, s.end) && <small> (+1)</small>}</div>
                <div className="shift-meta">
                  {s.role || 'Sin puesto'} · {formatDuration(shiftMinutes(s.start, s.end))} · <span className={`tag ${s.source}`}>{SOURCE_LABEL[s.source]}</span>
                </div>
              </div>
              <div className="shift-actions">
                <button className="btn small ghost" onClick={() => setEditing({ shift: s, isNew: false })}>Editar</button>
                {s.date >= today && <button className="btn small ghost" onClick={() => onSwap(s)}>Cambiar</button>}
              </div>
            </header>
            {s.flights.length > 0 && (
              <ul className="flight-list">
                {s.flights.map((f) => (
                  <li key={f.id}>
                    <b>{f.number}</b>
                    <span>{f.destination}</span>
                    <span>{f.std && `STD ${f.std}`}</span>
                    <span className="muted">{f.counters && `Mostr. ${f.counters}`}</span>
                  </li>
                ))}
              </ul>
            )}
            {s.notes && <p className="shift-notes">{s.notes}</p>}
          </article>
        ))}
        <div className="day-nav">
          <button className="btn small ghost" onClick={() => select(addDays(selected, -1))}>‹ Día anterior</button>
          <button className="btn small ghost" onClick={() => select(addDays(selected, 1))}>Día siguiente ›</button>
        </div>
      </div>

      <button className="btn ghost full" onClick={exportMonth}>📅 Exportar {MONTHS[cursor.m].toLowerCase()} a mi calendario (.ics)</button>

      {editing && (
        <ShiftForm
          shift={editing.shift}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSave={(s) => { onSave(s); select(s.date); setEditing(null) }}
          onDelete={(id) => { onDelete(id); setEditing(null) }}
        />
      )}
    </div>
  )
}
