import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

/**
 * Transport layer: raw bytes in and out of the ring.
 * - Android app: our own native plugin (android/.../RingBlePlugin.java).
 * - Browser: Web Bluetooth (Chrome on Android / desktop). Safari on iPhone does not support it.
 */

export type Channel = 'main' | 'big'
export interface FoundDevice {
  deviceId: string
  name: string
  rssi?: number
}

export const MAIN_SERVICE = '6e40fff0-b5a3-f393-e0a9-e50e24dcca9e'
const MAIN_WRITE = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'
const MAIN_NOTIFY = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'
const BIG_SERVICE = 'de5bf728-d711-4e47-af26-65e3012a5dc7'
const BIG_WRITE = 'de5bf72a-d711-4e47-af26-65e3012a5dc7'
const BIG_NOTIFY = 'de5bf729-d711-4e47-af26-65e3012a5dc7'

export interface Transport {
  /** Calls onDevice for every ring seen. Web: opens the browser's chooser and reports the single pick. */
  scan(onDevice: (d: FoundDevice) => void, timeoutMs?: number): Promise<void>
  stopScan(): Promise<void>
  connect(deviceId: string): Promise<{ bigData: boolean; name?: string }>
  disconnect(): Promise<void>
  write(channel: Channel, data: Uint8Array): Promise<void>
  onNotify(cb: (channel: Channel, data: Uint8Array) => void): void
  onDisconnect(cb: () => void): void
  /** True when scan() shows a system chooser instead of streaming results. */
  readonly chooser: boolean
}

export const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
const fromHex = (s: string) => new Uint8Array((s.match(/../g) ?? []).map((h) => parseInt(h, 16)))

// ---------- native ----------

interface RingBleNative {
  scan(o: { timeoutMs: number }): Promise<void>
  stopScan(): Promise<void>
  connect(o: { deviceId: string }): Promise<{ deviceId: string; name?: string; bigData: boolean }>
  disconnect(): Promise<void>
  write(o: { channel: Channel; value: string }): Promise<void>
  addListener(ev: 'device', cb: (d: FoundDevice) => void): Promise<PluginListenerHandle>
  addListener(ev: 'notify', cb: (d: { channel: Channel; value: string }) => void): Promise<PluginListenerHandle>
  addListener(ev: 'disconnected', cb: () => void): Promise<PluginListenerHandle>
  addListener(ev: 'phoneNotification', cb: (d: { app: string; kind: string; delivered: boolean }) => void): Promise<PluginListenerHandle>
  getNotifyConfig(): Promise<NotifyConfig>
  setNotifyConfig(o: Partial<Omit<NotifyConfig, 'access'>>): Promise<NotifyConfig>
  openNotificationSettings(): Promise<void>
}

export type NotifyKind = 'call' | 'whatsapp' | 'sms' | 'social' | 'email' | 'other'
export interface NotifyConfig {
  enabled: boolean
  /** Also send "find ring" so every model reacts visibly. */
  strong: boolean
  kinds: NotifyKind[]
  /** Android notification access granted to the app. */
  access: boolean
  /** False in the standard APK (no notification listener, so Play Protect allows it). */
  supported: boolean
}

const nativePlugin = registerPlugin<RingBleNative>('RingBle')

class NativeTransport implements Transport {
  readonly chooser = false
  private plugin = nativePlugin
  private notifyCbs: ((c: Channel, d: Uint8Array) => void)[] = []
  private discCbs: (() => void)[] = []

  constructor() {
    void this.plugin.addListener('notify', (e) => this.notifyCbs.forEach((cb) => cb(e.channel, fromHex(e.value))))
    void this.plugin.addListener('disconnected', () => this.discCbs.forEach((cb) => cb()))
  }

  async scan(onDevice: (d: FoundDevice) => void, timeoutMs = 12000) {
    const h = await this.plugin.addListener('device', onDevice)
    try {
      await this.plugin.scan({ timeoutMs })
    } finally {
      await h.remove()
    }
  }
  stopScan() {
    return this.plugin.stopScan()
  }
  connect(deviceId: string) {
    return this.plugin.connect({ deviceId })
  }
  disconnect() {
    return this.plugin.disconnect()
  }
  write(channel: Channel, data: Uint8Array) {
    return this.plugin.write({ channel, value: toHex(data) })
  }
  onNotify(cb: (c: Channel, d: Uint8Array) => void) {
    this.notifyCbs.push(cb)
  }
  onDisconnect(cb: () => void) {
    this.discCbs.push(cb)
  }
}

// ---------- Web Bluetooth ----------

