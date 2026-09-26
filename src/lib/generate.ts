// Free text-to-image via Pollinations (no API key required).
// The endpoint can be overridden with VITE_IMAGE_API.
const IMAGE_API = import.meta.env.VITE_IMAGE_API ?? 'https://image.pollinations.ai/prompt/'

export type AspectRatio = { id: string; label: string; w: number; h: number }

export const ASPECTS: AspectRatio[] = [
  { id: '9:16', label: '9:16', w: 720, h: 1280 },
  { id: '16:9', label: '16:9', w: 1280, h: 720 },
  { id: '1:1', label: '1:1', w: 1024, h: 1024 },
  { id: '4:5', label: '4:5', w: 864, h: 1080 },
]

export const STYLES = [
  { id: 'none', name: 'Libre', suffix: '' },
  { id: 'cinematic', name: 'Cinemático', suffix: 'cinematic film still, anamorphic lens, dramatic lighting, shallow depth of field, 35mm' },
  { id: 'photo', name: 'Fotorrealista', suffix: 'ultra realistic photograph, 8k, natural light, highly detailed skin texture' },
  { id: 'anime', name: 'Anime', suffix: 'anime key visual, studio quality, vibrant colors, detailed background' },
  { id: 'cyberpunk', name: 'Cyberpunk', suffix: 'cyberpunk, neon lights, rain, blade runner atmosphere, night city' },
  { id: '3d', name: '3D Render', suffix: '3d render, octane, pixar style, soft global illumination' },
  { id: 'fashion', name: 'Editorial', suffix: 'high fashion editorial photoshoot, vogue, studio lighting, bold styling' },
  { id: 'fantasy', name: 'Fantasía', suffix: 'epic fantasy concept art, volumetric light, magical atmosphere, matte painting' },
]

export const MODELS = [
  { id: 'flux', name: 'Flux (calidad)' },
  { id: 'turbo', name: 'Turbo (rápido)' },
]

export const PROMPT_IDEAS = [
  'astronauta caminando por un desierto de sal al atardecer',
  'samurái bajo la lluvia en un callejón de neón en Tokio',
  'modelo con chaqueta de cuero en la azotea de un rascacielos, viento',
  'ballena flotando entre nubes sobre una ciudad antigua',
  'coche deportivo derrapando en una carretera de montaña con niebla',
  'bailarina en un teatro vacío iluminado por un solo foco',
  'bosque mágico con hongos brillantes y luciérnagas',
]

export function buildImageUrl(o: { prompt: string; style: string; aspect: AspectRatio; model: string; seed: number }) {
  const suffix = STYLES.find((s) => s.id === o.style)?.suffix
  const fullPrompt = suffix ? `${o.prompt}, ${suffix}` : o.prompt
  const params = new URLSearchParams({
    width: String(o.aspect.w),
    height: String(o.aspect.h),
    seed: String(o.seed),
    model: o.model,
    nologo: 'true',
    enhance: 'true',
  })
  return `${IMAGE_API}${encodeURIComponent(fullPrompt)}?${params}`
}

const TEXT_API = import.meta.env.VITE_TEXT_API ?? 'https://text.pollinations.ai/'

/** Free text AI: turns a short idea (any language) into a detailed English image prompt. */
export async function enhancePrompt(idea: string): Promise<string> {
  const instruction =
    'Rewrite this idea as one vivid, detailed English prompt for an AI image generator ' +
    '(subject, setting, lighting, camera, mood). Reply with the prompt only, no quotes: ' +
    idea
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 30_000)
  try {
    const res = await fetch(`${TEXT_API}${encodeURIComponent(instruction)}?model=openai&seed=${Date.now() % 1000}`, { signal: ctrl.signal })
    if (!res.ok) throw new Error(String(res.status))
    const text = (await res.text()).trim().replace(/^["']|["']$/g, '')
    if (!text) throw new Error('empty')
    return text
  } catch {
    throw new Error('No se pudo mejorar el prompt ahora. Inténtalo de nuevo en unos segundos.')
  } finally {
    clearTimeout(timer)
  }
}

export function loadImage(src: string, timeoutMs = 90_000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timer = setTimeout(() => {
      img.src = ''
      reject(new Error('La generación tardó demasiado. Intenta de nuevo.'))
    }, timeoutMs)
    img.onload = () => {
      clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      clearTimeout(timer)
      reject(new Error('No se pudo generar la imagen. El servicio gratuito puede estar saturado; reintenta en unos segundos.'))
    }
    img.src = src
  })
}

export type GalleryItem = { id: string; url: string; prompt: string; aspect: string; createdAt: number }

const GALLERY_KEY = 'picap.gallery.v1'

export function loadGallery(): GalleryItem[] {
  try {
    return JSON.parse(localStorage.getItem(GALLERY_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveGallery(items: GalleryItem[]) {
  try {
    localStorage.setItem(GALLERY_KEY, JSON.stringify(items.slice(0, 60)))
  } catch {
    // Storage unavailable (private mode); the gallery just won't persist.
  }
}
