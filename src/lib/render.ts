import type { MotionPreset } from './motion'

export type RenderOptions = {
  preset: MotionPreset
  effect: string
  intensity: number
  duration: number // seconds
}

let grainTile: HTMLCanvasElement | null = null
function getGrainTile() {
  if (grainTile) return grainTile
  grainTile = document.createElement('canvas')
  grainTile.width = grainTile.height = 256
  const g = grainTile.getContext('2d')!
  const data = g.createImageData(256, 256)
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.random() * 255
    data.data[i] = data.data[i + 1] = data.data[i + 2] = v
    data.data[i + 3] = 255
  }
  g.putImageData(data, 0, 0)
  return grainTile
}

const BASE_FILTER: Record<string, string> = {
  cinematic: 'contrast(1.12) saturate(1.2)',
  noir: 'grayscale(1) contrast(1.35) brightness(0.95)',
  vhs: 'saturate(1.4) contrast(1.05)',
  dream: 'saturate(1.15) brightness(1.05)',
}

/** Draws a single frame at time `t` seconds into the canvas. */
export function drawFrame(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, t: number, o: RenderOptions) {
  const { width: W, height: H } = ctx.canvas
  const loopT = o.duration > 0 ? (t % o.duration) / o.duration : 0
  const p = o.preset.easing(loopT)
  const tr = o.preset.at(p, t, o.intensity)

  // Never reveal the image edges: grow the zoom enough to cover pans and rotations.
  const aspect = Math.max(W / H, H / W)
  const rot = Math.abs(tr.rotate)
  const rotReq = Math.cos(rot) + Math.sin(rot) * aspect
  const panReq = Math.max(1 + 2 * Math.abs(tr.x), 1 + 2 * Math.abs(tr.y))
  const scale = Math.max(tr.scale, rotReq * panReq)

  const cover = Math.max(W / img.width, H / img.height) * scale
  const dw = img.width * cover
  const dh = img.height * cover

  ctx.save()
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  ctx.filter = BASE_FILTER[o.effect] ?? 'none'
  ctx.translate(W / 2 + tr.x * W, H / 2 + tr.y * H)
  ctx.rotate(tr.rotate)
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
  ctx.restore()

  applyEffect(ctx, o.effect, t)
}

let snapCanvas: HTMLCanvasElement | null = null
function snapshot(src: HTMLCanvasElement) {
  snapCanvas ??= document.createElement('canvas')
  snapCanvas.width = src.width
  snapCanvas.height = src.height
  snapCanvas.getContext('2d')!.drawImage(src, 0, 0)
  return snapCanvas
}

function vignette(ctx: CanvasRenderingContext2D, strength: number) {
  const { width: W, height: H } = ctx.canvas
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) / 2)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${strength})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function grain(ctx: CanvasRenderingContext2D, alpha: number) {
  const { width: W, height: H } = ctx.canvas
  const tile = getGrainTile()
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.globalCompositeOperation = 'overlay'
  const ox = Math.floor(Math.random() * 256)
  const oy = Math.floor(Math.random() * 256)
  for (let x = -ox; x < W; x += 256) for (let y = -oy; y < H; y += 256) ctx.drawImage(tile, x, y)
  ctx.restore()
}

function applyEffect(ctx: CanvasRenderingContext2D, effect: string, t: number) {
  const { width: W, height: H } = ctx.canvas
  switch (effect) {
    case 'cinematic': {
      ctx.save()
      ctx.globalCompositeOperation = 'soft-light'
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, 'rgba(0,120,140,0.35)')
      g.addColorStop(1, 'rgba(255,140,40,0.35)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
      vignette(ctx, 0.5)
      const bar = H * 0.1
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, bar)
      ctx.fillRect(0, H - bar, W, bar)
      break
    }
    case 'grain':
      grain(ctx, 0.35)
      vignette(ctx, 0.35)
      break
    case 'noir':
      grain(ctx, 0.3)
      vignette(ctx, 0.7)
      break
    case 'vhs': {
      // Chromatic aberration: re-draw the frame shifted with additive tint.
      const snap = snapshot(ctx.canvas)
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = 0.25
      ctx.filter = 'sepia(1) hue-rotate(-50deg) saturate(6)'
      ctx.drawImage(snap, 6, 0)
      ctx.filter = 'sepia(1) hue-rotate(160deg) saturate(6)'
      ctx.drawImage(snap, -6, 0)
      ctx.restore()
      // Random horizontal tearing.
      if (Math.sin(t * 7.3) > 0.6) {
        for (let i = 0; i < 3; i++) {
          const y = Math.random() * H
          const h = 4 + Math.random() * 24
          const shift = (Math.random() - 0.5) * 40
          ctx.drawImage(snap, 0, y, W, h, shift, y, W, h)
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2)
      grain(ctx, 0.2)
      break
    }
    case 'leak': {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      const cx = W * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.9)))
      const cy = H * (0.3 + 0.2 * Math.cos(t * 0.7))
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7)
      g.addColorStop(0, 'rgba(255,150,60,0.55)')
      g.addColorStop(0.4, 'rgba(255,60,120,0.25)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
      break
    }
    case 'dream': {
      const snap = snapshot(ctx.canvas)
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = 0.45
      ctx.filter = `blur(${Math.round(Math.min(W, H) / 40)}px)`
      ctx.drawImage(snap, 0, 0)
      ctx.restore()
      vignette(ctx, 0.25)
      break
    }
  }
}

function pickMimeType() {
  const candidates = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return candidates.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? ''
}

/** Records `duration` seconds of animation from the canvas into a video file. */
export function recordVideo(
  canvas: HTMLCanvasElement,
  draw: (t: number) => void,
  duration: number,
  onProgress: (p: number) => void,
): Promise<{ blob: Blob; ext: string }> {
  return new Promise((resolve, reject) => {
    const mimeType = pickMimeType()
    if (!mimeType) return reject(new Error('Tu navegador no soporta grabación de video (MediaRecorder).'))
    let stream: MediaStream
    try {
      stream = canvas.captureStream(30)
    } catch {
      return reject(new Error('No se pudo capturar el canvas (¿imagen sin permisos CORS?).'))
    }
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 })
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onerror = () => reject(new Error('Error durante la grabación.'))
    rec.onstop = () => {
      stream.getTracks().forEach((tr) => tr.stop())
      resolve({ blob: new Blob(chunks, { type: mimeType }), ext: mimeType.includes('mp4') ? 'mp4' : 'webm' })
    }

    draw(0)
    rec.start()
    const start = performance.now()
    const tick = () => {
      const t = (performance.now() - start) / 1000
      if (t >= duration) {
        draw(duration - 0.001)
        onProgress(1)
        rec.stop()
        return
      }
      draw(t)
      onProgress(t / duration)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}
