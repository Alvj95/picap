import { useEffect, useRef, useState } from 'react'
import { nativeGestures } from './lib/ble'
import { commonPrefix, onRingInput } from './lib/ringInput'
import type { GestureAction } from './lib/store'

export const GESTURE_ACTIONS: { id: GestureAction; label: string; icon: string }[] = [
  { id: 'playpause', label: 'Pausar / reanudar música', icon: '⏯️' },
  { id: 'next', label: 'Siguiente canción', icon: '⏭️' },
  { id: 'previous', label: 'Canción anterior', icon: '⏮️' },
  { id: 'volup', label: 'Subir volumen', icon: '🔊' },
  { id: 'voldown', label: 'Bajar volumen', icon: '🔉' },
  { id: 'workout', label: 'Empezar / terminar entreno', icon: '🏃' },
]

/**
 * Teach the app the ring's gestures (each one twice, to ignore counters inside the packet) and map them to actions.
 * Also a live detector of everything the ring sends on its own, to discover sport-mode or other events.
 */
export function GesturesScreen(props: { connected: boolean; gestures: Record<string, GestureAction>; onChange: (g: Record<string, GestureAction>) => void; onClose: () => void }) {
  const [learning, setLearning] = useState<GestureAction>()
  const [first, setFirst] = useState<string>()
  const [events, setEvents] = useState<{ t: number; hex: string; match?: GestureAction }[]>([])
  const [msg, setMsg] = useState<string>()
  const ref = useRef({ learning, first, gestures: props.gestures, onChange: props.onChange })
  ref.current = { learning, first, gestures: props.gestures, onChange: props.onChange }

  useEffect(
    () =>
      onRingInput((hex) => {
        const { learning, first, gestures, onChange } = ref.current
        const match = Object.entries(gestures).find(([pre]) => hex.startsWith(pre))?.[1]
        setEvents((e) => [{ t: Date.now(), hex, match }, ...e].slice(0, 40))
        if (!learning) return
        if (!first) {
          setFirst(hex)
          navigator.vibrate?.(40)
          return
        }
        const prefix = commonPrefix(first, hex)
        setFirst(undefined)
        setLearning(undefined)
        if (!prefix) return setMsg('Los dos gestos fueron distintos. Inténtalo otra vez haciendo el mismo gesto.')
        const next = Object.fromEntries(Object.entries(gestures).filter(([, a]) => a !== learning))
        next[prefix] = learning
        onChange(next)
        navigator.vibrate?.([40, 60, 40])
        setMsg(`Gesto guardado para “${GESTURE_ACTIONS.find((a) => a.id === learning)?.label}”.`)
      }),
    [],
  )

  // Push the media part of the mapping to the native side (it runs even with the screen off).
  useEffect(() => {
    void nativeGestures?.set(Object.fromEntries(Object.entries(props.gestures).filter(([, a]) => a !== 'workout')))
  }, [props.gestures])

  const sigFor = (a: GestureAction) => Object.entries(props.gestures).find(([, x]) => x === a)?.[0]

  return (
    <div className="screen">
      <div className="screen-top">
        <button className="pill" onClick={props.onClose}>
          ✕ Cerrar
        </button>
        <span className="muted">Gestos del anillo</span>
      </div>
      <div className="content">
        {!props.connected && <div className="notice error">Conecta el anillo para enseñarle gestos.</div>}
        {learning ? (
          <section className="card glass center">
            <p className="phase">{first ? '¡Otra vez!' : 'Haz el gesto'}</p>
            <p className="muted">
              {first ? 'Repite el mismo gesto en el anillo para confirmarlo.' : `Haz en el anillo el toque o gesto que quieras usar para “${GESTURE_ACTIONS.find((a) => a.id === learning)?.label}”.`}
            </p>
            <button
              className="link"
              onClick={() => {
                setLearning(undefined)
                setFirst(undefined)
              }}
            >
              Cancelar
            </button>
          </section>
        ) : (
          msg && <div className="notice info">{msg}</div>
        )}

        <section className="card">
          <h2>Acciones</h2>
          <p className="muted small">
            {nativeGestures
              ? 'Los controles de música funcionan con cualquier app (Spotify, YouTube…), incluso con la pantalla apagada mientras el anillo esté conectado.'
              : 'En la versión web solo funciona “Empezar / terminar entreno”. Los controles de música necesitan la app de Android.'}
          </p>
          <ul className="gesture-list">
            {GESTURE_ACTIONS.map((a) => {
              const sig = sigFor(a.id)
              return (
                <li key={a.id}>
                  <span className="g-icon">{a.icon}</span>
                  <span className="grow">
                    <b>{a.label}</b>
                    <small>{sig ? `Gesto aprendido · ${sig}` : 'Sin gesto'}</small>
                  </span>
                  {sig ? (
                    <button className="link danger-text" onClick={() => props.onChange(Object.fromEntries(Object.entries(props.gestures).filter(([k]) => k !== sig)))}>
                      Quitar
                    </button>
                  ) : (
                    <button
                      className="btn small-inline"
                      disabled={!props.connected || !!learning}
                      onClick={() => {
                        setMsg(undefined)
                        setLearning(a.id)
                      }}
                    >
                      Enseñar
                    </button>
                  )}
                  {nativeGestures && a.id !== 'workout' && (
                    <button className="link" onClick={() => void nativeGestures?.media(a.id as Exclude<GestureAction, 'workout'>)} aria-label="Probar">
                      ▶
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Detector de eventos</h2>
            {events.length > 0 && (
              <button className="link" onClick={() => setEvents([])}>
                Limpiar
              </button>
            )}
          </div>
          <p className="muted small">
            Todo lo que el anillo envía por su cuenta aparece aquí. Úsalo para descubrir qué manda al tocarlo, hacer gestos o abrir un <b>modo deportivo</b> en el anillo; luego
            asígnalo arriba (por ejemplo, el modo deporte a “Empezar / terminar entreno”).
          </p>
          {events.length === 0 ? (
            <p className="empty">Esperando eventos del anillo…</p>
          ) : (
            <ul className="events">
              {events.map((e) => (
                <li key={e.t + e.hex}>
                  <span>{new Date(e.t).toLocaleTimeString('es', { hour12: false })}</span>
                  <code>{e.hex}</code>
                  {e.match && <em className="tag">{GESTURE_ACTIONS.find((a) => a.id === e.match)?.icon}</em>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
