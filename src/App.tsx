import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { EFFECTS, MOTION_PRESETS } from './lib/motion'
import { drawFrame, recordVideo, type RenderOptions } from './lib/render'
import { shareVideo } from './lib/share'
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

type Tab = 'create' | 'motion' | 'effects' | 'gallery'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'create', label: 'Crear', icon: '✦' },
  { id: 'motion', label: 'Cámara', icon: '◎' },
  { id: 'effects', label: 'Efectos', icon: '◐' },
  { id: 'gallery', label: 'Galería', icon: '▦' },
]

const MAX_SIDE = 1280
const randomSeed = () => Math.floor(Math.random() * 1_000_000)

export default function App() {
  const [tab, setTab] = useState<Tab>('create')
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
  const [effect, setEffect] = useState('cinematic')
  const [duration, setDuration] = useState(5)
  const [intensity, setIntensity] = useState(1)

  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [video, setVideo] = useState<{ url: string; blob: Blob; ext: string } | null>(null)
  const [gallery, setGallery] = useState<GalleryItem[]>(loadGallery)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const exportingRef = useRef(false)

  const aspect = ASPECTS.find((a) => a.id === aspectId)!
  const preset = MOTION_PRESETS.find((p) => p.id === presetId)!
  const options: RenderOptions = useMemo(() => ({ preset, effect, intensity, duration }), [preset, effect, intensity, duration])

  // Android back button: close the result, then return to the Crear tab, then exit.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const sub = CapApp.addListener('backButton', () => {
      if (video) setVideo(null)
      else if (tab !== 'create') setTab('create')
      else CapApp.exitApp()
    })
    return () => {
      sub.then((h) => h.remove())
    }
  }, [video, tab])

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
    ;(document.activeElement as HTMLElement | null)?.blur() // hide the mobile keyboard
    const url = buildImageUrl({ prompt: text, style, aspect, model, seed: useSeed })
    try {
      const img = await loadImage(url)
      setImage(img)
      const item: GalleryItem = { id: crypto.randomUUID(), url, prompt: text, aspect: aspectId, createdAt: Date.now() }
      const next = [item, ...gallery]
      setGallery(next)
      saveGallery(next)
      setTab('motion')
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
      setTab('motion')
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
      setTab('motion')
    } catch {
      setError('No se pudo leer esa imagen.')
    }
  }

  async function exportVideo() {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const ctx = canvas.getContext('2d')!
    exportingRef.current = true
    setExporting(true)
    setProgress(0)
    setError('')
    try {
      const { blob, ext } = await recordVideo(canvas, (t) => drawFrame(ctx, image, t, options), duration, setProgress)
      if (video) URL.revokeObjectURL(video.url)
      setVideo({ url: URL.createObjectURL(blob), blob, ext })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      exportingRef.current = false
      setExporting(false)
    }
  }

  async function share() {
    if (!video) return
    try {
      await shareVideo(video.blob, `picap-${presetId}-${Date.now()}.${video.ext}`)
    } catch (e) {
      const msg = (e as Error).message ?? ''
      if (!/cancel/i.test(msg)) setError(`No se pudo compartir: ${msg}`)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          <span className="logo-mark">◉</span> Picap
        </div>
        {Capacitor.isNativePlatform() ? (
          <span className="free-badge">Gratis</span>
        ) : (
          <a className="free-badge" href="./PicapStudio.apk" download>
            ⬇ App Android
          </a>
        )}
      </header>

      <section className="stage">
        <div className={`frame ${image ? '' : 'empty'}`} style={{ '--r': image ? image.width / image.height : aspect.w / aspect.h } as CSSProperties}>
          <canvas ref={canvasRef} hidden={!image} />
          {!image && !generating && (
            <div className="placeholder">
              <p>Crea tu primer clip</p>
              <small>Genera o sube una imagen y dale movimiento de cámara cinematográfico</small>
            </div>
          )}
          {generating && (
            <div className="loader">
              <span /> Creando imagen…
            </div>
          )}
          {exporting && <div className="rec">● REC {Math.round(progress * 100)}%</div>}
          {image && !exporting && (
            <div className="frame-tag">
              {preset.name}
              {effect !== 'none' && ` · ${EFFECTS.find((e) => e.id === effect)?.name}`}
            </div>
          )}
        </div>
        {image && (
          <button className="primary fab" onClick={exportVideo} disabled={exporting}>
            {exporting ? `Grabando ${Math.round(progress * 100)}%` : '▶ Crear video'}
          </button>
        )}
      </section>

      <section className="sheet">
        {error && (
          <p className="error" onClick={() => setError('')}>
            {error}
          </p>
        )}

        {tab === 'create' && (
          <div className="stack">
            <div className="prompt-box">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe tu escena… (vacío = idea aleatoria)"
                rows={3}
                enterKeyHint="go"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    generate()
                  }
                }}
              />
              <div className="prompt-actions">
                <label className="ghost upload">
                  <input type="file" accept="image/*" onChange={(e) => onUpload(e.target.files?.[0])} />＋ Foto
                </label>
                <button className="primary" onClick={generate} disabled={generating}>
                  {generating ? 'Generando…' : '✦ Generar'}
                </button>
              </div>
            </div>

            <div className="field">
              <span>Estilo</span>
              <div className="scroller">
                {STYLES.map((s) => (
                  <button key={s.id} className={`chip ${style === s.id ? 'active' : ''}`} onClick={() => setStyle(s.id)}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span>Formato</span>
              <div className="scroller">
                {ASPECTS.map((a) => (
                  <button key={a.id} className={`chip ${aspectId === a.id ? 'active' : ''}`} onClick={() => setAspectId(a.id)}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span>Modelo</span>
              <div className="scroller">
                {MODELS.map((m) => (
                  <button key={m.id} className={`chip ${model === m.id ? 'active' : ''}`} onClick={() => setModel(m.id)}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span>
                <input type="checkbox" checked={lockSeed} onChange={(e) => setLockSeed(e.target.checked)} /> Seed fija
              </span>
              <input type="number" inputMode="numeric" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} disabled={!lockSeed} />
            </div>
          </div>
        )}

        {tab === 'motion' && (
          <div className="stack">
            <div className="presets">
              {MOTION_PRESETS.map((p) => (
                <button key={p.id} className={`preset ${presetId === p.id ? 'active' : ''}`} onClick={() => setPresetId(p.id)}>
                  <b>{p.name}</b>
                  <small>{p.description}</small>
                </button>
              ))}
            </div>
            <Sliders duration={duration} setDuration={setDuration} intensity={intensity} setIntensity={setIntensity} />
          </div>
        )}

        {tab === 'effects' && (
          <div className="stack">
            <div className="effects">
              {EFFECTS.map((e) => (
                <button key={e.id} className={`effect fx-${e.id} ${effect === e.id ? 'active' : ''}`} onClick={() => setEffect(e.id)}>
                  {e.name}
                </button>
              ))}
            </div>
            <Sliders duration={duration} setDuration={setDuration} intensity={intensity} setIntensity={setIntensity} />
          </div>
        )}

        {tab === 'gallery' &&
          (gallery.length === 0 ? (
            <p className="hint center">Aún no has generado imágenes.</p>
          ) : (
            <div className="grid">
              {gallery.map((g) => (
                <figure key={g.id}>
                  <img src={g.url} alt={g.prompt} loading="lazy" onClick={() => openFromGallery(g)} />
                  <button onClick={() => removeFromGallery(g.id)} aria-label="Eliminar">
                    ✕
                  </button>
                </figure>
              ))}
            </div>
          ))}
      </section>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <i>{t.icon}</i>
            {t.label}
          </button>
        ))}
      </nav>

      {video && (
        <div className="modal">
          <video src={video.url} controls autoPlay loop playsInline />
          <div className="modal-actions">
            <button className="ghost" onClick={() => setVideo(null)}>
              Cerrar
            </button>
            <button className="primary" onClick={share}>
              ⇪ Guardar / Compartir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Sliders(p: { duration: number; setDuration: (n: number) => void; intensity: number; setIntensity: (n: number) => void }) {
  return (
    <div className="sliders">
      <label>
        Duración <b>{p.duration}s</b>
        <input type="range" min={2} max={10} step={1} value={p.duration} onChange={(e) => p.setDuration(Number(e.target.value))} />
      </label>
      <label>
        Intensidad <b>{p.intensity.toFixed(1)}x</b>
        <input type="range" min={0.3} max={2} step={0.1} value={p.intensity} onChange={(e) => p.setIntensity(Number(e.target.value))} />
      </label>
    </div>
  )
}
