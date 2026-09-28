import { useMemo, useState } from 'react'
import type { Shift } from '../types'
import { MONTHS, formatDuration, fromISO, nightMinutes, shiftMinutes, todayISO, weekStart } from '../lib/time'

/** Monthly totals: hours, night hours, shifts, flights and a per-week breakdown. */
export function HoursTab({ shifts }: { shifts: Shift[] }) {
  const [cursor, setCursor] = useState(() => { const d = fromISO(todayISO()); return { y: d.getFullYear(), m: d.getMonth() } })
  const prefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`
  const month = useMemo(() => shifts.filter((s) => s.date.startsWith(prefix)), [shifts, prefix])

  const total = month.reduce((a, s) => a + shiftMinutes(s.start, s.end), 0)
  const night = month.reduce((a, s) => a + nightMinutes(s.start, s.end), 0)
  const flights = month.reduce((a, s) => a + s.flights.length, 0)
  const byRole = month.reduce<Map<string, number>>((m, s) => m.set(s.role || 'Sin puesto', (m.get(s.role || 'Sin puesto') ?? 0) + shiftMinutes(s.start, s.end)), new Map())
  const byWeek = month.reduce<Map<string, number>>((m, s) => m.set(weekStart(s.date), (m.get(weekStart(s.date)) ?? 0) + shiftMinutes(s.start, s.end)), new Map())
  const maxWeek = Math.max(1, ...byWeek.values())

  const move = (delta: number) => setCursor(({ y, m }) => { const d = new Date(y, m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() } })

  return (
    <div className="tab">
      <div className="month-head">
        <button className="icon-btn" onClick={() => move(-1)} aria-label="Mes anterior">‹</button>
        <h2>{MONTHS[cursor.m]} {cursor.y}</h2>
        <button className="icon-btn" onClick={() => move(1)} aria-label="Mes siguiente">›</button>
      </div>

      <div className="stats">
        <div className="stat"><span className="stat-value">{formatDuration(total)}</span><span className="stat-label">Horas totales</span></div>
        <div className="stat"><span className="stat-value">{month.length}</span><span className="stat-label">Turnos</span></div>
        <div className="stat"><span className="stat-value">{formatDuration(night)}</span><span className="stat-label">Nocturnas (22–06)</span></div>
        <div className="stat"><span className="stat-value">{flights}</span><span className="stat-label">Vuelos atendidos</span></div>
      </div>

      {byWeek.size > 0 && (
        <div className="card">
          <h3>Por semana</h3>
          {[...byWeek].sort(([a], [b]) => a.localeCompare(b)).map(([week, minutes]) => (
            <div className="bar-row" key={week}>
              <span className="bar-label">Sem. {fromISO(week).getDate()}/{fromISO(week).getMonth() + 1}</span>
              <span className="bar"><span style={{ width: `${(minutes / maxWeek) * 100}%` }} /></span>
              <span className="bar-value">{formatDuration(minutes)}</span>
            </div>
          ))}
        </div>
      )}
      {byRole.size > 0 && (
        <div className="card">
          <h3>Por puesto</h3>
          {[...byRole].sort((a, b) => b[1] - a[1]).map(([role, minutes]) => (
            <div className="kv" key={role}><span>{role}</span><b>{formatDuration(minutes)}</b></div>
          ))}
        </div>
      )}
      {!month.length && <p className="empty-state">No hay turnos registrados en este mes.</p>}
    </div>
  )
}
