import { toHex } from './ble'
import { ring } from './ring'

/** Ring packets that are status/replies, never a touch or gesture (battery, live readings, notifications). */
export const NOT_A_TOUCH = new Set([0x03, 0x15, 0x16, 0x2c, 0x36, 0x37, 0x38, 0x39, 0x43, 0x69, 0x6a, 0x73])

/** Calls cb for every touch/gesture packet the ring sends on its own (hex string of the packet). */
export function onRingInput(cb: (hex: string) => void) {
  return ring.onEvent((channel, p) => {
    if (channel !== 'main' || NOT_A_TOUCH.has(p[0])) return
    cb(toHex(p))
  })
}

/** Longest common prefix of two packets, without the trailing checksum byte; at least the command byte. */
export function commonPrefix(a: string, b: string) {
  const max = Math.min(a.length, b.length) - 2
  let i = 0
  while (i < max && a[i] === b[i]) i++
  i -= i % 2
  return i >= 2 ? a.slice(0, i) : ''
}
