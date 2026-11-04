import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityRings, HrChart, SleepChart, StepsChart } from './Charts'
import {
  IconBattery,
  IconBluetooth,
  IconChart,
  IconDrop,
  IconFlame,
  IconHeart,
  IconHome,
  IconMoon,
  IconRefresh,
  IconRoute,
  IconRun,
  IconSearch,
  IconSettings,
  IconShoe,
} from './Icons'
import { BreatheScreen } from './Breathe'
import { CameraScreen } from './Camera'
import { AwardsScreen, StreakChip, WeekSummary } from './Insights'
import { WorkoutTab } from './Workout'
import { bluetoothAvailable, isNative, phoneNotifications, toHex, transport, type FoundDevice, type NotifyConfig, type NotifyKind } from './lib/ble'
import { ring, type Reading } from './lib/ring'
import { shareText } from './lib/share'
import {
  dayKey,
  daysAgo,
  dayTotals,
  loadData,
  loadSettings,
  saveData,
  saveSettings,
  sleepMinutes,
  toCsv,
  type Data,
  type Settings,
} from './lib/store'

type Status = 'idle' | 'scanning' | 'connecting' | 'connected'
type Tab = 'hoy' | 'entreno' | 'historial' | 'ajustes'
type Screen = 'camera' | 'breathe' | 'awards'
const NOTIFY_KINDS: [NotifyKind, string][] = [
  ['call', '📞 Llamadas'],
  ['whatsapp', '💬 WhatsApp'],
  ['sms', '✉️ SMS'],
  ['social', '📱 Telegram, Instagram…'],
  ['email', '📧 Correo'],
  ['other', '🔔 Otras apps'],
]
const HISTORY_DAYS = 7
const INTERVALS = [5, 10, 15, 30, 60]
const WEEKDAY = new Intl.DateTimeFormat('es', { weekday: 'short' })

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

