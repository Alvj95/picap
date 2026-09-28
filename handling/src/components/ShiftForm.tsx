import { useState } from 'react'
import type { Flight, Shift } from '../types'
import { ROLES } from '../lib/roles'
import { endsNextDay, formatDuration, shiftMinutes, uid } from '../lib/time'
import { Sheet } from './Sheet'

const emptyFlight = (): Flight => ({ id: uid(), number: '', destination: '', std: '', counters: '', notes: '' })

type Props = {
  shift: Shift
  isNew: boolean
  onSave: (shift: Shift) => void
  onDelete: (id: string) => void
  onClose: () => void
}

/** Create or edit a shift: entry/exit time, position and the flights to check in. */
export function ShiftForm({ shift, isNew, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState<Shift>(shift)
  const set = <K extends keyof Shift>(key: K, value: Shift[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const setFlight = (id: string, patch: Partial<Flight>) =>
    set('flights', draft.flights.map((f) => (f.id === id ? { ...f, ...patch } : f)))

  const valid = draft.date && draft.start && draft.end
  const minutes = shiftMinutes(draft.start, draft.end)

  const save = () => {
    const flights = draft.flights
      .filter((f) => f.number.trim())
      .map((f) => ({ ...f, number: f.number.trim().toUpperCase().replace(/\s+/g, ''), destination: f.destination.trim().toUpperCase() }))
      .sort((a, b) => a.std.localeCompare(b.std))
    onSave({ ...draft, flights })
  }

  return (
    <Sheet title={isNew ? 'Nuevo turno' : 'Editar turno'} onClose={onClose}>
      <label className="field">
        <span>Fecha</span>
        <input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
      </label>
      <div className="row-2">
        <label className="field">
          <span>Hora de entrada</span>
          <input type="time" value={draft.start} onChange={(e) => set('start', e.target.value)} />
        </label>
        <label className="field">
          <span>Hora de salida</span>
          <input type="time" value={draft.end} onChange={(e) => set('end', e.target.value)} />
        </label>
      </div>
      {valid && (
        <p className="hint">
          Duración: <b>{formatDuration(minutes)}</b>
          {endsNextDay(draft.start, draft.end) && ' · termina al día siguiente'}
        </p>
      )}

      <label className="field">
        <span>Puesto</span>
        <input list="roles" value={draft.role} placeholder="Check-in, Rampa, Embarque…" onChange={(e) => set('role', e.target.value)} />
        <datalist id="roles">{ROLES.map((r) => <option key={r} value={r} />)}</datalist>
      </label>

      <div className="section-title">
        <h3>Vuelos a atender</h3>
        <button className="btn small" onClick={() => set('flights', [...draft.flights, emptyFlight()])}>+ Vuelo</button>
      </div>
      {draft.flights.length === 0 && <p className="hint">Añade los vuelos que te toca hacer (check-in, embarque…).</p>}
      {draft.flights.map((f) => (
        <div className="flight-edit" key={f.id}>
          <div className="row-3">
            <label className="field">
              <span>Vuelo</span>
              <input value={f.number} placeholder="IB6401" autoCapitalize="characters" onChange={(e) => setFlight(f.id, { number: e.target.value })} />
            </label>
            <label className="field">
              <span>Destino</span>
              <input value={f.destination} placeholder="MAD" autoCapitalize="characters" onChange={(e) => setFlight(f.id, { destination: e.target.value })} />
            </label>
            <label className="field">
              <span>Salida (STD)</span>
              <input type="time" value={f.std} onChange={(e) => setFlight(f.id, { std: e.target.value })} />
            </label>
          </div>
          <div className="row-2 align-end">
            <label className="field">
              <span>Mostradores / puerta</span>
              <input value={f.counters} placeholder="12-18" onChange={(e) => setFlight(f.id, { counters: e.target.value })} />
            </label>
            <button className="btn ghost danger" onClick={() => set('flights', draft.flights.filter((x) => x.id !== f.id))}>Quitar</button>
          </div>
        </div>
      ))}

      <label className="field">
        <span>Notas</span>
        <textarea rows={2} value={draft.notes} placeholder="Apertura de mostradores, supervisor, etc." onChange={(e) => set('notes', e.target.value)} />
      </label>

      <div className="actions">
        {!isNew && (
          <button className="btn ghost danger" onClick={() => confirm('¿Eliminar este turno?') && onDelete(draft.id)}>Eliminar</button>
        )}
        <button className="btn primary" disabled={!valid} onClick={save}>Guardar</button>
      </div>
    </Sheet>
  )
}
