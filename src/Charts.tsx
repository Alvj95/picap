import type { HrDay, StepSlot } from './lib/ring'
import { fmtTime, type SavedSleep } from './lib/store'

const W = 320
const H = 140
const PAD = { l: 28, r: 6, t: 8, b: 18 }
const plotW = W - PAD.l - PAD.r
const plotH = H - PAD.t - PAD.b

function HourAxis() {
  return (
    <g className="axis">
      {[0, 6, 12, 18, 24].map((h) => {
        const x = PAD.l + (h / 24) * plotW
        return (
          <g key={h}>
            <line x1={x} x2={x} y1={PAD.t} y2={PAD.t + plotH} className="grid" />
            <text x={x} y={H - 4} textAnchor="middle">
              {h}h
            </text>
          </g>
        )
      })}
    </g>
  )
}

export function HrChart({ day, low, high }: { day?: HrDay; low: number; high: number }) {
  const pts = (day?.values ?? []).map((v, i) => ({ m: i * (day?.range ?? 5), v })).filter((p) => p.v > 0)
  if (pts.length === 0) return <p className="empty">Sin datos de pulso este día. Activa la medición automática en Ajustes.</p>
  const vals = pts.map((p) => p.v)
  const min = Math.min(40, ...vals) - 5
  const max = Math.max(140, ...vals) + 5
  const x = (m: number) => PAD.l + (m / 1440) * plotW
  const y = (v: number) => PAD.t + plotH - ((v - min) / (max - min)) * plotH
  // Break the line where the ring did not record for more than 30 minutes.
  const segs: string[] = []
  let cur = ''
  pts.forEach((p, i) => {
    const gap = i > 0 && p.m - pts[i - 1].m > 30
    if (gap && cur) segs.push(cur)
    cur = gap || !cur ? `M${x(p.m).toFixed(1)},${y(p.v).toFixed(1)}` : `${cur}L${x(p.m).toFixed(1)},${y(p.v).toFixed(1)}`
  })
  if (cur) segs.push(cur)
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Pulso a lo largo del día">
        <HourAxis />
        <rect x={PAD.l} width={plotW} y={y(high)} height={Math.max(0, y(low) - y(high))} className="band" />
        {[low, high].map((v) => (
          <text key={v} x={PAD.l - 4} y={y(v) + 3} textAnchor="end" className="axis-label">
            {v}
          </text>
        ))}
        {segs.map((d, i) => (
          <path key={i} d={d} className="line hr" />
        ))}
        {pts
          .filter((p) => p.v > high || p.v < low)
          .map((p) => (
            <circle key={p.m} cx={x(p.m)} cy={y(p.v)} r={2.5} className="dot-alert" />
          ))}
      </svg>
      <div className="stats">
        <span>
          Mín <b>{Math.min(...vals)}</b>
        </span>
        <span>
          Media <b>{avg}</b>
        </span>
        <span>
          Máx <b>{Math.max(...vals)}</b>
        </span>
        <span className="muted">lpm</span>
      </div>
    </>
  )
}

export function StepsChart({ slots }: { slots?: StepSlot[] }) {
  const hours = new Array(24).fill(0)
  slots?.forEach((s) => (hours[Math.min(23, Math.floor(s.slot / 4))] += s.steps))
  const max = Math.max(...hours)
  if (max === 0) return <p className="empty">Sin pasos registrados este día.</p>
  const bw = plotW / 24
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Pasos por hora">
      <HourAxis />
      <text x={PAD.l - 4} y={PAD.t + 6} textAnchor="end" className="axis-label">
        {max}
      </text>
      {hours.map((v, h) =>
        v ? <rect key={h} x={PAD.l + h * bw + 1} width={bw - 2} y={PAD.t + plotH - (v / max) * plotH} height={(v / max) * plotH} rx={2} className="bar" /> : null,
      )}
    </svg>
  )
}

const STAGE_LABEL = { deep: 'Profundo', light: 'Ligero', rem: 'REM', awake: 'Despierto' } as const

export function SleepChart({ night }: { night?: SavedSleep }) {
  const total = night?.stages.reduce((a, s) => a + s.minutes, 0) ?? 0
  if (!night || total === 0) return <p className="empty">Sin datos de sueño para esta noche.</p>
  const sums = { deep: 0, light: 0, rem: 0, awake: 0 }
  night.stages.forEach((s) => (sums[s.type] += s.minutes))
  let acc = 0
  return (
    <>
      <svg viewBox={`0 0 ${W} 44`} className="chart" role="img" aria-label="Fases del sueño">
        {night.stages.map((s, i) => {
          const x = (acc / total) * W
          acc += s.minutes
          return <rect key={i} x={x} width={(s.minutes / total) * W} y={s.type === 'deep' ? 22 : s.type === 'light' ? 14 : s.type === 'rem' ? 6 : 0} height={20} className={`stage ${s.type}`} />
        })}
      </svg>
      <div className="stats">
        <span>
          {fmtTime(night.start)} → {fmtTime(night.end)}
        </span>
        {(Object.keys(sums) as (keyof typeof sums)[]).map((k) => (
          <span key={k}>
            <i className={`swatch ${k}`} /> {STAGE_LABEL[k]} <b>{Math.floor(sums[k] / 60)}h{String(sums[k] % 60).padStart(2, '0')}</b>
          </span>
        ))}
      </div>
    </>
  )
}

/** Circular progress for the step goal. */
export function Ring({ value, goal, label }: { value: number; goal: number; label: string }) {
  const r = 52
  const c = 2 * Math.PI * r
  const pct = Math.min(1, goal ? value / goal : 0)
  return (
    <svg viewBox="0 0 120 120" className="goal" role="img" aria-label={`${value} de ${goal} ${label}`}>
      <circle cx={60} cy={60} r={r} className="goal-track" />
      <circle cx={60} cy={60} r={r} className="goal-fill" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 60 60)" />
      <text x={60} y={58} textAnchor="middle" className="goal-value">
        {value.toLocaleString('es')}
      </text>
      <text x={60} y={76} textAnchor="middle" className="goal-label">
        {label}
      </text>
    </svg>
  )
}
