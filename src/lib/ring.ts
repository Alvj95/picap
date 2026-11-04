import { transport, type Channel } from './ble'

/**
 * QRing / Colmi R0x protocol (also used by clones such as the Leotec Kör Mau).
 * Main channel: 16-byte packets = [command, 14 payload bytes, checksum (sum of the first 15 bytes & 0xff)].
 * Replies come back on the notify characteristic with the same command byte (| 0x80 on error).
 * References: Gadgetbridge (ColmiR0x support) and tahnok/colmi_r02_client.
 */

export const CMD = {
  SET_TIME: 0x01,
  BATTERY: 0x03,
  HR_HISTORY: 0x15,
  HR_SETTINGS: 0x16,
  SPO2_SETTINGS: 0x2c,
  STEPS: 0x43,
  FIND: 0x50,
  REALTIME_START: 0x69,
  REALTIME_STOP: 0x6a,
} as const

export type Reading = 'hr' | 'spo2'
const READING_TYPE: Record<Reading, number> = { hr: 1, spo2: 3 }

export interface HrDay {
  /** Minutes between samples (usually 5). */
  range: number
  /** One value per slot starting at local midnight; 0 = no reading. */
  values: number[]
}
export interface StepSlot {
  /** Quarter-hour index of the day (0..95). */
  slot: number
  steps: number
  calories: number
  distance: number
}
export interface SleepStage {
  type: 'light' | 'deep' | 'rem' | 'awake'
  minutes: number
}
export interface SleepNight {
  /** Days before today the night ended on (0 = last night). */
  daysAgo: number
  /** Minutes after midnight; start may be the previous evening (start > end). */
  start: number
  end: number
  stages: SleepStage[]
}

const bcd = (n: number) => ((Math.floor(n / 10) & 0xf) << 4) | (n % 10 & 0xf)
const u16 = (p: Uint8Array, i: number) => p[i] | (p[i + 1] << 8)

export function packet(cmd: number, payload: number[] = []): Uint8Array {
  const p = new Uint8Array(16)
  p[0] = cmd
  payload.slice(0, 14).forEach((b, i) => (p[i + 1] = b & 0xff))
  let sum = 0
  for (let i = 0; i < 15; i++) sum += p[i]
  p[15] = sum & 0xff
  return p
}

type Listener = (p: Uint8Array) => void

class Ring {
  private mainListeners = new Set<Listener>()
  private bigListeners = new Set<Listener>()
  /** Every packet that nobody was waiting for (gestures, ring-initiated events…), for the technical log. */
  onUnsolicited?: (channel: Channel, p: Uint8Array) => void
  onPacket?: (dir: 'in' | 'out', channel: Channel, p: Uint8Array) => void
  private chain: Promise<unknown> = Promise.resolve()

  constructor() {
    transport.onNotify((channel, p) => {
      this.onPacket?.('in', channel, p)
      const set = channel === 'big' ? this.bigListeners : this.mainListeners
      if (set.size === 0) this.onUnsolicited?.(channel, p)
      set.forEach((l) => l(p))
    })
  }

  private async send(channel: Channel, data: Uint8Array) {
    this.onPacket?.('out', channel, data)
    await transport.write(channel, data)
  }

