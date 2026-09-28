import { useMemo, useState } from 'react'
import type { Profile, RosterEntry } from '../types'
import { isMe, isWorking, parseRoster, type ParseResult } from '../lib/roster'
import { roleColor } from '../lib/roles'
import { downloadFile } from '../lib/store'
import { MONTHS, addDays, formatLongDate, fromISO, todayISO } from '../lib/time'

type Props = {
  roster: RosterEntry[]
  rosterName: string
  importedAt: number | null
  profile: Profile
  onImport: (result: ParseResult, name: string, myName: string) => void
  onSyncMine: () => void
}

const TEMPLATE = [
  'Fecha;Empleado;Entrada;Salida;Puesto;Vuelos',
  '05/10/2026;Ana Pérez;05:00;13:00;Check-in;IB6401 MAD 07:30, UX1093 LIS 09:10',
  '05/10/2026;Luis Gómez;13:00;21:00;Embarque;AV011 BOG 16:45',
  '05/10/2026;Marta Ruiz;LIBRE;;;',
  '06/10/2026;Ana Pérez;22:00;06:00;Rampa;',
].join('\n')

export function RosterTab({ roster, rosterName, importedAt, profile, onImport, onSyncMine }: Props) {
  const [importing, setImporting] = useState(roster.length === 0)
  const [day, setDay] = useState(() => {
    const today = todayISO()
    const dates = [...new Set(roster.map((e) => e.date))]
    return dates.includes(today) || !dates.length ? today : dates.find((d) => d >= today) ?? dates[0]
  })
  const [query, setQuery] = useState('')

  const mine = useMemo(() => roster.filter((e) => isWorking(e) && isMe(e.employee, profile)), [roster, profile])
  const range = useMemo(() => {
    const dates = roster.map((e) => e.date).sort()
    return dates.length ? [dates[0], dates[dates.length - 1]] : null
  }, [roster])

  const dayEntries = useMemo(() => {
    const q = query.trim().toLowerCase()
    return roster.filter((e) => e.date === day && (!q || e.employee.toLowerCase().includes(q) || e.role.toLowerCase().includes(q)))
  }, [roster, day, query])
  const working = dayEntries.filter(isWorking).sort((a, b) => a.start.localeCompare(b.start) || a.employee.localeCompare(b.employee, 'es'))
  const off = dayEntries.filter((e) => !isWorking(e))
  const groups = working.reduce<Map<string, RosterEntry[]>>((map, e) => {
    const key = `${e.start} – ${e.end}`
    return map.set(key, [...(map.get(key) ?? []), e])
  }, new Map())

  if (importing) {
    return (
      <ImportPanel
        profile={profile}
        hasRoster={roster.length > 0}
        onCancel={() => setImporting(false)}
        onImport={(result, name, myName) => {
          onImport(result, name, myName)
          setImporting(false)
          setDay(result.entries.find((e) => e.date >= todayISO())?.date ?? result.entries[0].date)
        }}
      />
    )
  }

  return (
    <div className="tab">
      <div className="card">
        <div className="section-title">
          <div>
            <h3>{rosterName || 'Horario general'}</h3>
            <p className="hint">
              {range && `Del ${formatLongDate(range[0])} al ${formatLongDate(range[1])}`}
              {importedAt && ` · cargado el ${new Date(importedAt).toLocaleDateString('es')}`}
            </p>
          </div>
          <button className="btn small ghost" onClick={() => setImporting(true)}>Actualizar</button>
        </div>
        {profile.name ? (
          <p className="hint">
            {mine.length
              ? <>Encontré <b>{mine.length} turnos</b> tuyos ({profile.name}).</>
              : <>No encuentro a <b>{profile.name}</b> en este horario. Revisa tu nombre en el perfil.</>}
          </p>
        ) : <p className="hint">Pon tu nombre en el perfil (arriba a la derecha) para encontrar tus turnos.</p>}
        {mine.length > 0 && <button className="btn primary full" onClick={onSyncMine}>Pasar mis turnos al calendario</button>}
      </div>

      <div className="month-head">
        <button className="icon-btn" onClick={() => setDay(addDays(day, -1))} aria-label="Día anterior">‹</button>
        <label className="date-pick">
          <span className="capitalize">{formatLongDate(day)}</span>
          <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </label>
        <button className="icon-btn" onClick={() => setDay(addDays(day, 1))} aria-label="Día siguiente">›</button>
      </div>
      <input className="search" type="search" placeholder="Buscar compañero o puesto…" value={query} onChange={(e) => setQuery(e.target.value)} />

      {!dayEntries.length && <p className="empty-state">No hay nadie en el horario este día.</p>}
      {[...groups].map(([time, list]) => (
        <section className="roster-group" key={time}>
          <h4>{time} <span className="muted">· {list.length}</span></h4>
          <ul>
            {list.map((e, i) => (
              <li key={i} className={isMe(e.employee, profile) ? 'me' : ''}>
                <span className="dot" style={{ background: roleColor(e.role) }} />
                <span className="grow">{e.employee}{isMe(e.employee, profile) && ' (tú)'}</span>
                <span className="muted">{e.role}</span>
                {e.flights && <span className="flights-inline">{e.flights}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {off.length > 0 && (
        <section className="roster-group off">
          <h4>No trabajan <span className="muted">· {off.length}</span></h4>
          <ul>
            {off.map((e, i) => (
              <li key={i} className={isMe(e.employee, profile) ? 'me' : ''}>
                <span className="grow">{e.employee}</span>
                <span className="tag">{e.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function ImportPanel({ profile, hasRoster, onCancel, onImport }: {
  profile: Profile
  hasRoster: boolean
  onCancel: () => void
  onImport: (result: ParseResult, name: string, myName: string) => void
}) {
  const now = new Date()
  const [ref, setRef] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<ParseResult | null>(null)
  const [myName, setMyName] = useState('')

  const readFile = async (file: File) => {
    if (/\.xlsx?$/i.test(file.name)) {
      setError('Para Excel: abre el archivo, selecciona la tabla, cópiala y pégala abajo (o guárdalo como CSV).')
      return
    }
    setName(file.name.replace(/\.[^.]+$/, ''))
    setText(await file.text())
    setResult(null)
  }

  const analyze = () => {
    setError('')
    try {
      const parsed = parseRoster(text, ref.y, ref.m)
      setResult(parsed)
      setMyName(parsed.employees.find((e) => isMe(e, profile)) ?? '')
      if (!name) setName(`Horario ${MONTHS[fromISO(parsed.entries[0].date).getMonth()].toLowerCase()}`)
    } catch (err) {
      setResult(null)
      setError((err as Error).message)
    }
  }

  return (
    <div className="tab">
      <div className="card">
        <h3>Cargar horario de la empresa</h3>
        <p className="hint">
          Sube el archivo CSV o copia la tabla desde Excel y pégala aquí. Funciona con una fila por turno
          (Fecha, Empleado, Entrada, Salida, Puesto, Vuelos) o con el cuadrante mensual (empleados en filas y
          días en columnas, con celdas tipo <code>06:00-14:00</code> o <code>LIBRE</code>).
        </p>
        <button className="btn small ghost" onClick={() => downloadFile('plantilla-horario.csv', TEMPLATE, 'text/csv')}>Descargar plantilla</button>
      </div>

      <label className="field">
        <span>Archivo (CSV)</span>
        <input type="file" accept=".csv,.tsv,.txt,.xls,.xlsx,text/csv,text/plain" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
      </label>
      <label className="field">
        <span>…o pega la tabla</span>
        <textarea rows={7} className="mono" value={text} placeholder={TEMPLATE} onChange={(e) => { setText(e.target.value); setResult(null) }} />
      </label>
      <div className="row-2">
        <label className="field">
          <span>Mes del horario</span>
          <select value={ref.m} onChange={(e) => setRef({ ...ref, m: +e.target.value })}>
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Año</span>
          <input type="number" value={ref.y} onChange={(e) => setRef({ ...ref, y: +e.target.value })} />
        </label>
      </div>
      <p className="hint">El mes y año solo se usan si las fechas del horario no los indican (p. ej. columnas “1, 2, 3…”).</p>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="card">
          <h3>Vista previa</h3>
          <p className="hint">
            Formato: <b>{result.format}</b> · {result.entries.filter(isWorking).length} turnos · {result.employees.length} personas
          </p>
          {result.warnings.length > 0 && (
            <details className="warnings">
              <summary>{result.warnings.length} fila(s) ignoradas</summary>
              <ul>{result.warnings.slice(0, 20).map((w) => <li key={w}>{w}</li>)}</ul>
            </details>
          )}
          <label className="field">
            <span>¿Quién eres tú en este horario?</span>
            <select value={myName} onChange={(e) => setMyName(e.target.value)}>
              <option value="">— No aparezco / elegir después —</option>
              {result.employees.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Nombre del horario</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </div>
      )}

      <div className="actions">
        {hasRoster && <button className="btn ghost" onClick={onCancel}>Cancelar</button>}
        {result
          ? <button className="btn primary" onClick={() => onImport(result, name, myName)}>Guardar horario</button>
          : <button className="btn primary" disabled={!text.trim()} onClick={analyze}>Revisar horario</button>}
      </div>
    </div>
  )
}
