import { useCallback, useEffect, useRef, useState } from 'react'
import { ring } from './lib/ring'
import { onRingInput } from './lib/ringInput'

type Game = 'jump' | 'reflex' | 'balloon'
const BEST_KEY = 'anillo.games'

function loadBest(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}')
  } catch {
    return {}
  }
}
function saveBest(b: Record<string, number>) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(b))
  } catch {
    /* ignore */
  }
}

/** Fires on a ring touch/gesture and on a screen tap, so every game also works without the ring. */
function useTap(cb: () => void, active = true) {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => (active ? onRingInput(() => ref.current()) : undefined), [active])
  return useCallback(() => ref.current(), [])
}

export function GamesScreen(props: { connected: boolean; onClose: () => void }) {
  const [game, setGame] = useState<Game>()
  const [best, setBest] = useState(loadBest)
  const record = (g: Game, score: number, lowerIsBetter = false) => {
    const prev = best[g]
    if (prev == null || (lowerIsBetter ? score < prev : score > prev)) {
      const next = { ...best, [g]: score }
      setBest(next)
      saveBest(next)
      return true
    }
    return false
  }

  return (
    <div className="screen games-screen">
      <div className="screen-top">
        <button className="pill" onClick={() => (game ? setGame(undefined) : props.onClose())}>
          {game ? '← Juegos' : '✕ Cerrar'}
        </button>
        <span className="muted">{props.connected ? '💍 Toca el anillo para jugar' : 'Toca la pantalla para jugar'}</span>
      </div>
      {!game && (
        <div className="content">
          <GameCard emoji="🦘" title="Salta" desc="Toca el anillo para saltar los cactus. ¿Hasta dónde llegas?" best={best.jump != null ? `${best.jump} pts` : undefined} onClick={() => setGame('jump')} />
          <GameCard emoji="⚡" title="Reflejos" desc="Cuando se ponga verde, toca el anillo lo más rápido posible." best={best.reflex != null ? `${best.reflex} ms` : undefined} onClick={() => setGame('reflex')} />
          <GameCard
            emoji="🎈"
            title="Globo zen"
            desc="Relájate: cuanto más baja tu pulso, más alto sube el globo. Necesita el anillo puesto."
            best={best.balloon != null ? `${best.balloon} m` : undefined}
            onClick={() => setGame('balloon')}
          />
        </div>
      )}
      {game === 'jump' && <JumpGame onScore={(s) => record('jump', s)} />}
      {game === 'reflex' && <ReflexGame onScore={(s) => record('reflex', s, true)} />}
      {game === 'balloon' && <BalloonGame connected={props.connected} onScore={(s) => record('balloon', s)} />}
    </div>
  )
}

function GameCard(p: { emoji: string; title: string; desc: string; best?: string; onClick: () => void }) {
  return (
    <button className="card game-card" onClick={p.onClick}>
      <span className="game-emoji">{p.emoji}</span>
      <span className="grow">
        <b>{p.title}</b>
        <small>{p.desc}</small>
        {p.best && <em>Récord: {p.best}</em>}
      </span>
      <span className="game-play">▶</span>
    </button>
  )
}

// ---------------- Salta (endless runner on canvas) ----------------

