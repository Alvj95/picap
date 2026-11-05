import { useCallback, useEffect, useRef, useState } from 'react'
import { onRingInput } from './lib/ringInput'
import { shareBlob } from './lib/share'

export function CameraScreen(props: { connected: boolean; signature?: string; onLearn: (sig: string | undefined) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [facing, setFacing] = useState<'user' | 'environment'>('environment')
  const [error, setError] = useState<string>()
  const [learning, setLearning] = useState(false)
  const [timer, setTimer] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [flash, setFlash] = useState(false)
  const [shots, setShots] = useState<{ url: string; blob: Blob }[]>([])
  const busy = useRef(false)

  useEffect(() => {
    let stream: MediaStream | undefined
    let cancelled = false
    setError(undefined)
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        if (video.current) video.current.srcObject = s
      })
      .catch(() => setError('No pude abrir la cámara. Revisa el permiso de cámara de Mi Anillo en los ajustes del teléfono.'))
    if (!navigator.mediaDevices) setError('Este dispositivo no permite usar la cámara aquí.')
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [facing])

  const shotsRef = useRef(shots)
  shotsRef.current = shots
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), [])

  const capture = useCallback(() => {
    const v = video.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    const ctx = c.getContext('2d')!
    if (facing === 'user') {
      ctx.translate(c.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(v, 0, 0)
    setFlash(true)
    setTimeout(() => setFlash(false), 180)
    navigator.vibrate?.(40)
    c.toBlob((blob) => blob && setShots((s) => [{ blob, url: URL.createObjectURL(blob) }, ...s].slice(0, 12)), 'image/jpeg', 0.92)
  }, [facing])

  const shoot = useCallback(() => {
    if (busy.current) return
    if (!timer) return capture()
    busy.current = true
    let n = timer
    setCountdown(n)
    const iv = setInterval(() => {
      n--
      setCountdown(n)
      if (n <= 0) {
        clearInterval(iv)
        busy.current = false
        capture()
      }
    }, 1000)
  }, [timer, capture])

  // Ring touches: learn the packet once, then every matching packet fires the shutter.
  useEffect(
    () =>
      onRingInput((hex) => {
        if (learning) {
          props.onLearn(hex.slice(0, 4))
          setLearning(false)
          navigator.vibrate?.([40, 60, 40])
          return
        }
        if (!props.signature || hex.startsWith(props.signature)) shoot()
      }),
    [learning, props, shoot],
  )

  return (
    <div className="screen camera-screen">
      <video ref={video} autoPlay playsInline muted className={facing === 'user' ? 'mirror' : ''} />
      {flash && <div className="flash" />}
      {countdown > 0 && <div className="countdown">{countdown}</div>}

      <div className="cam-top">
        <button className="pill" onClick={props.onClose}>
          ✕ Cerrar
        </button>
        <button className="pill" onClick={() => setTimer(timer === 0 ? 3 : timer === 3 ? 10 : 0)}>
          ⏱ {timer ? `${timer} s` : 'Sin temporizador'}
        </button>
      </div>

      <div className="cam-info">
        {error ? (
          <span className="error-text">{error}</span>
        ) : !props.connected ? (
          <span>Conecta el anillo para disparar tocándolo. También puedes usar el botón.</span>
        ) : learning ? (
          <span className="learning">👆 Toca o haz el gesto en el anillo ahora…</span>
        ) : props.signature ? (
          <span>
            💍 Toca el anillo para hacer la foto ·{' '}
            <button className="link" onClick={() => setLearning(true)}>
              volver a aprender
            </button>
          </span>
        ) : (
          <span>
            Toca el anillo para disparar.{' '}
            <button className="link" onClick={() => setLearning(true)}>
              Enseñar el toque
            </button>{' '}
            para que solo reaccione a ese gesto.
          </span>
        )}
      </div>

      <div className="cam-bottom">
        <button className="thumb" disabled={!shots.length} onClick={() => shots[0] && shareBlob(shots[0].blob, `foto-${Date.now()}.jpg`)} aria-label="Guardar o compartir la última foto">
          {shots[0] && <img src={shots[0].url} alt="" />}
        </button>
        <button className="shutter" onClick={shoot} aria-label="Hacer foto" />
        <button className="pill round" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')} aria-label="Cambiar cámara">
          ⟲
        </button>
      </div>
      {shots.length > 0 && <p className="cam-hint">Toca la miniatura para guardar en Fotos o compartir.</p>}
    </div>
  )
}
