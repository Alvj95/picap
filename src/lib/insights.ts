import { dayKey, daysAgo, dayTotals, sleepMinutes, type Data, type Settings } from './store'

/** Consecutive days (ending today, or yesterday if today isn't done yet) that met the step goal. */
export function stepStreak(data: Data, goal: number) {
  const met = (i: number) => dayTotals(data.steps[dayKey(daysAgo(i))]).steps >= goal
  const start = met(0) ? 0 : 1
  let n = 0
  while (met(start + n) && n < 3650) n++
  return { days: n, todayDone: met(0) }
}

export function bestStreak(data: Data, goal: number) {
  const keys = Object.keys(data.steps).sort()
  if (!keys.length) return 0
  let best = 0
  let cur = 0
  const d = new Date(keys[0] + 'T00:00:00')
  const end = daysAgo(0)
  while (d <= end) {
    if (dayTotals(data.steps[dayKey(d)]).steps >= goal) best = Math.max(best, ++cur)
    else cur = 0
    d.setDate(d.getDate() + 1)
  }
  return best
}

/** Average of the night-time (00–06 h) heart rate: a good proxy for resting heart rate. */
function restingHr(data: Data, key: string) {
  const day = data.hr[key]
  if (!day) return undefined
  const night = day.values.filter((v, i) => v > 0 && i * day.range < 360)
  return night.length >= 3 ? Math.round(night.reduce((a, b) => a + b, 0) / night.length) : undefined
}

export interface WeekStats {
  days: { key: string; date: Date; steps: number; sleep: number; rhr?: number }[]
  steps: number
  avgSteps: number
  goalDays: number
  avgSleep: number
  avgRhr?: number
  workouts: number
  workoutKm: number
  breathMin: number
}

export function weekStats(data: Data, goal: number, weeksAgo = 0): WeekStats {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = daysAgo(weeksAgo * 7 + 6 - i)
    const key = dayKey(date)
    return { key, date, steps: dayTotals(data.steps[key]).steps, sleep: sleepMinutes(data.sleep[key]).asleep, rhr: restingHr(data, key) }
  })
  const from = days[0].date.getTime()
  const to = daysAgo(weeksAgo * 7 - 1).getTime()
  const inWeek = (t: number) => t >= from && t < to
  const withSteps = days.filter((d) => d.steps > 0)
  const withSleep = days.filter((d) => d.sleep > 0)
  const rhrs = days.map((d) => d.rhr).filter((v): v is number => !!v)
  const ws = (data.workouts ?? []).filter((w) => inWeek(w.start))
  return {
    days,
    steps: days.reduce((a, d) => a + d.steps, 0),
    avgSteps: withSteps.length ? Math.round(withSteps.reduce((a, d) => a + d.steps, 0) / withSteps.length) : 0,
    goalDays: days.filter((d) => d.steps >= goal).length,
    avgSleep: withSleep.length ? Math.round(withSleep.reduce((a, d) => a + d.sleep, 0) / withSleep.length) : 0,
    avgRhr: rhrs.length ? Math.round(rhrs.reduce((a, b) => a + b, 0) / rhrs.length) : undefined,
    workouts: ws.length,
    workoutKm: ws.reduce((a, w) => a + w.distance, 0) / 1000,
    breathMin: (data.breaths ?? []).filter((b) => inWeek(b.t)).reduce((a, b) => a + b.minutes, 0),
  }
}

export interface Award {
  id: string
  icon: string
  title: string
  desc: string
  done: boolean
  /** 0..1 progress for locked awards. */
  progress: number
}

export function awards(data: Data, settings: Settings): Award[] {
  const allDays = Object.values(data.steps).map((s) => dayTotals(s).steps)
  const maxDay = Math.max(0, ...allDays)
  const totalSteps = allDays.reduce((a, b) => a + b, 0)
  const ws = data.workouts ?? []
  const longest = Math.max(0, ...ws.map((w) => w.distance)) / 1000
  const totalKm = ws.reduce((a, w) => a + w.distance, 0) / 1000
  const best = bestStreak(data, settings.stepGoal)
  const maxSleep = Math.max(0, ...Object.values(data.sleep).map((n) => sleepMinutes(n).asleep))
  const breaths = (data.breaths ?? []).length
  const measures = data.spots.length
  const a = (id: string, icon: string, title: string, desc: string, value: number, target: number): Award => ({
    id,
    icon,
    title,
    desc,
    done: value >= target,
    progress: Math.min(1, target ? value / target : 0),
  })
  return [
    a('first-sync', '💍', 'Conectado', 'Sincroniza tu anillo por primera vez', data.lastSync ? 1 : 0, 1),
    a('goal', '🎯', 'Meta cumplida', `Llega a ${settings.stepGoal.toLocaleString('es')} pasos en un día`, maxDay, settings.stepGoal),
    a('10k', '👟', 'Diez mil', 'Camina 10.000 pasos en un día', maxDay, 10000),
    a('20k', '🚀', 'Imparable', 'Camina 20.000 pasos en un día', maxDay, 20000),
    a('streak3', '🔥', 'En racha', 'Cumple tu meta 3 días seguidos', best, 3),
    a('streak7', '⚡', 'Semana perfecta', 'Cumple tu meta 7 días seguidos', best, 7),
    a('streak30', '👑', 'Leyenda', 'Cumple tu meta 30 días seguidos', best, 30),
    a('100k', '🌍', 'Trotamundos', 'Suma 100.000 pasos', totalSteps, 100000),
    a('workout1', '🏃', 'Primer entreno', 'Completa un entreno con GPS', ws.length, 1),
    a('5k', '🥇', '5K', 'Haz un entreno de 5 km', longest, 5),
    a('10kRun', '🏆', '10K', 'Haz un entreno de 10 km', longest, 10),
    a('50km', '🗺️', 'Explorador', 'Suma 50 km en entrenos', totalKm, 50),
    a('sleep8', '😴', 'Bello durmiente', 'Duerme 8 horas en una noche', maxSleep, 480),
    a('breath1', '🧘', 'Respira', 'Completa una sesión de respiración', breaths, 1),
    a('breath10', '🕊️', 'Zen', 'Completa 10 sesiones de respiración', breaths, 10),
    a('measure10', '❤️', 'Atento a tu salud', 'Haz 10 mediciones manuales', measures, 10),
  ]
}