  /** Runs exchanges one at a time so replies never interleave. */
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn)
    this.chain = run.catch(() => {})
    return run
  }

  /**
   * Sends a packet and feeds every reply with the same command byte to `onReply` until it returns true.
   * Resolves on completion, or on timeout if `partialOk` (multi-packet syncs keep what arrived).
   */
  private exchange(
    cmd: number,
    payload: number[],
    onReply: (p: Uint8Array) => boolean,
    { timeoutMs = 4000, partialOk = false, channel = 'main' as Channel, raw }: { timeoutMs?: number; partialOk?: boolean; channel?: Channel; raw?: Uint8Array } = {},
  ): Promise<void> {
    return this.exclusive(
      () =>
        new Promise<void>((resolve, reject) => {
          const set = channel === 'big' ? this.bigListeners : this.mainListeners
          let timer = 0
          const done = (err?: Error) => {
            clearTimeout(timer)
            set.delete(listener)
            if (err) reject(err)
            else resolve()
          }
          const arm = () => {
            clearTimeout(timer)
            timer = window.setTimeout(() => (partialOk ? done() : done(new Error('El anillo no respondió a tiempo.'))), timeoutMs)
          }
          const listener: Listener = (p) => {
            if (channel === 'main' && p[0] === (cmd | 0x80)) return done(new Error('El anillo rechazó el comando.'))
            if (channel === 'main' && p[0] !== cmd) return
            arm()
            try {
              if (onReply(p)) done()
            } catch (e) {
              done(e as Error)
            }
          }
          set.add(listener)
          arm()
          this.send(channel, raw ?? packet(cmd, payload)).catch((e) => done(e as Error))
        }),
    )
  }

  /** Fire-and-forget command (no reply expected). */
  command(cmd: number, payload: number[] = []) {
    return this.exclusive(() => this.send('main', packet(cmd, payload)))
  }

  // ---------- basic ----------

  async setTime(d = new Date()) {
    // Last byte = language (1 = English, the only other option is Chinese).
    const payload = [bcd(d.getFullYear() % 100), bcd(d.getMonth() + 1), bcd(d.getDate()), bcd(d.getHours()), bcd(d.getMinutes()), bcd(d.getSeconds()), 1]
    await this.exchange(CMD.SET_TIME, payload, () => true, { timeoutMs: 2500, partialOk: true })
  }

  async battery(): Promise<{ level: number; charging: boolean }> {
    let res = { level: 0, charging: false }
    await this.exchange(CMD.BATTERY, [], (p) => {
      res = { level: p[1], charging: p[2] === 1 }
      return true
    })
    return res
  }

  find() {
    return this.command(CMD.FIND, [0x55, 0xaa])
  }

  // ---------- settings ----------

  async hrSettings(): Promise<{ enabled: boolean; interval: number }> {
    let res = { enabled: false, interval: 0 }
    await this.exchange(CMD.HR_SETTINGS, [0x01], (p) => {
      res = { enabled: p[2] === 1, interval: p[3] }
      return true
    })
    return res
  }

  async setHrSettings(enabled: boolean, interval: number) {
    await this.exchange(CMD.HR_SETTINGS, [0x02, enabled ? 1 : 2, interval], () => true, { timeoutMs: 2500, partialOk: true })
  }

  async spo2Settings(): Promise<boolean> {
    let enabled = false
    await this.exchange(CMD.SPO2_SETTINGS, [0x01], (p) => {
      enabled = p[2] === 1
      return true
    })
    return enabled
  }

  async setSpo2Settings(enabled: boolean) {
    await this.exchange(CMD.SPO2_SETTINGS, [0x02, enabled ? 1 : 0], () => true, { timeoutMs: 2500, partialOk: true })
  }

  // ---------- history ----------

  /** Heart-rate log for one local day. The ring stores local time as if it were UTC. */
  async hrHistory(day: Date): Promise<HrDay | null> {
    const ts = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) / 1000
    const values: number[] = []
    let size = 0
    let range = 5
    let empty = false
    await this.exchange(
      CMD.HR_HISTORY,
      [ts & 0xff, (ts >> 8) & 0xff, (ts >> 16) & 0xff, (ts >>> 24) & 0xff],
      (p) => {
        const sub = p[1]
        if (sub === 0xff) {
          empty = true
          return true
        }
        if (sub === 0) {
          size = p[2]
          range = p[3] || 5
          return size <= 1
        }
        values.push(...(sub === 1 ? p.slice(6, 15) : p.slice(2, 15)))
        return size > 0 && sub >= size - 1
      },
      { timeoutMs: 3000, partialOk: true },
    )
    if (empty || values.length === 0) return null
    return { range, values: values.slice(0, Math.ceil(1440 / range)) }
  }

  /** Step/calorie/distance log per quarter hour. dayOffset 0 = today. */
  async steps(dayOffset: number): Promise<StepSlot[]> {
    const slots: StepSlot[] = []
    let newCalories = false
    await this.exchange(
      CMD.STEPS,
      [dayOffset, 0x0f, 0x00, 0x5f, 0x01],
      (p) => {
        if (p[1] === 0xff) return true
        if (p[1] === 0xf0) {
          newCalories = p[3] === 1
          return false
        }
        // p[1..3] = BCD date of the record, p[4] = quarter-hour slot, p[5]/p[6] = packet index/total.
        const calories = u16(p, 7) * (newCalories ? 10 : 1)
        slots.push({ slot: p[4], calories, steps: u16(p, 9), distance: u16(p, 11) })
        return p[5] >= p[6] - 1
      },
      { timeoutMs: 3000, partialOk: true },
    )
    return slots
  }

  /** Sleep log over the big-data channel (the last ~7 nights). */
  async sleep(): Promise<SleepNight[]> {
    let buf = new Uint8Array(0)
    let nights: SleepNight[] = []
    const raw = new Uint8Array([0xbc, 0x27, 0x01, 0x00, 0xff, 0x00, 0xff])
    await this.exchange(
      0xbc,
      [],
      (p) => {
        if (buf.length === 0 && (p[0] !== 0xbc || p[1] !== 0x27)) return false
        const merged = new Uint8Array(buf.length + p.length)
        merged.set(buf)
        merged.set(p, buf.length)
        buf = merged
        if (buf.length < 6) return false
        const len = u16(buf, 2)
        if (buf.length < len + 6) return false
        nights = parseSleep(buf, len)
        return true
      },
      { channel: 'big', raw, timeoutMs: 5000 },
    )
    return nights
  }

  // ---------- live measurement ----------

  /**
   * Starts a live HR or SpO2 measurement and resolves with the final value.
   * onValue receives every intermediate reading.
   */
  measure(kind: Reading, onValue?: (v: number) => void, wanted = kind === 'hr' ? 6 : 3): Promise<number> {
    const type = READING_TYPE[kind]
    return this.exclusive(
      () =>
        new Promise<number>((resolve, reject) => {
          const readings: number[] = []
          let idle = 0
          let timer = 0
          const finish = (err?: Error) => {
            clearTimeout(timer)
            this.mainListeners.delete(listener)
            this.send('main', packet(CMD.REALTIME_STOP, [type, 0, 0])).catch(() => {})
            if (err) return reject(err)
            if (readings.length === 0) return reject(new Error('No se obtuvo lectura. Ajusta el anillo al dedo y quédate quieto.'))
            const sorted = [...readings].sort((a, b) => a - b)
            resolve(kind === 'hr' ? readings[readings.length - 1] : sorted[Math.floor(sorted.length / 2)])
          }
          const tick = () => {
            clearTimeout(timer)
            timer = window.setTimeout(() => {
              idle++
              if (idle > 15) return finish()
              // Ask the ring to keep measuring when it goes quiet.
              this.send('main', packet(CMD.REALTIME_START, [type, 3])).catch(() => {})
              tick()
            }, 2000)
          }
          const listener: Listener = (p) => {
            if (p[0] !== CMD.REALTIME_START || p[1] !== type) return
            if (p[2] !== 0) return finish(new Error('El anillo no pudo medir (¿está puesto?).'))
            tick()
            if (p[3] === 0) return
            readings.push(p[3])
            onValue?.(p[3])
            if (readings.length >= wanted) finish()
          }
          this.mainListeners.add(listener)
          tick()
          this.send('main', packet(CMD.REALTIME_START, [type, 1])).catch((e) => finish(e as Error))
        }),
    )
  }
}

const STAGE: Record<number, SleepStage['type']> = { 2: 'light', 3: 'deep', 4: 'rem', 5: 'awake' }

function parseSleep(b: Uint8Array, len: number): SleepNight[] {
  if (len < 2) return []
  const end = len + 6
  const nights: SleepNight[] = []
  const days = b[6]
  let i = 7
  for (let d = 0; d < days && i + 6 <= end; d++) {
    const daysAgo = b[i]
    const dayBytes = b[i + 1]
    const start = u16(b, i + 2)
    const stop = u16(b, i + 4)
    const stages: SleepStage[] = []
    const next = i + 2 + dayBytes
    for (let j = i + 6; j + 1 < next && j + 1 < end; j += 2) {
      const type = STAGE[b[j]]
      if (type) stages.push({ type, minutes: b[j + 1] })
    }
    nights.push({ daysAgo, start, end: stop, stages })
    i = next
  }
  return nights
}

export const ring = new Ring()