function JumpGame({ onScore }: { onScore: (s: number) => boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<'ready' | 'playing' | 'over'>('ready')
  const [score, setScore] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const scoreCb = useRef(onScore)
  scoreCb.current = onScore
  const g = useRef({ y: 0, vy: 0, obstacles: [] as { x: number; w: number; h: number }[], speed: 4, t: 0, score: 0, state: 'ready' as string })

  const start = () => {
    g.current = { y: 0, vy: 0, obstacles: [], speed: 4, t: 0, score: 0, state: 'playing' }
    setScore(0)
    setNewBest(false)
    setState('playing')
  }
  const tap = useTap(() => {
    const s = g.current
    if (s.state !== 'playing') return start()
    if (s.y === 0) s.vy = 11.5
  })

  useEffect(() => {
    if (state !== 'playing') return
    const c = canvas.current!
    const ctx = c.getContext('2d')!
    const W = 360
    const H = 220
    const ground = H - 30
    let raf = 0
    const loop = () => {
      const s = g.current
      s.t++
      s.speed = 4 + s.t / 600
      s.vy -= 0.6
      s.y = Math.max(0, s.y + s.vy)
      if (s.y === 0) s.vy = 0
      const last = s.obstacles[s.obstacles.length - 1]
      if (!last || last.x < W - 140 - Math.random() * 160) {
        if (Math.random() < 0.03 || !last) s.obstacles.push({ x: W + 10, w: 14 + Math.random() * 14, h: 22 + Math.random() * 26 })
      }
      s.obstacles.forEach((o) => (o.x -= s.speed))
      s.obstacles = s.obstacles.filter((o) => o.x + o.w > -10)
      s.score = Math.floor(s.t / 6)
      // Collision with the player box (x 40..68).
      const py = ground - s.y
      const hit = s.obstacles.some((o) => o.x < 66 && o.x + o.w > 44 && py > ground - o.h + 4)
      // Draw
      ctx.clearRect(0, 0, W, H)
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, '#1b1440')
      sky.addColorStop(1, '#0b0b14')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      for (let i = 0; i < 18; i++) ctx.fillRect((i * 97 - s.t * 0.3) % W < 0 ? ((i * 97 - s.t * 0.3) % W) + W : (i * 97 - s.t * 0.3) % W, (i * 53) % 120, 1.5, 1.5)
      ctx.fillStyle = '#2a2a3a'
      ctx.fillRect(0, ground, W, H - ground)
      ctx.fillStyle = '#3ee6a0'
      s.obstacles.forEach((o) => {
        ctx.beginPath()
        ctx.roundRect(o.x, ground - o.h, o.w, o.h, 4)
        ctx.fill()
      })
      // Player: a little ring-shaped hero.
      ctx.strokeStyle = '#a46bff'
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.arc(55, py - 14, 11, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#3ee6a0'
      ctx.fillRect(49, py - 30, 12, 5)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 16px system-ui'
      ctx.textAlign = 'right'
      ctx.fillText(String(s.score), W - 12, 24)
      if (hit) {
        s.state = 'over'
        setScore(s.score)
        setNewBest(scoreCb.current(s.score))
        setState('over')
        navigator.vibrate?.(200)
        return
      }
      if (s.t % 30 === 0) setScore(s.score)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [state])

  return (
    <div className="game-area" onPointerDown={tap}>
      <canvas ref={canvas} width={360} height={220} className="game-canvas" />
      {state === 'ready' && <div className="game-overlay">Toca el anillo (o la pantalla) para empezar y saltar</div>}
      {state === 'over' && (
        <div className="game-overlay">
          <b>{score} puntos</b>
          {newBest && <span className="new-best">🏆 ¡Nuevo récord!</span>}
          <small>Toca para jugar otra vez</small>
        </div>
      )}
    </div>
  )
}

// ---------------- Reflejos ----------------

function ReflexGame({ onScore }: { onScore: (ms: number) => boolean }) {
  const [phase, setPhase] = useState<'idle' | 'wait' | 'go' | 'result' | 'early'>('idle')
  const [ms, setMs] = useState(0)
  const [rounds, setRounds] = useState<number[]>([])
  const [newBest, setNewBest] = useState(false)
  const t0 = useRef(0)
  const timer = useRef(0)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => () => clearTimeout(timer.current), [])

  const tap = useTap(() => {
    const p = phaseRef.current
    if (p === 'idle' || p === 'result' || p === 'early') {
      setPhase('wait')
      timer.current = window.setTimeout(() => {
        t0.current = performance.now()
        setPhase('go')
        navigator.vibrate?.(30)
      }, 1500 + Math.random() * 3000)
    } else if (p === 'wait') {
      clearTimeout(timer.current)
      setPhase('early')
    } else if (p === 'go') {
      const r = Math.round(performance.now() - t0.current)
      setMs(r)
      setRounds((x) => [r, ...x].slice(0, 5))
      setNewBest(onScore(r))
      setPhase('result')
    }
  })

  const avg = rounds.length ? Math.round(rounds.reduce((a, b) => a + b, 0) / rounds.length) : 0
  return (
    <div className={`game-area reflex ${phase}`} onPointerDown={tap}>
      {phase === 'idle' && <p className="reflex-text">Toca para empezar.<small>Espera al verde y toca el anillo lo antes posible.</small></p>}
      {phase === 'wait' && <p className="reflex-text">Espera…</p>}
      {phase === 'go' && <p className="reflex-text">¡YA!</p>}
      {phase === 'early' && <p className="reflex-text">¡Demasiado pronto! 😅<small>Toca para intentarlo otra vez.</small></p>}
      {phase === 'result' && (
        <p className="reflex-text">
          {ms} ms
          {newBest && <span className="new-best">🏆 ¡Nuevo récord!</span>}
          <small>
            {ms < 250 ? '¡Reflejos de gato!' : ms < 350 ? 'Muy bien' : 'Puedes mejorar'} · media de {rounds.length}: {avg} ms · toca para repetir
          </small>
        </p>
      )}
    </div>
  )
}

// ---------------- Globo zen (heart-rate biofeedback) ----------------

function BalloonGame({ connected, onScore }: { connected: boolean; onScore: (m: number) => boolean }) {
  const [running, setRunning] = useState(false)
  const [hr, setHr] = useState<number>()
  const [base, setBase] = useState<number>()
  const [height, setHeight] = useState(0)
  const [left, setLeft] = useState(90)
  const [done, setDone] = useState<{ m: number; best: boolean }>()
  const alive = useRef(false)

  const start = async () => {
    setDone(undefined)
    setHeight(0)
    setLeft(90)
    setBase(undefined)
    setHr(undefined)
    setRunning(true)
    alive.current = true
    let first: number | undefined
    let h = 0
    const t0 = Date.now()
    while (alive.current && Date.now() - t0 < 90000) {
      try {
        const v = await ring.measure('hr', (x) => setHr(x), 2)
        setHr(v)
        if (first == null) {
          first = v
          setBase(v)
        } else {
          // Every beat per minute below the starting rate lifts the balloon; above it, it sinks.
          h = Math.max(0, h + (first - v) * 3 + 2)
          setHeight(h)
        }
      } catch {
        /* finger moved: keep going */
      }
      setLeft(Math.max(0, 90 - Math.round((Date.now() - t0) / 1000)))
    }
    if (!alive.current) return
    alive.current = false
    setRunning(false)
    const m = Math.round(h)
    setDone({ m, best: onScore(m) })
  }

  useEffect(
    () => () => {
      alive.current = false
    },
    [],
  )

  const lift = Math.min(1, height / 120)
  return (
    <div className="game-area balloon-area">
      <div className="balloon-sky">
        <div className="balloon" style={{ bottom: `${8 + lift * 70}%` }}>
          🎈
        </div>
        <div className="balloon-meta">
          <b>{Math.round(height)} m</b>
          {running && <small>{left} s</small>}
        </div>
      </div>
      <div className="balloon-panel">
        {!connected ? (
          <p className="muted">Conecta el anillo y póntelo: este juego usa tu pulso.</p>
        ) : running ? (
          <p>
            ❤️ {hr ?? '--'} lpm {base ? <small className="muted">(inicio {base})</small> : <small className="muted">midiendo pulso inicial…</small>}
            <br />
            <small className="muted">Respira lento y profundo, relaja los hombros…</small>
          </p>
        ) : done ? (
          <p>
            <b>{done.m} m</b> {done.best && <span className="new-best">🏆 ¡Nuevo récord!</span>}
          </p>
        ) : (
          <p className="muted">90 segundos. Quédate quieto y respira despacio.</p>
        )}
        {connected && !running && (
          <button className="btn primary" onClick={start}>
            {done ? 'Otra vez' : 'Empezar'}
          </button>
        )}
        {running && (
          <button
            className="link"
            onClick={() => {
              alive.current = false
              setRunning(false)
            }}
          >
            Parar
          </button>
        )}
      </div>
    </div>
  )
}
