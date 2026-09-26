// On-device AI (runs in the phone/browser, free, no server). Models are downloaded
// from Hugging Face on first use and then cached by the browser.
import type { ProgressInfo } from '@huggingface/transformers'

export type AiProgress = (pct: number, label: string) => void

const MODELS = {
  depth: { task: 'depth-estimation', id: 'onnx-community/depth-anything-v2-small', label: 'Modelo de profundidad' },
  background: { task: 'background-removal', id: 'briaai/RMBG-1.4', label: 'Modelo de recorte' },
} as const

type ModelKey = keyof typeof MODELS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pipes: Partial<Record<ModelKey, Promise<any>>> = {}

const MAX_INPUT = 768 // keeps phone inference to a few seconds

async function getPipe(key: ModelKey, onProgress: AiProgress) {
  if (!pipes[key]) {
    const m = MODELS[key]
    pipes[key] = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers')
      env.allowLocalModels = false
      const webgpu = 'gpu' in navigator
      return pipeline(m.task, m.id, {
        device: webgpu ? 'webgpu' : 'wasm',
        dtype: webgpu ? 'fp16' : 'q8',
        progress_callback: (p: ProgressInfo) => {
          if (p.status === 'progress_total') onProgress(p.progress, `Descargando ${m.label.toLowerCase()} (solo la primera vez)`)
        },
      })
    })().catch((e) => {
      delete pipes[key] // allow retrying after a failed download
      throw e
    })
  }
  return pipes[key]!
}

function toInputCanvas(img: CanvasImageSource & { width: number; height: number }) {
  const k = Math.min(1, MAX_INPUT / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k)
  c.height = Math.round(img.height * k)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c
}

function friendly(e: unknown): Error {
  const msg = (e as Error)?.message ?? String(e)
  if (/fetch|network|Failed to load/i.test(msg)) return new Error('No se pudo descargar el modelo de IA. Revisa tu conexión e inténtalo de nuevo.')
  return new Error(`La IA falló: ${msg}`)
}

/** Depth map as a grayscale canvas (white = near), same aspect as the image. */
export async function estimateDepth(img: CanvasImageSource & { width: number; height: number }, onProgress: AiProgress) {
  try {
    const pipe = await getPipe('depth', onProgress)
    onProgress(100, 'Analizando profundidad…')
    const out = await pipe(toInputCanvas(img))
    return out.depth.toCanvas() as HTMLCanvasElement
  } catch (e) {
    throw friendly(e)
  }
}

/** Subject cut-out: RGBA canvas with a transparent background. */
export async function removeBackground(img: CanvasImageSource & { width: number; height: number }, onProgress: AiProgress) {
  try {
    const pipe = await getPipe('background', onProgress)
    onProgress(100, 'Recortando sujeto…')
    const out = await pipe(toInputCanvas(img))
    return (Array.isArray(out) ? out[0] : out).toCanvas() as HTMLCanvasElement
  } catch (e) {
    throw friendly(e)
  }
}

export type BackgroundMode = 'blur' | 'color' | 'ai'

/**
 * Composites the cut-out subject over a new background at the original resolution.
 * `bg` is used for the 'ai' mode (an AI-generated scene).
 */
export function composeSubject(
  original: CanvasImageSource & { width: number; height: number },
  cutout: HTMLCanvasElement,
  mode: BackgroundMode,
  opts: { color?: string; bg?: CanvasImageSource & { width: number; height: number } } = {},
) {
  const W = original.width
  const H = original.height
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  if (mode === 'blur') {
    ctx.filter = `blur(${Math.round(Math.max(W, H) / 60)}px) brightness(0.85)`
    ctx.drawImage(original, -W * 0.05, -H * 0.05, W * 1.1, H * 1.1)
    ctx.filter = 'none'
  } else if (mode === 'color') {
    ctx.fillStyle = opts.color ?? '#111'
    ctx.fillRect(0, 0, W, H)
  } else if (opts.bg) {
    const k = Math.max(W / opts.bg.width, H / opts.bg.height)
    ctx.drawImage(opts.bg, (W - opts.bg.width * k) / 2, (H - opts.bg.height * k) / 2, opts.bg.width * k, opts.bg.height * k)
  }
  // Subject at full resolution: original pixels masked by the (upscaled) cut-out alpha.
  const subject = document.createElement('canvas')
  subject.width = W
  subject.height = H
  const s = subject.getContext('2d')!
  s.drawImage(cutout, 0, 0, W, H)
  s.globalCompositeOperation = 'source-in'
  s.drawImage(original, 0, 0, W, H)
  ctx.drawImage(subject, 0, 0)
  return c
}