/* Minimal typings: Web Bluetooth is not in the default TS DOM lib. */
interface WbChar extends EventTarget {
  value?: DataView
  startNotifications(): Promise<WbChar>
  writeValueWithoutResponse?(d: BufferSource): Promise<void>
  writeValue(d: BufferSource): Promise<void>
}
interface WbService {
  getCharacteristic(u: string): Promise<WbChar>
}
interface WbServer {
  connected: boolean
  connect(): Promise<WbServer>
  disconnect(): void
  getPrimaryService(u: string): Promise<WbService>
}
interface WbDevice extends EventTarget {
  id: string
  name?: string
  gatt?: WbServer
}
interface WbBluetooth {
  requestDevice(o: unknown): Promise<WbDevice>
  getDevices?(): Promise<WbDevice[]>
}
const webBt = () => (navigator as Navigator & { bluetooth?: WbBluetooth }).bluetooth

class WebTransport implements Transport {
  readonly chooser = true
  private devices = new Map<string, WbDevice>()
  private device?: WbDevice
  private writes: Partial<Record<Channel, WbChar>> = {}
  private notifyCbs: ((c: Channel, d: Uint8Array) => void)[] = []
  private discCbs: (() => void)[] = []
  private onGattDisconnected = () => this.discCbs.forEach((cb) => cb())

  async scan(onDevice: (d: FoundDevice) => void) {
    const bt = webBt()
    if (!bt) throw new Error('Este navegador no tiene Bluetooth. Usa la app de Android o Chrome.')
    const d = await bt.requestDevice({ acceptAllDevices: true, optionalServices: [MAIN_SERVICE, BIG_SERVICE] })
    this.devices.set(d.id, d)
    onDevice({ deviceId: d.id, name: d.name ?? 'Anillo' })
  }
  async stopScan() {}

  async connect(deviceId: string) {
    let d = this.devices.get(deviceId)
    if (!d) {
      // Chrome can reopen previously allowed devices without a new chooser.
      d = (await webBt()?.getDevices?.())?.find((x) => x.id === deviceId)
      if (!d) throw new Error('Vuelve a elegir el anillo en la lista.')
      this.devices.set(deviceId, d)
    }
    if (!d.gatt) throw new Error('El dispositivo no admite conexión Bluetooth LE.')
    this.device?.removeEventListener('gattserverdisconnected', this.onGattDisconnected)
    this.device = d
    d.addEventListener('gattserverdisconnected', this.onGattDisconnected)
    const server = await d.gatt.connect()
    const main = await server.getPrimaryService(MAIN_SERVICE).catch(() => {
      throw new Error('Este dispositivo no parece un anillo compatible con QRing.')
    })
    this.writes.main = await main.getCharacteristic(MAIN_WRITE)
    await this.listen('main', await main.getCharacteristic(MAIN_NOTIFY))
    let bigData = false
    try {
      const big = await server.getPrimaryService(BIG_SERVICE)
      this.writes.big = await big.getCharacteristic(BIG_WRITE)
      await this.listen('big', await big.getCharacteristic(BIG_NOTIFY))
      bigData = true
    } catch {
      this.writes.big = undefined
    }
    return { bigData, name: d.name }
  }

  private async listen(channel: Channel, ch: WbChar) {
    ch.addEventListener('characteristicvaluechanged', () => {
      const v = ch.value
      if (!v) return
      const bytes = new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength))
      this.notifyCbs.forEach((cb) => cb(channel, bytes))
    })
    await ch.startNotifications()
  }

  async disconnect() {
    this.device?.removeEventListener('gattserverdisconnected', this.onGattDisconnected)
    this.device?.gatt?.disconnect()
    this.device = undefined
    this.writes = {}
  }

  async write(channel: Channel, data: Uint8Array) {
    const ch = this.writes[channel]
    if (!ch) throw new Error('El anillo no está conectado.')
    const buf = new Uint8Array(data)
    try {
      if (!ch.writeValueWithoutResponse) throw new Error('unsupported')
      await ch.writeValueWithoutResponse(buf)
    } catch {
      await ch.writeValue(buf)
    }
  }
  onNotify(cb: (c: Channel, d: Uint8Array) => void) {
    this.notifyCbs.push(cb)
  }
  onDisconnect(cb: () => void) {
    this.discCbs.push(cb)
  }
}

export const isNative = Capacitor.isNativePlatform()
export const bluetoothAvailable = isNative || !!webBt()
export const transport: Transport = isNative ? new NativeTransport() : new WebTransport()

/** Phone-notification forwarding (Android app only; runs natively even in the background). */
export const phoneNotifications = isNative
  ? {
      get: () => nativePlugin.getNotifyConfig(),
      set: (c: Partial<Omit<NotifyConfig, 'access'>>) => nativePlugin.setNotifyConfig(c),
      openSettings: () => nativePlugin.openNotificationSettings(),
      onForward: (cb: (d: { app: string; kind: string; delivered: boolean }) => void) => void nativePlugin.addListener('phoneNotification', cb),
    }
  : null
