import { useEffect, useMemo, useRef, useState } from 'react'
import { EFFECTS, MOTION_PRESETS } from './lib/motion'
import { drawFrame, recordVideo, type RenderOptions } from './lib/render'
import {
  ASPECTS,
  MODELS,
  PROMPT_IDEAS,
  STYLES,
  buildImageUrl,
  loadGallery,
  loadImage,
  saveGallery,
  type GalleryItem,
} from './lib/generate'

const MAX_SIDE = 1280
// Fit the frame inside the viewport while keeping the exact aspect ratio.
const frameStyle = (ratio: number) => ({ aspectRatio: String(ratio), width: `min(100%, calc(72vh * ${ratio}))` })
const randomSeed = () => Math.floor(Math.random() * 1_000_000)

export default function App() {
  const [source, setSource] = useState<'generate' | 'upload'>('generate')
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('cinematic')
  const [aspectId, setAspectId] = useState('9:16')
  const [model, setModel] = useState('flux')
  const [seed, setSeed] = useState(randomSeed)
  const [lockSeed, setLockSeed] = useState(false)

  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const [presetId, setPresetId] = useState('dolly-in')
  const [hoverPresetId, setHoverPresetId] = useState<string | null>(null)
  const [effect, setEffect] = useState('cinematic')
  const [duration, setDuration] = useState(5)
  const [intensity, setIntensity] = useState(1)

  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [video, setVideo] = useState<{ url: string; ext: string } | null>(null)
  const [gallery, setGallery] = useState<GalleryItem[]>(loadGallery)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const exportingRef = useRef(false)

  const aspect = ASPECTS.find((a) => a.id === aspectId)!
  const activePreset = MOTION_PRESETS.find((p) => p.id === (hoverPresetId ?? presetId))!
  const options: RenderOptions = useMemo(
    () => ({ preset: activePreset, effect, intensity, duration }),
    [activePreset, effect, intensity, duration],
  )

  // Size the canvas to the image, capped for smooth recording.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const k = Math.min(1, MAX_SIDE / Math.max(image.width, image.height))
    canvas.width = Math.round((image.width * k) / 2) * 2
    canvas.height = Math.round((image.height * k) / 2) * 2
  }, [image])

  // Live looping preview.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const ctx = canvas.getContext('2d')!
    const start = performance.now()
    let raf = 0
    const loop = () => {
      if (!exportingRef.current) drawFrame(ctx, image, (performance.now() - start) / 1000, options)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [image, options])

  async function generate() {
    const text = prompt.trim() || PROMPT_IDEAS[Math.floor(Math.random() * PROMPT_IDEAS.length)]
    if (!prompt.trim()) setPrompt(text)
    const useSeed = lockSeed ? seed : randomSeed()
    setSeed(useSeed)
    setGenerating(true)
    setError('')
    const url = buildImageUrl({ prompt: text, style, aspect, model, seed: useSeed })
    try {
      const img = await loadImage(url)
      setImage(img)
      const item: GalleryItem = { id: crypto.randomUUID(), url, prompt: text, aspect: aspectId, createdAt: Date.now() }
      const next = [item, ...gallery]
      setGallery(next)
      saveGallery(next)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function openFromGallery(item: GalleryItem) {
    setGenerating(true)
    setError('')
    try {
      setImage(await loadImage(item.url))
      setPrompt(item.prompt)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  function removeFromGallery(id: string) {
    const next = gallery.filter((g) => g.id !== id)
    setGallery(next)
    saveGallery(next)
  }

  async function onUpload(file: File | undefined) {
    if (!file) return
    setError('')
    try {
      setImage(await loadImage(URL.createObjectURL(file)))
    } catch {
      setError('No se pudo leer esa imagen.')
    }
  }

  async function exportVideo() {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const ctx = canvas.getContext('2d')!
    const exportOptions = { ...options, preset: MOTION_PRESETS.find((p) => p.id === presetId)! }
    exportingRef.current = true
    setExporting(true)
    setProgress(0)
    setError('')
    try {
      const { blob, ext } = await recordVideo(canvas, (t) => drawFrame(ctx, image, t, exportOptions), duration, setProgress)
      if (video) URL.revokeObjectURL(video.url)
      setVideo({ url: URL.createObjectURL(blob), ext })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      exportingRef.current = false
      setExporting(false)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          <span className="logo-mark">◉</span> Picap<span className="logo-tag">studio</span>
        </div>
        <span className="free-badge">100% gratis · sin registro</span>
      </header>

      <main className="layout">
        <aside className="panel">
          <div className="tabs">
            <button className={source === 'generate' ? 'active' : ''} onClick={() => setSource('generate')}>
              Generar imagen
            </button>
            <button className={source === 'upload' ? 'active' : ''} onClick={() => setSource('upload')}>
              Subir foto
            </button>
          </div>

          {source === 'generate' ? (
            <>
              <label className="field">
                <span>Prompt</span>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe tu escena… (vacío = idea aleatoria)"
                  rows={4}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate()
                  }}
                />
              </label>

              <div className="field">
                <span>Estilo</span>
                <div className="chips">
                  {STYLES.map((s) => (
                    <button key={s.id} className={`chip ${style === s.id ? 'active' : ''}`} onClick={() => setStyle(s.id)}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span>Formato</span>
                <div className="chips">
                  {ASPECTS.map((a) => (
                    <button key={a.id} className={`chip ${aspectId === a.id ? 'active' : ''}`} onClick={() => setAspectId(a.id)}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="row">
                <label className="field grow">
                  <span>Modelo</span>
                  <select value={model} onChange={(e) => setModel(e.target.value)}>
                    {MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field seed">
                  <span>
                    Seed <input type="checkbox" checked={lockSeed} onChange={(e) => setLockSeed(e.target.checked)} /> fija
                  </span>
                  <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} disabled={!lockSeed} />
                </label>
              </div>

              <button className="primary" onClick={generate} disabled={generating}>
                {generating ? 'Generando…' : '✦ Generar'}
              </button>
            </>
          ) : (
            <label className="dropzone">
              <input type="file" accept="image/*" onChange={(e) => onUpload(e.target.files?.[0])} />
              <strong>Arrastra o elige una imagen</strong>
              <small>Se procesa en tu navegador, nada se sube a ningún servidor.</small>
            </label>
          )}

          {error && <p className="error">{error}</p>}
        </aside>

        <section className="stage">
          <div className={`canvas-wrap ${image ? '' : 'empty'}`} style={frameStyle(image ? image.width / image.height : aspect.w / aspect.h)}>
            <canvas ref={canvasRef} hidden={!image} />
            {!image && !generating && (
              <div className="placeholder">
                <p>Genera o sube una imagen</p>
                <small>y conviértela en un clip con movimientos de cámara cinematográficos</small>
              </div>
            )}
            {generating && <div className="loader"><span /> Creando imagen…</div>}
            {exporting && (
              <div className="rec">
                ● REC {Math.round(progress * 100)}%
              </div>
            )}
          </div>

          <div className="export-bar">
            <label>
              Duración <b>{duration}s</b>
              <input type="range" min={2} max={10} step={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </label>
            <label>
              Intensidad <b>{intensity.toFixed(1)}x</b>
              <input type="range" min={0.3} max={2} step={0.1} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} />
            </label>
            <button className="primary" onClick={exportVideo} disabled={!image || exporting}>
              {exporting ? 'Grabando…' : '▶ Crear video'}
            </button>
          </div>

          {video && (
            <div className="result">
              <video src={video.url} controls autoPlay loop playsInline />
              <a className="primary" href={video.url} download={`picap-${presetId}.${video.ext}`}>
                ⬇ Descargar .{video.ext}
              </a>
            </div>
          )}
        </section>

        <aside className="panel">
          <div className="field">
            <span>Movimiento de cámara</span>
            <div className="presets">
              {MOTION_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={`preset ${presetId === p.id ? 'active' : ''}`}
                  onClick={() => setPresetId(p.id)}
                  onMouseEnter={() => setHoverPresetId(p.id)}
                  onMouseLeave={() => setHoverPresetId(null)}
                  title={p.description}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <small className="hint">Pasa el cursor sobre un preset para previsualizarlo.</small>
          </div>

          <div className="field">
            <span>Efecto visual</span>
            <div className="chips">
              {EFFECTS.map((e) => (
                <button key={e.id} className={`chip ${effect === e.id ? 'active' : ''}`} onClick={() => setEffect(e.id)}>
                  {e.name}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {gallery.length > 0 && (
        <section className="gallery">
          <h2>Tus creaciones</h2>
          <div className="grid">
            {gallery.map((g) => (
              <figure key={g.id}>
                <img src={g.url} alt={g.prompt} loading="lazy" onClick={() => openFromGallery(g)} />
                <figcaption>
                  <span>{g.prompt}</span>
                  <button onClick={() => removeFromGallery(g.id)} aria-label="Eliminar">
                    ✕
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
