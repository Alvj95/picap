import { useEffect, useRef, useState } from 'react'
import { IconHeart, IconPause, IconPlay, IconRoute, IconStop } from './Icons'
import { fmtDuration, fmtPace, gpsAvailable, kmh, SPORTS, Tracker, type Sport, type TrackerState, type Workout } from './lib/gps'
import { ring } from './lib/ring'
import { RouteMap } from './RouteMap'

const tracker = new Tracker()

export function WorkoutTab(props: { connected: boolean; workouts: Workout[]; onSave: (w: Workout) => void; onDelete: (id: number) => void }) {
  const [sport, setSport] = useState<Sport>('run')
  const [st, setSt] = useState<TrackerState>(tracker.state)
  const [hr, setHr] = useState<number>()
  const [open, setOpen] = useState<number>()
  const connectedRef = useRef(props.connected)
  connectedRef.current = props.connected

  useEffect(() => {
    tracker.onChange = setSt
    return () => {
      tracker.onChange = undefined
    }
  }, [])

  // While a workout runs, keep reading heart rate from the ring (one short reading, then a pause).
  useEffect(() => {
    if (!st.running || st.paused) return
    let alive = true
    void (async () => {
      while (alive) {
        if (connectedRef.current) {
          try {
            const v = await ring.measure('hr', (x) => {
              tracker.hr = x
              if (alive) setHr(x)
            }, 3)
            tracker.hr = v
          } catch {
            /* ring busy or off the finger: try again later */
          }
        }
        await new Promise((r) => setTimeout(r, 15000))
      }
    })()
    return () => {
      alive = false
    }
  }, [st.running, st.paused])

  const finish = () => {
    const w = tracker.stop(sport)
    tracker.hr = undefined
    setHr(undefined)
    if (w) props.onSave(w)
  }

  const kcal = Math.round((st.distance / 1000) * SPORTS[sport].kcalPerKm)

  return (
    <>
      {!st.running ? (
        <section className="card glass">
          <h2>Nuevo entreno</h2>
          <div className="seg">
            {(Object.keys(SPORTS) as Sport[]).map((s) => (
              <button key={s} className={sport === s ? 'on' : ''} onClick={() => setSport(s)}>
                {SPORTS[s].label}
              </button>
            ))}
          </div>
          <p className="muted small">
            Usa el GPS del teléfono y, si el anillo está conectado, tu pulso. Mantén la pantalla encendida durante el entreno (la app lo intenta sola).
          </p>
          {!gpsAvailable && <p className="error-text">Este dispositivo no tiene GPS disponible.</p>}
          {st.error && <p className="error-text">{st.error}</p>}
          <button className="btn primary go" disabled={!gpsAvailable} onClick={() => tracker.start()}>
            <IconPlay /> Empezar
          </button>
        </section>
      ) : (
        <section className="card live-workout">
          <RouteMap points={st.points} live />
          <div className="live-main">
            <div>
              <small>Distancia</small>
              <b>{(st.distance / 1000).toFixed(2)}</b>
              <span>km</span>
            </div>
            <div>
              <small>Tiempo</small>
              <b>{fmtDuration(st.duration)}</b>
            </div>
          </div>
          <div className="live-grid">
            <div>
              <small>{sport === 'bike' ? 'Velocidad' : 'Ritmo'}</small>
              <b>{sport === 'bike' ? `${kmh(st.duration, st.distance)} km/h` : `${fmtPace(st.duration, st.distance)} /km`}</b>
            </div>
            <div>
              <small>Pulso</small>
              <b className="hr-text">
                <IconHeart size={14} className={hr ? 'beat' : ''} /> {hr ?? '--'}
              </b>
            </div>
            <div>
              <small>Calorías</small>
              <b>{kcal}</b>
            </div>
          </div>
          {st.error ? <p className="error-text">{st.error}</p> : st.accuracy ? <p className="muted small">Precisión GPS ±{Math.round(st.accuracy)} m</p> : null}
          <div className="row center">
            {st.paused ? (
              <button className="round-btn go" onClick={() => tracker.resume()} aria-label="Reanudar">
                <IconPlay size={26} />
              </button>
            ) : (
              <button className="round-btn" onClick={() => tracker.pause()} aria-label="Pausar">
                <IconPause size={26} />
              </button>
            )}
            <button className="round-btn stop" onClick={finish} aria-label="Terminar">
              <IconStop size={24} />
            </button>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Entrenos</h2>
        {props.workouts.length === 0 && <p className="empty">Aún no hay entrenos guardados.</p>}
        <ul className="workouts">
          {[...props.workouts]
            .sort((a, b) => b.start - a.start)
            .map((w) => (
              <li key={w.id}>
                <button className="workout-row" onClick={() => setOpen(open === w.id ? undefined : w.id)}>
                  <span className={`sport-badge ${w.sport}`}>
                    <IconRoute size={16} />
                  </span>
                  <span className="grow">
                    <b>
                      {SPORTS[w.sport].label} · {(w.distance / 1000).toFixed(2)} km
                    </b>
                    <small>
                      {new Date(w.start).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })} · {Math.max(1, Math.round(w.duration / 60000))} min
                    </small>
                  </span>
                  <small>{w.sport === 'bike' ? `${kmh(w.duration, w.distance)} km/h` : `${fmtPace(w.duration, w.distance)}/km`}</small>
                </button>
                {open === w.id && (
                  <div className="workout-detail">
                    <RouteMap points={w.points} />
                    <div className="stats">
                      <span>
                        Calorías <b>{Math.round((w.distance / 1000) * SPORTS[w.sport].kcalPerKm)}</b>
                      </span>
                      {w.hrAvg && (
                        <span>
                          Pulso medio <b>{w.hrAvg}</b>
                        </span>
                      )}
                      {w.hrMax && (
                        <span>
                          Pulso máx <b>{w.hrMax}</b>
                        </span>
                      )}
                      <button
                        className="link danger-text"
                        onClick={() => {
                          if (confirm('¿Borrar este entreno?')) props.onDelete(w.id)
                        }}
                      >
                        Borrar
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
        </ul>
      </section>
    </>
  )
}
