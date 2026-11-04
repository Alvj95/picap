/**
 * Workout tracking with the phone's GPS (the ring has none).
 * Uses the standard Geolocation API: in the Android app Capacitor's WebView asks for the location permission.
 */

export type Sport = 'walk' | 'run' | 'bike'
export interface TrackPoint {
  lat: number
  lon: number
  t: number
  /** Heart rate from the ring at that moment, if known. */
  hr?: number
}
export interface Workout {
  id: number
  sport: Sport
  start: number
  /** Moving time in ms (pauses excluded). */
  duration: number
  /** Meters. */
  distance: number
  points: TrackPoint[]
  hrAvg?: number
  hrMax?: number
}

export const SPORTS: Record<Sport, { label: string; kcalPerKm: number }> = {
  walk: { label: 'Caminar', kcalPerKm: 55 },
  run: { label: 'Correr', kcalPerKm: 70 },
  bike: { label: 'Bici', kcalPerKm: 28 },
}

const R = 6371000
export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export const gpsAvailable = typeof navigator !== 'undefined' && 'geolocation' in navigator

export interface TrackerState {
  running: boolean
  paused: boolean
  distance: number
  duration: number
  points: TrackPoint[]
  accuracy?: number
  speed?: number
  error?: string
}

/** Records a GPS track. Filters out inaccurate fixes and GPS jitter while standing still. */
export class Tracker {
  state: TrackerState = { running: false, paused: false, distance: 0, duration: 0, points: [] }
  onChange?: (s: TrackerState) => void
  private watchId?: number
  private startedAt = 0
  private accumulated = 0
  private clock = 0
  private wakeLock?: { release(): Promise<void> }
  hr?: number

  private emit(patch: Partial<TrackerState>) {
    this.state = { ...this.state, ...patch }
    this.onChange?.(this.state)
  }

  start() {
    if (!gpsAvailable) return this.emit({ error: 'Este dispositivo no tiene GPS disponible.' })
    this.state = { running: true, paused: false, distance: 0, duration: 0, points: [] }
    this.accumulated = 0
    this.resume()
  }

  resume() {
    this.startedAt = Date.now()
    this.emit({ running: true, paused: false, error: undefined })
    this.watchId = navigator.geolocation.watchPosition(
      (p) => this.onFix(p),
      (e) =>
        this.emit({
          error:
            e.code === e.PERMISSION_DENIED
              ? 'Sin permiso de ubicación. Actívalo en Ajustes del teléfono → Apps → Mi Anillo → Permisos.'
              : 'Buscando señal GPS… sal a un lugar abierto.',
        }),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    )
    this.clock = window.setInterval(() => this.emit({ duration: this.accumulated + Date.now() - this.startedAt }), 1000)
    void this.keepAwake()
  }

  pause() {
    this.stopWatching()
    this.accumulated += Date.now() - this.startedAt
    this.emit({ paused: true, duration: this.accumulated })
  }

  /** Stops and returns the finished workout (or null if nothing was recorded). */
  stop(sport: Sport): Workout | null {
    if (!this.state.paused) this.accumulated += Date.now() - this.startedAt
    this.stopWatching()
    const { points, distance } = this.state
    this.emit({ running: false, paused: false, duration: this.accumulated })
    if (points.length < 2 && this.accumulated < 60000) return null
    const hrs = points.map((p) => p.hr).filter((h): h is number => !!h)
    return {
      id: Date.now(),
      sport,
      start: points[0]?.t ?? Date.now() - this.accumulated,
      duration: this.accumulated,
      distance,
      points,
      hrAvg: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : undefined,
      hrMax: hrs.length ? Math.max(...hrs) : undefined,
    }
  }

  private onFix(p: GeolocationPosition) {
    const { latitude: lat, longitude: lon, accuracy, speed } = p.coords
    this.emit({ accuracy, speed: speed ?? undefined, error: undefined })
    if (accuracy > 35) return // too imprecise to draw
    const pt: TrackPoint = { lat, lon, t: p.timestamp, hr: this.hr }
    const last = this.state.points[this.state.points.length - 1]
    if (!last) return this.emit({ points: [pt] })
    const d = haversine(last, pt)
    // Ignore jitter: require moving more than the fix's own error margin.
    if (d < Math.max(4, accuracy * 0.5)) return
    // Ignore teleports (> 50 m/s ≈ 180 km/h).
    if (d / Math.max(1, (pt.t - last.t) / 1000) > 50) return
    this.emit({ points: [...this.state.points, pt], distance: this.state.distance + d })
  }

  private stopWatching() {
    if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId)
    this.watchId = undefined
    clearInterval(this.clock)
    void this.wakeLock?.release().catch(() => {})
    this.wakeLock = undefined
  }

  /** Keeps the screen on: the WebView cannot track GPS while the phone sleeps. */
  private async keepAwake() {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock
      this.wakeLock = await wl?.request('screen')
    } catch {
      /* not supported: the user keeps the screen on */
    }
  }
}

export const fmtDuration = (ms: number) => {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** min/km for walking and running. */
export const fmtPace = (ms: number, meters: number) => {
  if (meters < 20) return '--'
  const secPerKm = ms / 1000 / (meters / 1000)
  if (!Number.isFinite(secPerKm) || secPerKm > 3600) return '--'
  return `${Math.floor(secPerKm / 60)}'${String(Math.round(secPerKm % 60)).padStart(2, '0')}"`
}

export const kmh = (ms: number, meters: number) => (ms > 0 ? (meters / 1000 / (ms / 3600000)).toFixed(1) : '0.0')
