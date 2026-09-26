import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { composeSubject, estimateDepth, removeBackground, type BackgroundMode } from './lib/ai'
import { DepthRenderer } from './lib/depth3d'
import { EFFECTS, MOTION_PRESETS } from './lib/motion'
import { drawFrame, recordVideo, type RenderOptions } from './lib/render'
import { shareVideo } from './lib/share'
import {
  ASPECTS,
  MODELS,
  PROMPT_IDEAS,
  STYLES,
  buildImageUrl,
  enhancePrompt,
  loadGallery,
  loadImage,
  saveGallery,
  type GalleryItem,
} from './lib/generate'

type Tab = 'create' | 'motion' | 'ai' | 'effects' | 'gallery'
type Source = HTMLImageElement | HTMLCanvasElement

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'create', label: 'Crear', icon: '✦' },
  { id: 'motion', label: 'Cámara', icon: '◎' },
  { id: 'ai', label: 'IA', icon: '✧' },
  { id: 'effects', label: 'Efectos', icon: '◐' },
  { id: 'gallery', label: 'Galería', icon: '▦' },
]

const MAX_SIDE = 1280

const BACKGROUNDS: { id: 'original' | BackgroundMode; name: string; color?: string }[] = [
  { id: 'original', name: 'Original' },
  { id: 'blur', name: 'Desenfocado' },
  { id: 'ai', name: '✨ Fondo con IA' },
  { id: 'color', name: 'Negro', color: '#0b0b0d' },
  { id: 'color', name: 'Blanco', color: '#f4f4f4' },
  { id: 'color', name: 'Croma', color: '#00b140' },
]
const randomSeed = () => Math.floor(Math.random() * 1_000_000)

