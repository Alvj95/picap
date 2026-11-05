import type { Workout } from './gps'
import type { HrDay, SleepNight, StepSlot } from './ring'

/** Everything the app remembers lives in localStorage on the phone; nothing is sent anywhere. */

export interface Spot {
  t: number
  kind: 'hr' | 'spo2'
  value: number
}
export interface SavedSleep extends Omit<SleepNight, 'daysAgo'> {
  /** Local date (YYYY-MM-DD) of the morning the night ended. */
  date: string
}
export interface BreathSession {
  t: number
  minutes: number
  hrBefore?: number
  hrAfter?: number
}
export type GestureAction = 'next' | 'previous' | 'playpause' | 'volup' | 'voldown' | 'workout'
export interface Settings {
  deviceId?: string
  deviceName?: string
  alertsOn: boolean
  hrHigh: number
  hrLow: number
  spo2Low: number
  stepGoal: number
  kcalGoal: number
  /** Hex prefix of the packet the ring sends when tapped, learned in the camera screen. */
  cameraSig?: string
  /** Learned ring gestures: packet hex prefix → action. */
  gestures?: Record<string, GestureAction>
}
export interface Data {
  hr: Record<string, HrDay>
  steps: Record<string, StepSlot[]>
  sleep: Record<string, SavedSleep>
  spots: Spot[]
  workouts: Workout[]
  breaths: BreathSession[]
  /** 48 half-hour values per day (0 = none). */
  stress?: Record<string, number[]>
  hrv?: Record<string, number[]>
  lastSync?: number
}

const SETTINGS_KEY = 'anillo.settings'
const DATA_KEY = 'anillo.data'

export const defaultSettings: Settings = { alertsOn: true, hrHigh: 120, hrLow: 45, spo2Low: 92, stepGoal: 8000, kcalGoal: 400 }

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

export const loadSettings = () => read<Settings>(SETTINGS_KEY, defaultSettings)
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s)
export const loadData = () => read<Data>(DATA_KEY, { hr: {}, steps: {}, sleep: {}, spots: [], workouts: [], breaths: [] })
export const saveData = (d: Data) => write(DATA_KEY, d)

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function daysAgo(n: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}

export const fmtTime = (minutes: number) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function dayTotals(slots: StepSlot[] = []) {
  return slots.reduce((a, s) => ({ steps: a.steps + s.steps, calories: a.calories + s.calories, distance: a.distance + s.distance }), {
    steps: 0,
    calories: 0,
    distance: 0,
  })
}

export function sleepMinutes(n?: SavedSleep) {
  const t = { light: 0, deep: 0, rem: 0, awake: 0 }
  n?.stages.forEach((s) => (t[s.type] += s.minutes))
  return { ...t, asleep: t.light + t.deep + t.rem }
}

export function toCsv(data: Data): string {
  const rows = ['tipo,fecha,hora,valor,extra']
  for (const [date, day] of Object.entries(data.hr).sort()) {
    day.values.forEach((v, i) => v && rows.push(`pulso,${date},${fmtTime(i * day.range)},${v},lpm`))
  }
  for (const [date, slots] of Object.entries(data.steps).sort()) {
    for (const s of slots) rows.push(`pasos,${date},${fmtTime(s.slot * 15)},${s.steps},cal=${s.calories};dist_m=${s.distance}`)
  }
  for (const [date, n] of Object.entries(data.sleep).sort()) {
    const m = sleepMinutes(n)
    rows.push(`sueño,${date},${fmtTime(n.start)}-${fmtTime(n.end)},${m.asleep},ligero=${m.light};profundo=${m.deep};rem=${m.rem};despierto=${m.awake}`)
  }
  for (const s of [...data.spots].sort((a, b) => a.t - b.t)) {
    const d = new Date(s.t)
    rows.push(`${s.kind === 'hr' ? 'pulso_manual' : 'spo2_manual'},${dayKey(d)},${fmtTime(d.getHours() * 60 + d.getMinutes())},${s.value},${s.kind === 'hr' ? 'lpm' : '%'}`)
  }
  for (const w of [...(data.workouts ?? [])].sort((a, b) => a.start - b.start)) {
    const d = new Date(w.start)
    rows.push(`entreno_${w.sport},${dayKey(d)},${fmtTime(d.getHours() * 60 + d.getMinutes())},${Math.round(w.distance)},min=${Math.round(w.duration / 60000)};pulso_medio=${w.hrAvg ?? ''};pulso_max=${w.hrMax ?? ''}`)
  }
  return rows.join('\n')
}
