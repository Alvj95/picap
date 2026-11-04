import { useEffect, useRef, useState } from 'react'
import { IconHeart } from './Icons'
import { ring } from './lib/ring'
import type { BreathSession } from './lib/store'

type Phase = { label: string; seconds: number; scale: number }
const PATTERNS: Record<string, { name: string; desc: string; phases: Phase[] }> = {
  calm: {
    name: 'Calma',
    desc: 'Inhala 4 · exhala 6. Baja el pulso y relaja.',
    phases: [
      { label: 'Inhala', seconds: 4, scale: 1 },
      { label: 'Exhala', seconds: 6, scale: 0.45 },
    ],
  },
  box: {
    name: 'Cuadrada',
    desc: '4 · 4 · 4 · 4. Concentración y control del estrés.',
    phases: [
      { label: 'Inhala', seconds: 4, scale: 1 },
      { label: 'Mantén', seconds: 4, scale: 1 },
      { label: 'Exhala', seconds: 4, scale: 0.45 },
      { label: 'Mantén', seconds: 4, scale: 0.45 },
    ],
  },
  sleep: {
    name: '4-7-8',
    desc: 'Inhala 4 · mantén 7 · exhala 8. Ideal antes de dormir.',
    phases: [
      { label: 'Inhala', seconds: 4, scale: 1 },
      { label: 'Mantén', seconds: 7, scale: 1 },
      { label: 'Exhala', seconds: 8, scale: 0.45 },
    ],
  },
}

type Stage = 'setup' | 'before' | 'running' | 'after' | 'done'

export function BreatheScreen(props: { connected: boolean; onSave: (s: BreathSession) => void; onClose: () => void }) {
  const [pattern, setPattern] = useState<keyof typeof PATTERNS>('calm')
  const [minutes, setMinutes] = useState(3)
  const [stage, setStage] = useState<Stage>('setup')
  const [phase, setPhase] = useState(0)
  const [left, setLeft] = useState(0)
  const [hr, setHr] = useState<number>()
  const [result, setResult] = useState<BreathSession>()
  const before = useRef<number | undefined>(undefined)

  const measure = async () => {
    if (!props.connected) return undefined
    try {
      return await ring.measure('hr', setHr, 5)
    } catch {
      return undefined
    }
  }

  const start = async () => {
    setHr(undefined)
    if (props.connected) {
      setStage('before')
      before.current = await measure()
    }
    setLeft(minutes * 60)
    setPhase(0)
    setStage('running')
  }

  // Session clock.
  useEffect(() => {
    if (stage !== 'running') return
    const iv = setInterval(() => setLeft((l) => l - 1), 1000)
    return () => clearInterval(iv)
  }, [stage])

  // Phase cycling.
  useEffect(() => {
    if (stage !== 'running') return
    const phases = PATTERNS[pattern].phases
    navigator.vibrate?.(phases[phase].label === 'Inhala' ? 60 : 25)
    const t = setTimeout(() => setPhase((p) => (p + 1) % phases.length), phases[phase].seconds * 1000)
    return () => clearTimeout(t)
  }, [stage, phase, pattern])

  useEffect(() => {
    if (stage !== 'running' || left > 0) return
    void (async () => {
      setStage('after')
      setHr(undefined)
      const after = await measure()
      const s: BreathSession = { t: Date.now(), minutes, hrBefore: before.current, hrAfter: after }
      props.onSave(s)
      setResult(s)
      setStage('done')
    })()
  }, [left, stage])

  const p = PATTERNS[pattern].phases[phase]
  const finishEarly = () => setLeft(0)

  return (
    <div className="screen breathe-screen">
      <div className="screen-top">
        <button className="pill" onClick={props.onClose}>
          ✕ Cerrar
        </button>
        <span className="muted">Respiración guiada</span>
      </div>

      {stage === 'setup' && (
        <div className="breathe-setup">
          <div className="seg three">
            {Object.entries(PATTERNS).map(([id, x]) => (
              <button key={id} className={pattern === id ? 'on' : ''} onClick={() => setPattern(id as keyof typeof PATTERNS)}>
                {x.name}
              </button>
            ))}
          </div>
          <p className="muted center">{PATTERNS[pattern].desc}</p>
          <div className="seg three">
            {[1, 3, 5].map((m) => (
              <button key={m} className={minutes === m ? 'on' : ''} onClick={() => setMinutes(m)}>
                {m} min
              </button>
            ))}
          </div>
          <div className="orb idle" />
          {props.connected ? (
            <p className="muted small center">Mediré tu pulso con el anillo antes y después.</p>
          ) : (
            <p className="muted small center">Conecta el anillo para ver cómo baja tu pulso.</p>
          )}
          <button className="btn primary go" onClick={start}>
            Empezar
          </button>
        </div>
      )}

      {(stage === 'before' || stage === 'after') && (
        <div className="breathe-center">
          <div className="orb measuring" />
          <p className="phase">{stage === 'before' ? 'Midiendo tu pulso inicial…' : 'Midiendo tu pulso final…'}</p>
          <p className="hr-live">
            <IconHeart size={18} className="beat" /> {hr ?? '--'} lpm
          </p>
          <p className="muted small">Quédate quieto con el anillo puesto.</p>
        </div>
      )}

      {stage === 'running' && (
        <div className="breathe-center">
          <div className="orb" style={{ transform: `scale(${p.scale})`, transitionDuration: `${p.label === 'Mantén' ? 0.3 : p.seconds}s` }} />
          <p className="phase">{p.label}</p>
          <p className="muted">
            {Math.floor(Math.max(0, left) / 60)}:{String(Math.max(0, left) % 60).padStart(2, '0')}
          </p>
          <button className="link" onClick={finishEarly}>
            Terminar ya
          </button>
        </div>
      )}

      {stage === 'done' && result && (
        <div className="breathe-center">
          <div className="done-badge">🕊️</div>
          <p className="phase">¡Bien hecho!</p>
          <p className="muted">{result.minutes} min de respiración</p>
          {result.hrBefore && result.hrAfter ? (
            <div className="hr-compare">
              <span>
                <small>Antes</small>
                <b>{result.hrBefore}</b>
              </span>
              <span className="arrow">→</span>
              <span>
                <small>Después</small>
                <b>{result.hrAfter}</b>
              </span>
              <span className={result.hrAfter <= result.hrBefore ? 'delta good' : 'delta'}>
                {result.hrAfter - result.hrBefore > 0 ? '+' : ''}
                {result.hrAfter - result.hrBefore} lpm
              </span>
            </div>
          ) : null}
          <div className="row center">
            <button className="btn" onClick={() => setStage('setup')}>
              Otra vez
            </button>
            <button className="btn primary" onClick={props.onClose}>
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
