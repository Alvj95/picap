import type { HrDay, StepSlot } from './lib/ring'
import { fmtTime, type SavedSleep } from './lib/store'

const W = 320
const H = 140
const PAD = { l: 28, r: 12, t: 8, b: 18 }
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
        <defs>
          <linearGradient id="hrFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#ff5c7a" stopOpacity="0.45" />
            <stop offset="1" stopColor="#ff5c7a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {segs.map((d, i) => {
          const xs = [...d.matchAll(/[ML]([\d.]+),/g)].map((m) => m[1])
          const area = `${d}L${xs[xs.length - 1]},${PAD.t + plotH}L${xs[0]},${PAD.t + plotH}Z`
          return (
            <g key={i}>
              <path d={area} fill="url(#hrFill)" />
              <path d={d} className="line hr" />
            </g>
          )
        })}
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
      <defs>
        <linearGradient id="barFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3ee6a0" />
          <stop offset="1" stopColor="#1fa9c9" />
        </linearGradient>
      </defs>
      {hours.map((v, h) =>
        v ? <rect key={h} x={PAD.l + h * bw + 1} width={bw - 2} y={PAD.t + plotH - (v / max) * plotH} height={(v / max) * plotH} rx={2.5} fill="url(#barFill)" /> : null,
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
          return <rect key={i} x={x} width={Math.max(0.5, (s.minutes / total) * W - 0.5)} y={s.type === 'deep' ? 24 : s.type === 'light' ? 16 : s.type === 'rem' ? 8 : 0} height={20} rx={3} className={`stage ${s.type}`} />
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

/** Three concentric progress rings (steps, calories, distance), animated on change. */
export function ActivityRings({ rings }: { rings: { value: number; goal: number; cls: string }[] }) {
  const size = 140
  const stroke = 13
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="activity" role="img" aria-label="Progreso de actividad">
      {rings.map((r, i) => {
        const rad = size / 2 - stroke / 2 - i * (stroke + 3)
        const c = 2 * Math.PI * rad
        const pct = Math.min(1, r.goal ? r.value / r.goal : 0)
        return (
          <g key={r.cls} className={r.cls}>
            <circle cx={size / 2} cy={size / 2} r={rad} className="act-track" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={rad} className="act-fill" strokeWidth={stroke} strokeDasharray={`${Math.max(0.01, c * pct)} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          </g>
        )
      })}
    </svg>
  )
}

/** Bars every 30 minutes (stress 0–100, HRV in ms). */
export function HalfHourChart({ values, kind }: { values?: number[]; kind: 'stress' | 'hrv' }) {
  const pts = (values ?? []).map((v, i) => ({ i, v })).filter((p) => p.v > 0)
  if (!pts.length) return <p className="empty">Sin datos. Activa la medición en Ajustes y sincroniza más tarde.</p>
  const max = kind === 'stress' ? 100 : Math.max(80, ...pts.map((p) => p.v))
  const bw = plotW / 48
  const color = (v: number) => (kind === 'hrv' ? '#3ec7ff' : v < 30 ? '#3ee6a0' : v < 60 ? '#ffb547' : '#ff5c7a')
  const vals = pts.map((p) => p.v)
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={kind === 'stress' ? 'Estrés del día' : 'Variabilidad del pulso'}>
        <HourAxis />
        <text x={PAD.l - 4} y={PAD.t + 6} textAnchor="end" className="axis-label">
          {max}
        </text>
        {pts.map((p) => (
          <rect key={p.i} x={PAD.l + p.i * bw + 0.5} width={bw - 1} y={PAD.t + plotH - (p.v / max) * plotH} height={(p.v / max) * plotH} rx={1.5} fill={color(p.v)} />
        ))}
      </svg>
      <div className="stats">
        <span>
          Media <b>{avg}</b>
          {kind === 'hrv' ? ' ms' : ''}
        </span>
        {kind === 'stress' && <span>{avg < 30 ? '😌 Relajado' : avg < 60 ? '🙂 Normal' : '😣 Alto'}</span>}
        {kind === 'hrv' && <span>{avg >= 50 ? '💪 Buena recuperación' : avg >= 30 ? '🙂 Normal' : '😴 Necesitas descanso'}</span>}
      </div>
    </>
  )
}
