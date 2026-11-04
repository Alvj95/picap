import type { ReactNode } from 'react'
import { awards, bestStreak, stepStreak, weekStats, type WeekStats } from './lib/insights'
import type { Data, Settings } from './lib/store'

const WD = new Intl.DateTimeFormat('es', { weekday: 'narrow' })
const hm = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`

function Delta({ now, prev, unit = '', invert = false }: { now?: number; prev?: number; unit?: string; invert?: boolean }) {
  if (now == null || prev == null || !prev) return null
  const d = now - prev
  if (!d) return <small className="delta">=</small>
  const good = invert ? d < 0 : d > 0
  return (
    <small className={`delta ${good ? 'good' : 'bad'}`}>
      {d > 0 ? '▲' : '▼'} {Math.abs(Math.round(d)).toLocaleString('es')}
      {unit}
    </small>
  )
}

/** Weekly summary: this week vs the previous one. */
export function WeekSummary({ data, settings }: { data: Data; settings: Settings }) {
  const w = weekStats(data, settings.stepGoal, 0)
  const prev = weekStats(data, settings.stepGoal, 1)
  const max = Math.max(settings.stepGoal, ...w.days.map((d) => d.steps))
  return (
    <>
      <section className="card glass">
        <div className="card-head">
          <h2>Pasos de la semana</h2>
          <span className="muted small">
            {w.goalDays}/7 días con meta
          </span>
        </div>
        <div className="week-bars">
          <div className="goal-line" style={{ bottom: `${(settings.stepGoal / max) * 100}%` }} />
          {w.days.map((d) => (
            <div key={d.key} className="wb">
              <div className={`wb-bar ${d.steps >= settings.stepGoal ? 'met' : ''}`} style={{ height: `${(d.steps / max) * 100}%` }} />
              <small>{WD.format(d.date)}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="tiles4">
        <Tile label="Pasos / día" value={w.avgSteps.toLocaleString('es')} delta={<Delta now={w.avgSteps} prev={prev.avgSteps} />} />
        <Tile label="Sueño medio" value={w.avgSleep ? hm(w.avgSleep) : '--'} delta={<Delta now={w.avgSleep} prev={prev.avgSleep} unit=" min" />} />
        <Tile label="Pulso en reposo" value={w.avgRhr ? `${w.avgRhr} lpm` : '--'} delta={<Delta now={w.avgRhr} prev={prev.avgRhr} invert />} />
        <Tile label="Entrenos" value={w.workouts ? `${w.workouts} · ${w.workoutKm.toFixed(1)} km` : '0'} delta={<Delta now={w.workoutKm} prev={prev.workoutKm} unit=" km" />} />
      </section>
      <section className="card">
        <h2>Resumen</h2>
        <p className="summary-text">{summaryText(w, prev, settings)}</p>
      </section>
    </>
  )
}

function Tile({ label, value, delta }: { label: string; value: string; delta: ReactNode }) {
  return (
    <div className="card tile">
      <small className="muted">{label}</small>
      <b>{value}</b>
      {delta}
    </div>
  )
}

function summaryText(w: WeekStats, prev: WeekStats, s: Settings) {
  const parts: string[] = []
  if (!w.steps && !w.avgSleep) return 'Aún no hay datos esta semana. Sincroniza el anillo para ver tu resumen.'
  parts.push(`Esta semana has dado ${w.steps.toLocaleString('es')} pasos y cumpliste tu meta ${w.goalDays} ${w.goalDays === 1 ? 'día' : 'días'}.`)
  if (prev.avgSteps) {
    const pct = Math.round(((w.avgSteps - prev.avgSteps) / prev.avgSteps) * 100)
    parts.push(pct >= 0 ? `Caminas un ${pct}% más que la semana pasada 💪.` : `Caminas un ${-pct}% menos que la semana pasada.`)
  }
  if (w.avgSleep) parts.push(w.avgSleep >= 420 ? `Duermes bien: ${hm(w.avgSleep)} de media 😴.` : `Duermes ${hm(w.avgSleep)} de media; intenta llegar a 7 h.`)
  if (w.avgRhr && prev.avgRhr && w.avgRhr < prev.avgRhr) parts.push('Tu pulso en reposo ha bajado, buena señal de forma física.')
  if (w.breathMin) parts.push(`Has respirado conscientemente ${w.breathMin} min.`)
  if (w.goalDays < 3) parts.push(`Reto: cumple ${s.stepGoal.toLocaleString('es')} pasos 3 días la semana que viene.`)
  return parts.join(' ')
}

/** Streak chip for the Today tab. */
export function StreakChip({ data, goal, onClick }: { data: Data; goal: number; onClick: () => void }) {
  const s = stepStreak(data, goal)
  return (
    <button className={`streak ${s.days ? 'hot' : ''}`} onClick={onClick}>
      <span className="flame">🔥</span>
      <b>{s.days}</b> {s.days === 1 ? 'día' : 'días'} de racha
      {!s.todayDone && s.days > 0 && <small> · ¡no la pierdas hoy!</small>}
    </button>
  )
}

export function AwardsScreen({ data, settings, onClose }: { data: Data; settings: Settings; onClose: () => void }) {
  const list = awards(data, settings)
  const done = list.filter((a) => a.done).length
  const streak = stepStreak(data, settings.stepGoal).days
  const best = bestStreak(data, settings.stepGoal)
  return (
    <div className="screen awards-screen">
      <div className="screen-top">
        <button className="pill" onClick={onClose}>
          ✕ Cerrar
        </button>
        <span className="muted">Logros</span>
      </div>
      <div className="content">
        <section className="card glass streak-hero">
          <div>
            <span className="big-flame">🔥</span>
            <b>{streak}</b>
            <small>racha actual</small>
          </div>
          <div>
            <span className="big-flame">🏅</span>
            <b>{best}</b>
            <small>mejor racha</small>
          </div>
          <div>
            <span className="big-flame">⭐</span>
            <b>
              {done}/{list.length}
            </b>
            <small>logros</small>
          </div>
        </section>
        <section className="awards">
          {list.map((a) => (
            <div key={a.id} className={`award ${a.done ? 'done' : ''}`}>
              <span className="award-icon">{a.icon}</span>
              <b>{a.title}</b>
              <small>{a.desc}</small>
              {!a.done && (
                <div className="award-bar">
                  <i style={{ width: `${a.progress * 100}%` }} />
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
