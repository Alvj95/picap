// Camera motion presets. Each preset maps eased progress p (0..1) to a 2D
// camera transform applied to the still image, emulating real camera moves.

export type CameraTransform = {
  scale: number // zoom factor (1 = image covers frame exactly)
  x: number // horizontal offset, fraction of frame width
  y: number // vertical offset, fraction of frame height
  rotate: number // radians
}

export type MotionPreset = {
  id: string
  name: string
  description: string
  easing: (t: number) => number
  at: (p: number, t: number, k: number) => CameraTransform
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInExpo = (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10))
const linear = (t: number) => t

const base: CameraTransform = { scale: 1, x: 0, y: 0, rotate: 0 }
const T = (o: Partial<CameraTransform>): CameraTransform => ({ ...base, ...o })

// Deterministic pseudo-noise so previews and exports shake identically.
const noise = (t: number, seed: number) =>
  Math.sin(t * 13.1 + seed) * 0.5 + Math.sin(t * 29.7 + seed * 2.3) * 0.3 + Math.sin(t * 61.3 + seed * 4.1) * 0.2

export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: 'dolly-in',
    name: 'Dolly In',
    description: 'Acercamiento suave hacia el sujeto',
    easing: easeInOut,
    at: (p, _t, k) => T({ scale: 1 + 0.35 * k * p }),
  },
  {
    id: 'dolly-out',
    name: 'Dolly Out',
    description: 'La cámara se aleja revelando la escena',
    easing: easeInOut,
    at: (p, _t, k) => T({ scale: 1 + 0.35 * k * (1 - p) }),
  },
  {
    id: 'crash-zoom-in',
    name: 'Crash Zoom In',
    description: 'Zoom violento y rápido',
    easing: easeInExpo,
    at: (p, _t, k) => T({ scale: 1 + 1.2 * k * p }),
  },
  {
    id: 'crash-zoom-out',
    name: 'Crash Zoom Out',
    description: 'Arranca pegado y sale disparado',
    easing: easeOut,
    at: (p, _t, k) => T({ scale: 1 + 1.2 * k * (1 - p) }),
  },
  {
    id: 'pan-left',
    name: 'Pan Left',
    description: 'Paneo horizontal a la izquierda',
    easing: easeInOut,
    at: (p, _t, k) => T({ scale: 1.15, x: 0.12 * k * (0.5 - p) * -1 }),
  },
  {
    id: 'pan-right',
    name: 'Pan Right',
    description: 'Paneo horizontal a la derecha',
    easing: easeInOut,
    at: (p, _t, k) => T({ scale: 1.15, x: 0.12 * k * (p - 0.5) * -1 }),
  },
  {
    id: 'tilt-up',
    name: 'Tilt Up',
    description: 'La cámara sube mirando hacia arriba',
    easing: easeInOut,
    at: (p, _t, k) => T({ scale: 1.15, y: 0.12 * k * (0.5 - p) * -1 }),
  },
  {
    id: 'tilt-down',
    name: 'Tilt Down',
    description: 'La cámara baja lentamente',
    easing: easeInOut,
    at: (p, _t, k) => T({ scale: 1.15, y: 0.12 * k * (p - 0.5) * -1 }),
  },
  {
    id: 'orbit',
    name: '360 Orbit',
    description: 'Giro envolvente alrededor del sujeto',
    easing: easeInOut,
    at: (p, _t, k) =>
      T({ scale: 1.2 + 0.1 * Math.sin(p * Math.PI), rotate: 0.18 * k * (p - 0.5), x: 0.06 * k * Math.sin(p * Math.PI * 2) }),
  },
  {
    id: 'spiral',
    name: 'Spiral Zoom',
    description: 'Zoom con rotación en espiral',
    easing: easeInOut,
    at: (p, _t, k) => T({ scale: 1 + 0.6 * k * p, rotate: 0.5 * k * p }),
  },
  {
    id: 'dutch',
    name: 'Dutch Angle',
    description: 'Inclinación dramática de cámara',
    easing: easeInOut,
    at: (p, _t, k) => T({ scale: 1.1 + 0.1 * p, rotate: -0.22 * k * p }),
  },
  {
    id: 'handheld',
    name: 'Handheld',
    description: 'Cámara en mano, movimiento orgánico',
    easing: linear,
    at: (_p, t, k) =>
      T({ scale: 1.08, x: 0.012 * k * noise(t, 1), y: 0.012 * k * noise(t, 7), rotate: 0.006 * k * noise(t, 3) }),
  },
  {
    id: 'earthquake',
    name: 'Earthquake',
    description: 'Temblor intenso de cámara',
    easing: linear,
    at: (_p, t, k) =>
      T({ scale: 1.12, x: 0.03 * k * noise(t * 4, 2), y: 0.03 * k * noise(t * 4, 9), rotate: 0.015 * k * noise(t * 4, 5) }),
  },
  {
    id: 'push-tilt',
    name: 'Crane Up',
    description: 'Grúa que sube y se acerca',
    easing: easeInOut,
    at: (p, _t, k) => T({ scale: 1.1 + 0.25 * k * p, y: 0.1 * k * (0.5 - p) }),
  },
  {
    id: 'heartbeat',
    name: 'Heartbeat',
    description: 'Pulsos de zoom rítmicos',
    easing: linear,
    at: (_p, t, k) => {
      const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.2)), 8)
      return T({ scale: 1.05 + 0.12 * k * beat })
    },
  },
  {
    id: 'static',
    name: 'Static',
    description: 'Sin movimiento, solo efectos',
    easing: linear,
    at: () => T({ scale: 1 }),
  },
]

export type Effect = { id: string; name: string }

export const EFFECTS: Effect[] = [
  { id: 'none', name: 'Ninguno' },
  { id: 'cinematic', name: 'Cinemático' },
  { id: 'grain', name: 'Film Grain' },
  { id: 'vhs', name: 'VHS Glitch' },
  { id: 'noir', name: 'Noir B/N' },
  { id: 'leak', name: 'Light Leak' },
  { id: 'dream', name: 'Dreamy Glow' },
]