export default function App() {
  const [tab, setTab] = useState<Tab>('create')
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('cinematic')
  const [aspectId, setAspectId] = useState('9:16')
  const [model, setModel] = useState('flux')
  const [seed, setSeed] = useState(randomSeed)
  const [lockSeed, setLockSeed] = useState(false)

  const [baseImage, setBaseImage] = useState<Source | null>(null) // unedited photo
  const [image, setImage] = useState<Source | null>(null) // photo after AI background edits
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

  const [depth, setDepth] = useState<DepthRenderer | null>(null)
  const [use3d, setUse3d] = useState(false)
  const [bokeh, setBokeh] = useState(0)
  const [cutout, setCutout] = useState<HTMLCanvasElement | null>(null)
  const [bgChoice, setBgChoice] = useState('Original')
  const [bgPrompt, setBgPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState<{ pct: number; label: string } | null>(null)
  const [enhancing, setEnhancing] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const exportingRef = useRef(false)

  const aspect = ASPECTS.find((a) => a.id === aspectId)!
  const preset = MOTION_PRESETS.find((p) => p.id === presetId)!
  const options: RenderOptions = useMemo(
    () => ({ preset, effect, intensity, duration, depth: use3d ? depth : null, bokeh }),
    [preset, effect, intensity, duration, use3d, depth, bokeh],
  )

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

  // A brand-new photo: drop every AI result computed for the previous one.
  function setSource(img: Source) {
    setBaseImage(img)
    setImage(img)
    setCutout(null)
    setBgChoice('Original')
    setDepth(null)
    setUse3d(false)
    setBokeh(0)
  }

  async function runAi<T>(job: () => Promise<T>): Promise<T | undefined> {
    setError('')
    setAiBusy({ pct: 0, label: 'Preparando IA…' })
    try {
      return await job()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAiBusy(null)
    }
  }

  const aiProgress = (pct: number, label: string) => setAiBusy({ pct, label })

  async function buildDepth(img: Source) {
    const map = await estimateDepth(img, aiProgress)
    const renderer = new DepthRenderer(img, map, MAX_SIDE)
    setDepth(renderer)
    return renderer
  }

  async function toggle3d() {
    if (!image) return
    if (use3d) return setUse3d(false)
    const ok = depth ?? (await runAi(() => buildDepth(image)))
    if (ok) setUse3d(true)
  }

  async function changeBackground(choice: (typeof BACKGROUNDS)[number]) {
    if (!baseImage) return
    if (choice.id === 'original') {
      setBgChoice(choice.name)
      return applyEdited(baseImage)
    }
    if (choice.id === 'ai' && !bgPrompt.trim()) {
      setBgChoice(choice.name)
      return // wait for the scene description
    }
    await runAi(async () => {
      const cut = cutout ?? (await removeBackground(baseImage, aiProgress))
      setCutout(cut)
      let bg: HTMLImageElement | undefined
      if (choice.id === 'ai') {
        aiProgress(100, 'Generando fondo con IA…')
        const k = Math.min(1, 1280 / Math.max(baseImage.width, baseImage.height))
        const a = { w: Math.round(baseImage.width * k), h: Math.round(baseImage.height * k), id: 'bg', label: '' }
        bg = await loadImage(buildImageUrl({ prompt: `${bgPrompt.trim()}, background scenery, no people`, style: 'photo', aspect: a, model, seed: randomSeed() }))
      }
      setBgChoice(choice.name)
      await applyEdited(composeSubject(baseImage, cut, choice.id as BackgroundMode, { color: choice.color, bg }))
    })
  }

  // Shows an edited photo; keeps 3D mode working by re-estimating depth for it.
  async function applyEdited(img: Source) {
    setImage(img)
    setDepth(null)
    if (use3d) {
      const ok = await runAi(() => buildDepth(img))
      if (!ok) setUse3d(false)
    }
  }

  async function improvePrompt() {
    if (!prompt.trim()) return setError('Escribe primero una idea para mejorarla.')
    setEnhancing(true)
    setError('')
    try {
      setPrompt(await enhancePrompt(prompt.trim()))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setEnhancing(false)
    }
  }

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
      setSource(await loadImage(url))
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
      setSource(await loadImage(item.url))
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
      setSource(await loadImage(URL.createObjectURL(file)))
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
          {aiBusy && (
            <div className="loader">
              <span />
              {aiBusy.label}
              {aiBusy.pct > 0 && aiBusy.pct < 100 && <progress max={100} value={aiBusy.pct} />}
            </div>
          )}
          {exporting && <div className="rec">● REC {Math.round(progress * 100)}%</div>}
          {image && !exporting && (
            <div className="frame-tag">
              {use3d && '3D · '}
              {preset.name}
              {effect !== 'none' && ` · ${EFFECTS.find((e) => e.id === effect)?.name}`}
            </div>
          )}
        </div>
        {image && (
          <button className="primary fab" onClick={exportVideo} disabled={exporting || !!aiBusy}>
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
                <button className="ghost" onClick={improvePrompt} disabled={enhancing || generating} title="Mejorar prompt con IA">
                  {enhancing ? '…' : '✨'}
                </button>
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

        {tab === 'ai' &&
          (!image ? (
            <p className="hint center">Primero genera o sube una imagen.</p>
          ) : (
            <div className="stack">
              <div className="ai-card">
                <div>
                  <b>Movimiento 3D</b>
                  <small>La IA calcula la profundidad: lo cercano se mueve más que el fondo, como una cámara real.</small>
                </div>
                <button className={`toggle ${use3d ? 'on' : ''}`} onClick={toggle3d} disabled={!!aiBusy}>
                  {use3d ? 'Activado' : 'Activar'}
                </button>
              </div>
              {use3d && (
                <label className="slider-row">
                  Desenfoque de fondo (bokeh) <b>{Math.round(bokeh * 100)}%</b>
                  <input type="range" min={0} max={1} step={0.05} value={bokeh} onChange={(e) => setBokeh(Number(e.target.value))} />
                </label>
              )}

              <div className="field">
                <span>Cambiar fondo con IA</span>
                <div className="scroller">
                  {BACKGROUNDS.map((b) => (
                    <button key={b.name} className={`chip ${bgChoice === b.name ? 'active' : ''}`} onClick={() => changeBackground(b)} disabled={!!aiBusy}>
                      {b.color && <i className="swatch" style={{ background: b.color }} />}
                      {b.name}
                    </button>
                  ))}
                </div>
                {bgChoice === '✨ Fondo con IA' && (
                  <div className="prompt-actions">
                    <input
                      className="text-input"
                      value={bgPrompt}
                      onChange={(e) => setBgPrompt(e.target.value)}
                      placeholder="Ej: playa al atardecer, ciudad de neón…"
                      enterKeyHint="go"
                      onKeyDown={(e) => e.key === 'Enter' && changeBackground(BACKGROUNDS[2])}
                    />
                    <button className="primary" onClick={() => changeBackground(BACKGROUNDS[2])} disabled={!!aiBusy || !bgPrompt.trim()}>
                      Aplicar
                    </button>
                  </div>
                )}
              </div>
              <small className="hint">
                La IA corre en tu teléfono, gratis. La primera vez descarga los modelos (~25–45 MB cada uno); después funciona más rápido.
              </small>
            </div>
          ))}

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