export default function App() {
  const [tab, setTab] = useState<Tab>('hoy')
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [data, setData] = useState<Data>(loadData)
  const [status, setStatus] = useState<Status>('idle')
  const [syncing, setSyncing] = useState('')
  const [devices, setDevices] = useState<FoundDevice[]>([])
  const [battery, setBattery] = useState<{ level: number; charging: boolean }>()
  const [hrCfg, setHrCfg] = useState<{ enabled: boolean; interval: number }>()
  const [spo2Auto, setSpo2Auto] = useState<boolean>()
  const [live, setLive] = useState<{ kind: Reading; value?: number; running: boolean }>()
  const [notice, setNotice] = useState<{ text: string; kind: 'info' | 'error' | 'alert' }>()
  const [log, setLog] = useState<string[]>([])
  const [showLog, setShowLog] = useState(false)
  const [historyDay, setHistoryDay] = useState(0)
  const [histMode, setHistMode] = useState<'dia' | 'semana'>('dia')
  const [screen, setScreen] = useState<Screen>()
  const [notifyCfg, setNotifyCfg] = useState<NotifyConfig>()
  const bigData = useRef(false)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => saveData(data), [data])

  const info = (text: string) => setNotice({ text, kind: 'info' })
  const fail = (e: unknown) => setNotice({ text: errMsg(e), kind: 'error' })
  const alarm = useCallback((text: string) => {
    setNotice({ text, kind: 'alert' })
    navigator.vibrate?.([300, 150, 300])
  }, [])

  // Technical log: every packet in/out, useful to discover ring gestures and debug.
  useEffect(() => {
    const stamp = () => new Date().toLocaleTimeString('es', { hour12: false })
    ring.onPacket = (dir, ch, p) => setLog((l) => [`${stamp()} ${dir === 'in' ? '←' : '→'} ${ch} ${toHex(p)}`, ...l].slice(0, 300))
    ring.onUnsolicited = (ch, p) => setLog((l) => [`${stamp()} ★ evento del anillo ${ch} ${toHex(p)}`, ...l].slice(0, 300))
    phoneNotifications?.onForward((n) =>
      setLog((l) => [`${stamp()} 🔔 aviso ${n.kind} (${n.app}) ${n.delivered ? 'enviado al anillo' : 'anillo no conectado'}`, ...l].slice(0, 300)),
    )
    transport.onDisconnect(() => {
      setStatus('idle')
      setLive(undefined)
      setSyncing('')
      setNotice({ text: 'El anillo se desconectó.', kind: 'error' })
    })
  }, [])

  const checkValue = useCallback(
    (kind: Reading, v: number) => {
      const s = settingsRef.current
      if (!s.alertsOn || !v) return
      if (kind === 'hr' && v > s.hrHigh) alarm(`⚠️ Pulso alto: ${v} lpm (límite ${s.hrHigh})`)
      else if (kind === 'hr' && v < s.hrLow) alarm(`⚠️ Pulso bajo: ${v} lpm (límite ${s.hrLow})`)
      else if (kind === 'spo2' && v < s.spo2Low) alarm(`⚠️ Oxígeno bajo: ${v}% (límite ${s.spo2Low}%)`)
    },
    [alarm],
  )

  const sync = useCallback(async () => {
    try {
      setSyncing('Ajustando la hora…')
      await ring.setTime().catch(() => {})
      setSyncing('Leyendo batería…')
      setBattery(await ring.battery().catch(() => undefined))
      setHrCfg(await ring.hrSettings().catch(() => undefined))
      setSpo2Auto(await ring.spo2Settings().catch(() => undefined))
      const before = data.lastSync ?? 0
      for (let i = 0; i < HISTORY_DAYS; i++) {
        setSyncing(`Descargando historial (${i + 1}/${HISTORY_DAYS})…`)
        const date = daysAgo(i)
        const key = dayKey(date)
        const hr = await ring.hrHistory(date).catch(() => null)
        const steps = await ring.steps(i).catch(() => [])
        setData((d) => ({
          ...d,
          hr: hr ? { ...d.hr, [key]: hr } : d.hr,
          steps: steps.length ? { ...d.steps, [key]: steps } : d.steps,
        }))
        // Alert on new automatic readings recorded since the last sync.
        if (i === 0 && hr) {
          const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
          const fromMin = before > daysAgo(0).getTime() ? (before - daysAgo(0).getTime()) / 60000 : 0
          const recent = hr.values.map((v, j) => ({ v, m: j * hr.range })).filter((p) => p.v && p.m >= fromMin && p.m <= nowMin)
          const last = recent[recent.length - 1]
          const worst = recent.find((p) => p.v > settingsRef.current.hrHigh || p.v < settingsRef.current.hrLow)
          if (worst) checkValue('hr', worst.v)
          else if (last) checkValue('hr', last.v)
        }
      }
      if (bigData.current) {
        setSyncing('Descargando sueño…')
        const nights = await ring.sleep().catch(() => [])
        setData((d) => {
          const sleep = { ...d.sleep }
          for (const n of nights) sleep[dayKey(daysAgo(n.daysAgo))] = { date: dayKey(daysAgo(n.daysAgo)), start: n.start, end: n.end, stages: n.stages }
          return { ...d, sleep }
        })
      }
      setData((d) => ({ ...d, lastSync: Date.now() }))
      info('Datos actualizados.')
    } catch (e) {
      fail(e)
    } finally {
      setSyncing('')
    }
  }, [checkValue, data.lastSync])

  const connectTo = useCallback(
    async (dev: FoundDevice, quiet = false) => {
      setStatus('connecting')
      if (!quiet) setNotice(undefined)
      try {
        const res = await transport.connect(dev.deviceId)
        bigData.current = res.bigData
        setSettings((s) => ({ ...s, deviceId: dev.deviceId, deviceName: dev.name || res.name || s.deviceName }))
        setStatus('connected')
        setDevices([])
        void sync()
      } catch (e) {
        setStatus('idle')
        if (!quiet) fail(e)
      }
    },
    [sync],
  )

  // Reconnect to the saved ring when the app opens.
  const autoTried = useRef(false)
  useEffect(() => {
    if (autoTried.current || !settings.deviceId || !bluetoothAvailable) return
    autoTried.current = true
    void connectTo({ deviceId: settings.deviceId, name: settings.deviceName ?? 'Anillo' }, true)
  }, [connectTo, settings.deviceId, settings.deviceName])

  const scan = async () => {
    setDevices([])
    setNotice(undefined)
    setStatus('scanning')
    try {
      const found: FoundDevice[] = []
      await transport.scan((d) => {
        found.push(d)
        setDevices((list) => [...list.filter((x) => x.deviceId !== d.deviceId), d].sort((a, b) => likelyRing(b) - likelyRing(a) || (b.rssi ?? -999) - (a.rssi ?? -999)))
      })
      setStatus('idle')
      // Web Bluetooth returns exactly the device the user picked: connect straight away.
      if (transport.chooser && found[0]) await connectTo(found[0])
      else if (found.length === 0) info('No encontré el anillo. Cierra la app QRing (o desvincúlalo allí) y vuelve a buscar.')
    } catch (e) {
      setStatus('idle')
      if ((e as Error).name !== 'NotFoundError') fail(e)
    }
  }

  const disconnect = async () => {
    await transport.disconnect()
    setStatus('idle')
    setBattery(undefined)
  }

  const measure = async (kind: Reading) => {
    setLive({ kind, running: true })
    setNotice(undefined)
    try {
      const value = await ring.measure(kind, (v) => setLive({ kind, value: v, running: true }))
      setLive({ kind, value, running: false })
      setData((d) => ({ ...d, spots: [...d.spots, { t: Date.now(), kind, value }].slice(-500) }))
      checkValue(kind, value)
    } catch (e) {
      setLive(undefined)
      fail(e)
    }
  }

  // Notification-access status changes in Android settings, so re-read it whenever the app comes back.
  useEffect(() => {
    const pn = phoneNotifications
    if (!pn) return
    const refresh = () => void pn.get().then(setNotifyCfg, () => {})
    refresh()
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])
  const updateNotify = (c: Partial<Omit<NotifyConfig, 'access'>>) => void phoneNotifications?.set(c).then(setNotifyCfg, fail)

  const run = (fn: () => Promise<unknown>, ok?: string) => async () => {
    try {
      await fn()
      if (ok) info(ok)
    } catch (e) {
      fail(e)
    }
  }

  const connected = status === 'connected'
  const busy = !!syncing || !!live?.running
  const todayKey = dayKey(daysAgo(0))
  const today = dayTotals(data.steps[todayKey])
  const todayHr = data.hr[todayKey]?.values.filter(Boolean) ?? []
  const lastSpot = (k: Reading) => [...data.spots].reverse().find((s) => s.kind === k)
  const lastHr = lastSpot('hr')
  const lastSpo2 = lastSpot('spo2')
  const lastNight = data.sleep[todayKey]
  const hDate = daysAgo(historyDay)
  const hKey = dayKey(hDate)

  const kcal = Math.round(today.calories / 1000)
  const hrNow = live?.kind === 'hr' ? live.value : lastHr?.value ?? todayHr[todayHr.length - 1]
  const hour = new Date().getHours()
  const greeting = hour < 6 ? 'Buenas noches' : hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="app">
      <div className="bg-glow" aria-hidden="true" />
      <header className="topbar">
        <div className="logo">
          <span className="logo-mark" />
          <span>
            <small>{greeting}</small>
            Mi Anillo
          </span>
        </div>
        <div className={`conn ${status}`}>
          {status === 'connected' ? (
            <>
              <IconBattery size={18} level={battery?.level ?? 100} />
              {battery ? `${battery.level}%${battery.charging ? ' ⚡' : ''}` : 'Conectado'}
            </>
          ) : (
            <>
              <IconBluetooth size={16} />
              {status === 'connecting' ? 'Conectando…' : status === 'scanning' ? 'Buscando…' : 'Desconectado'}
            </>
          )}
        </div>
      </header>

      {notice && (
        <div className={`notice ${notice.kind}`} role="status" onClick={() => setNotice(undefined)}>
          {notice.text}
        </div>
      )}
      {syncing && (
        <div className="notice info syncing">
          <IconRefresh size={14} className="spin" /> {syncing}
        </div>
      )}

      <main className="content">
        {!bluetoothAvailable && tab !== 'entreno' && (
          <section className="card warn">
            <h2>Bluetooth no disponible</h2>
            <p>
              Este navegador no puede conectarse al anillo. Instala la <b>app de Android</b> o abre esta página en <b>Chrome</b>. Safari en iPhone no permite Bluetooth en
              páginas web.
            </p>
            <a className="btn primary" href="./MiAnillo.apk">
              Descargar app Android
            </a>
          </section>
        )}

        {bluetoothAvailable && !connected && tab !== 'entreno' && (
          <section className="card connect-card">
            <div className="connect-art" aria-hidden="true">
              <span />
            </div>
            <h2>{settings.deviceId ? settings.deviceName ?? 'Tu anillo' : 'Conecta tu anillo'}</h2>
            <p className="muted small">
              Ponte el anillo o déjalo cargando cerca. Si la app <b>QRing</b> está abierta, ciérrala: el anillo solo acepta una conexión a la vez.
            </p>
            <div className="row">
              {settings.deviceId && (
                <button className="btn primary" disabled={status !== 'idle'} onClick={() => connectTo({ deviceId: settings.deviceId!, name: settings.deviceName ?? '' })}>
                  <IconBluetooth size={16} /> Reconectar
                </button>
              )}
              <button className={`btn ${settings.deviceId ? '' : 'primary'}`} disabled={status !== 'idle'} onClick={scan}>
                <IconSearch size={16} /> {status === 'scanning' ? 'Buscando…' : 'Buscar anillo'}
              </button>
              {status === 'scanning' && !transport.chooser && (
                <button className="btn" onClick={() => transport.stopScan()}>
                  Parar
                </button>
              )}
            </div>
            {devices.length > 0 && (
              <ul className="devices">
                {devices.map((d) => (
                  <li key={d.deviceId}>
                    <button onClick={() => connectTo(d)} disabled={status === 'connecting'}>
                      <span>
                        <b>{d.name}</b>
                        {likelyRing(d) ? <em className="tag">anillo</em> : null}
                        <small>{d.deviceId}</small>
                      </span>
                      {d.rssi != null && <small>{signal(d.rssi)}</small>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === 'hoy' && (
          <>
            <section className="card hero glass">
              <ActivityRings
                rings={[
                  { value: today.steps, goal: settings.stepGoal, cls: 'r-steps' },
                  { value: kcal, goal: settings.kcalGoal, cls: 'r-kcal' },
                  { value: today.distance, goal: 5000, cls: 'r-dist' },
                ]}
              />
              <div className="hero-stats">
                <div className="hs steps">
                  <IconShoe size={16} />
                  <span>
                    <b>{today.steps.toLocaleString('es')}</b>
                    <small>/ {settings.stepGoal.toLocaleString('es')} pasos</small>
                  </span>
                </div>
                <div className="hs kcal">
                  <IconFlame size={16} />
                  <span>
                    <b>{kcal.toLocaleString('es')}</b>
                    <small>/ {settings.kcalGoal} kcal</small>
                  </span>
                </div>
                <div className="hs dist">
                  <IconRoute size={16} />
                  <span>
                    <b>{(today.distance / 1000).toFixed(2)}</b>
                    <small>/ 5 km</small>
                  </span>
                </div>
              </div>
            </section>

            <StreakChip data={data} goal={settings.stepGoal} onClick={() => setScreen('awards')} />

            <section className="tools">
              <button onClick={() => setScreen('camera')}>
                <span className="tool-icon cam">📸</span>
                Cámara
              </button>
              <button onClick={() => setScreen('breathe')}>
                <span className="tool-icon breath">🧘</span>
                Respirar
              </button>
              <button onClick={() => setScreen('awards')}>
                <span className="tool-icon award">🏆</span>
                Logros
              </button>
              <button onClick={() => setTab('ajustes')}>
                <span className="tool-icon bell">🔔</span>
                Avisos
              </button>
            </section>

            <section className="grid2">
              <Metric
                kind="hr"
                title="Pulso"
                unit="lpm"
                icon={<IconHeart size={16} className={live?.kind === 'hr' && live.running ? 'beat' : ''} />}
                value={hrNow}
                sub={live?.kind === 'hr' && live.running ? 'Midiendo… no te muevas' : lastHr ? `Medido ${ago(lastHr.t)}` : todayHr.length ? 'Lectura automática' : 'Sin datos'}
                running={live?.kind === 'hr' && live.running}
                onMeasure={connected && !busy ? () => measure('hr') : undefined}
              />
              <Metric
                kind="spo2"
                title="Oxígeno"
                unit="%"
                icon={<IconDrop size={16} />}
                value={live?.kind === 'spo2' ? live.value : lastSpo2?.value}
                sub={live?.kind === 'spo2' && live.running ? 'Midiendo… hasta 30 s' : lastSpo2 ? `Medido ${ago(lastSpo2.t)}` : 'Sin datos'}
                running={live?.kind === 'spo2' && live.running}
                onMeasure={connected && !busy ? () => measure('spo2') : undefined}
              />
            </section>

            <section className="card">
              <div className="card-head">
                <h2>
                  <IconHeart size={16} className="h-icon hr" /> Pulso de hoy
                </h2>
                {connected && (
                  <button className="link" disabled={busy} onClick={sync}>
                    <IconRefresh size={14} /> Actualizar
                  </button>
                )}
              </div>
              <HrChart day={data.hr[todayKey]} low={settings.hrLow} high={settings.hrHigh} />
            </section>

            <section className="card">
              <h2>
                <IconMoon size={16} className="h-icon sleep" /> Sueño de anoche
              </h2>
              {lastNight ? (
                <>
                  <p className="big">
                    {Math.floor(sleepMinutes(lastNight).asleep / 60)}
                    <small>h</small> {sleepMinutes(lastNight).asleep % 60}
                    <small>min</small>
                  </p>
                  <SleepChart night={lastNight} />
                </>
              ) : (
                <p className="empty">Sin datos de sueño todavía. Duerme con el anillo puesto y sincroniza por la mañana.</p>
              )}
            </section>
            {data.lastSync && <p className="foot muted">Última sincronización: {new Date(data.lastSync).toLocaleString('es')}</p>}
          </>
        )}

        {tab === 'entreno' && (
          <WorkoutTab
            connected={connected}
            workouts={data.workouts ?? []}
            onSave={(w) => {
              setData((d) => ({ ...d, workouts: [...(d.workouts ?? []), w] }))
              info(`Entreno guardado: ${(w.distance / 1000).toFixed(2)} km`)
            }}
            onDelete={(id) => setData((d) => ({ ...d, workouts: (d.workouts ?? []).filter((w) => w.id !== id) }))}
          />
        )}

        {tab === 'historial' && (
          <div className="seg two">
            <button className={histMode === 'dia' ? 'on' : ''} onClick={() => setHistMode('dia')}>
              Día
            </button>
            <button className={histMode === 'semana' ? 'on' : ''} onClick={() => setHistMode('semana')}>
              Semana
            </button>
          </div>
        )}

        {tab === 'historial' && histMode === 'semana' && <WeekSummary data={data} settings={settings} />}

        {tab === 'historial' && histMode === 'dia' && (
          <>
            <nav className="days">
              {Array.from({ length: HISTORY_DAYS }, (_, i) => {
                const d = daysAgo(i)
                return (
                  <button key={i} className={historyDay === i ? 'on' : ''} onClick={() => setHistoryDay(i)}>
                    <small>{i === 0 ? 'Hoy' : i === 1 ? 'Ayer' : WEEKDAY.format(d)}</small>
                    <b>{d.getDate()}</b>
                  </button>
                )
              })}
            </nav>
            <section className="card">
              <h2>Pulso</h2>
              <HrChart day={data.hr[hKey]} low={settings.hrLow} high={settings.hrHigh} />
            </section>
            <section className="card">
              <div className="card-head">
                <h2>Pasos por hora</h2>
                <span className="muted">{dayTotals(data.steps[hKey]).steps.toLocaleString('es')} pasos</span>
              </div>
              <StepsChart slots={data.steps[hKey]} />
            </section>
            <section className="card">
              <h2>Sueño (noche que terminó este día)</h2>
              <SleepChart night={data.sleep[hKey]} />
            </section>
            <section className="card">
              <h2>Mediciones manuales</h2>
              {(() => {
                const spots = data.spots.filter((s) => dayKey(new Date(s.t)) === hKey).reverse()
                if (!spots.length) return <p className="empty">Ninguna este día.</p>
                return (
                  <ul className="spots">
                    {spots.map((s) => (
                      <li key={s.t}>
                        <span>{new Date(s.t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>{s.kind === 'hr' ? 'Pulso' : 'Oxígeno'}</span>
                        <b>
                          {s.value} {s.kind === 'hr' ? 'lpm' : '%'}
                        </b>
                      </li>
                    ))}
                  </ul>
                )
              })()}
            </section>
            <p className="foot muted">{hDate.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </>
        )}

        {tab === 'ajustes' && (
          <>
            <section className="card">
              <h2>Medición automática</h2>
              {!connected && <p className="muted">Conecta el anillo para cambiar estos ajustes.</p>}
              <label className="toggle">
                <span>
                  Pulso automático
                  <small>El anillo mide solo cada cierto tiempo (gasta algo más de batería).</small>
                </span>
                <input
                  type="checkbox"
                  disabled={!connected || busy || !hrCfg}
                  checked={!!hrCfg?.enabled}
                  onChange={(e) => {
                    const next = { enabled: e.target.checked, interval: hrCfg?.interval || 30 }
                    void run(async () => {
                      await ring.setHrSettings(next.enabled, next.interval)
                      setHrCfg(next)
                    }, 'Ajuste guardado en el anillo.')()
                  }}
                />
              </label>
              <label className="field">
                <span>Cada</span>
                <select
                  disabled={!connected || busy || !hrCfg?.enabled}
                  value={hrCfg?.interval || 30}
                  onChange={(e) => {
                    const next = { enabled: true, interval: Number(e.target.value) }
                    void run(async () => {
                      await ring.setHrSettings(true, next.interval)
                      setHrCfg(next)
                    }, 'Ajuste guardado en el anillo.')()
                  }}
                >
                  {[...new Set([...INTERVALS, hrCfg?.interval || 30])]
                    .sort((a, b) => a - b)
                    .map((m) => (
                      <option key={m} value={m}>
                        {m} minutos
                      </option>
                    ))}
                </select>
              </label>
              <label className="toggle">
                <span>
                  Oxígeno automático
                  <small>Mide SpO₂ de forma periódica, sobre todo durante el sueño.</small>
                </span>
                <input
                  type="checkbox"
                  disabled={!connected || busy || spo2Auto === undefined}
                  checked={!!spo2Auto}
                  onChange={(e) => {
                    const v = e.target.checked
                    void run(async () => {
                      await ring.setSpo2Settings(v)
                      setSpo2Auto(v)
                    }, 'Ajuste guardado en el anillo.')()
                  }}
                />
              </label>
            </section>

            <section className="card">
              <h2>Avisos del teléfono en el anillo</h2>
              {!phoneNotifications ? (
                <p className="muted small">Disponible solo en la app de Android.</p>
              ) : !notifyCfg ? (
                <p className="muted small">Cargando…</p>
              ) : (
                <>
                  <label className="toggle">
                    <span>
                      Avisarme en el anillo
                      <small>Cuando llegue una notificación, el anillo se enciende o vibra. Funciona con la app en segundo plano (no cerrada).</small>
                    </span>
                    <input type="checkbox" checked={notifyCfg.enabled} onChange={(e) => updateNotify({ enabled: e.target.checked })} />
                  </label>
                  {!notifyCfg.access && (
                    <div className="callout">
                      <p className="small">Android necesita que permitas a Mi Anillo leer las notificaciones (no se guardan ni se envían a ningún sitio).</p>
                      <button className="btn primary" onClick={run(async () => phoneNotifications?.openSettings())}>
                        Dar acceso a notificaciones
                      </button>
                    </div>
                  )}
                  <div className="chips">
                    {NOTIFY_KINDS.map(([k, label]) => {
                      const on = notifyCfg.kinds.includes(k)
                      return (
                        <button
                          key={k}
                          className={on ? 'chip on' : 'chip'}
                          disabled={!notifyCfg.enabled}
                          onClick={() => updateNotify({ kinds: on ? notifyCfg.kinds.filter((x) => x !== k) : [...notifyCfg.kinds, k] })}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  <label className="toggle">
                    <span>
                      Aviso fuerte
                      <small>Además usa “buscar anillo”, para que se note en cualquier modelo.</small>
                    </span>
                    <input type="checkbox" disabled={!notifyCfg.enabled} checked={notifyCfg.strong} onChange={(e) => updateNotify({ strong: e.target.checked })} />
                  </label>
                </>
              )}
            </section>

            <section className="card">
              <h2>Alertas</h2>
              <label className="toggle">
                <span>
                  Avisarme
                  <small>Vibra y muestra un aviso si una lectura sale de estos límites.</small>
                </span>
                <input type="checkbox" checked={settings.alertsOn} onChange={(e) => setSettings({ ...settings, alertsOn: e.target.checked })} />
              </label>
              <NumberField label="Pulso alto (lpm)" value={settings.hrHigh} min={60} max={220} onChange={(v) => setSettings({ ...settings, hrHigh: v })} />
              <NumberField label="Pulso bajo (lpm)" value={settings.hrLow} min={25} max={100} onChange={(v) => setSettings({ ...settings, hrLow: v })} />
              <NumberField label="Oxígeno bajo (%)" value={settings.spo2Low} min={80} max={99} onChange={(v) => setSettings({ ...settings, spo2Low: v })} />
              <NumberField label="Meta de pasos" value={settings.stepGoal} min={1000} max={50000} step={500} onChange={(v) => setSettings({ ...settings, stepGoal: v })} />
              <NumberField label="Meta de calorías" value={settings.kcalGoal ?? 400} min={50} max={3000} step={50} onChange={(v) => setSettings({ ...settings, kcalGoal: v })} />
              <p className="muted small">Las alertas son orientativas; el anillo no es un dispositivo médico.</p>
            </section>

            <section className="card">
              <h2>Anillo</h2>
              <div className="row wrap">
                <button className="btn" disabled={!connected || busy} onClick={run(() => ring.find(), 'El anillo debería encenderse o vibrar.')}>
                  Buscar mi anillo
                </button>
                <button className="btn" disabled={!connected || busy} onClick={sync}>
                  Sincronizar
                </button>
                <button
                  className="btn"
                  disabled={!connected || busy}
                  onClick={run(async () => {
                    const b = await ring.battery()
                    setBattery(b)
                    info(`Batería: ${b.level}%${b.charging ? ' (cargando)' : ''}`)
                  })}
                >
                  Batería
                </button>
                {connected && (
                  <button className="btn" onClick={disconnect}>
                    Desconectar
                  </button>
                )}
              </div>
              {settings.deviceId && (
                <p className="muted small">
                  {settings.deviceName} · {settings.deviceId}{' '}
                  <button
                    className="link"
                    onClick={async () => {
                      await disconnect()
                      setSettings({ ...settings, deviceId: undefined, deviceName: undefined })
                    }}
                  >
                    Olvidar
                  </button>
                </p>
              )}
            </section>

            <section className="card">
              <h2>Tus datos</h2>
              <p className="muted small">Se guardan solo en este teléfono. Puedes exportarlos a Excel/Sheets en formato CSV.</p>
              <div className="row wrap">
                <button className="btn primary" onClick={run(() => shareText(toCsvSafe(data), `anillo-${todayKey}.csv`))}>
                  Exportar CSV
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    if (confirm('¿Borrar todo el historial guardado en el teléfono? Lo que siga en el anillo se puede volver a descargar.')) setData({ hr: {}, steps: {}, sleep: {}, spots: [], workouts: [], breaths: [] })
                  }}
                >
                  Borrar historial
                </button>
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <h2>Registro técnico</h2>
                <button className="link" onClick={() => setShowLog(!showLog)}>
                  {showLog ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              <p className="muted small">Muestra los paquetes Bluetooth. Las líneas con ★ son eventos que envía el anillo por su cuenta (toques, gestos…).</p>
              {showLog && (
                <>
                  <div className="row">
                    <button className="btn" onClick={run(() => shareText(log.join('\n'), 'registro-anillo.txt', 'text/plain'))}>
                      Compartir registro
                    </button>
                    <button className="btn" onClick={() => setLog([])}>
                      Limpiar
                    </button>
                  </div>
                  <pre className="log">{log.join('\n') || 'Vacío'}</pre>
                </>
              )}
            </section>
            <p className="foot muted">Mi Anillo · {isNative ? 'app Android' : 'versión web'} · Compatible con anillos que usan la app QRing</p>
          </>
        )}
      </main>

      {screen === 'camera' && (
        <CameraScreen
          connected={connected}
          signature={settings.cameraSig}
          onLearn={(sig) => {
            setSettings((s) => ({ ...s, cameraSig: sig }))
            info('Toque aprendido. Ahora el anillo dispara la cámara.')
          }}
          onClose={() => setScreen(undefined)}
        />
      )}
      {screen === 'breathe' && (
        <BreatheScreen connected={connected} onSave={(b) => setData((d) => ({ ...d, breaths: [...(d.breaths ?? []), b].slice(-500) }))} onClose={() => setScreen(undefined)} />
      )}
      {screen === 'awards' && <AwardsScreen data={data} settings={settings} onClose={() => setScreen(undefined)} />}

      <nav className="tabs">
        {(
          [
            ['hoy', IconHome, 'Hoy'],
            ['entreno', IconRun, 'Entreno'],
            ['historial', IconChart, 'Historial'],
            ['ajustes', IconSettings, 'Ajustes'],
          ] as const
        ).map(([id, Icon, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            <Icon size={22} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function Metric(props: { kind: string; title: string; unit: string; icon: ReactNode; value?: number; sub: string; running?: boolean; onMeasure?: () => void }) {
  return (
    <section className={`card metric ${props.kind} ${props.running ? 'running' : ''}`}>
      <div className="metric-head">
        <span className="metric-icon">{props.icon}</span>
        {props.title}
      </div>
      <div className="metric-value">
        {props.value || '--'}
        <small>{props.unit}</small>
      </div>
      <small className="muted">{props.sub}</small>
      <button className="btn small" disabled={!props.onMeasure} onClick={props.onMeasure}>
        {props.running ? 'Midiendo…' : 'Medir ahora'}
      </button>
    </section>
  )
}

function NumberField(props: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(props.value))
  useEffect(() => setText(String(props.value)), [props.value])
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const v = Math.round(Number(text))
          if (Number.isFinite(v) && v >= props.min && v <= props.max) props.onChange(v)
          else setText(String(props.value))
        }}
      />
    </label>
  )
}

/** QRing-family rings advertise names like "R02_A1B2", "R06_…", "R10_…", "COLMI…" or the retailer's name. */
function likelyRing(d: FoundDevice) {
  return /^(R\d{2}|COLMI|QRING|RING|KOR|K[ÖO]R|LEOTEC|SR\d|H59|RY\d)/i.test(d.name) || /ring|anillo|k[öo]r/i.test(d.name) ? 1 : 0
}

function signal(rssi: number) {
  return rssi > -60 ? '▂▄▆█' : rssi > -75 ? '▂▄▆' : rssi > -88 ? '▂▄' : '▂'
}

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'ahora mismo'
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `hace ${h} h`
  return new Date(t).toLocaleDateString('es')
}

function toCsvSafe(d: Data) {
  // Excel opens UTF-8 CSV correctly (ñ, tildes) when it starts with a BOM.
  return '\uFEFF' + toCsv(d)
}
