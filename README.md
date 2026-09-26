# Picap Studio

App web **gratuita** inspirada en Higgsfield: genera imágenes con IA y conviértelas en clips de video con movimientos de cámara cinematográficos. Sin registro, sin API keys y sin servidor propio.

## Qué hace

- **Texto → imagen gratis** con [Pollinations](https://pollinations.ai) (modelos Flux y Turbo), con estilos (cinemático, fotorrealista, anime, cyberpunk…), formatos 9:16 / 16:9 / 1:1 / 4:5 y seed fija.
- **Subir tu propia foto** (se procesa 100% en el navegador).
- **16 movimientos de cámara**: Dolly In/Out, Crash Zoom, Pan, Tilt, 360 Orbit, Spiral Zoom, Dutch Angle, Handheld, Earthquake, Crane Up, Heartbeat…
- **Efectos visuales**: Cinemático (teal & orange + letterbox), Film Grain, VHS Glitch, Noir, Light Leak, Dreamy Glow.
- **Exportar video** MP4/WebM (2–10 s) directamente en el navegador con `MediaRecorder`.
- **Galería** local de tus creaciones.

## Cómo funciona

| Parte | Tecnología | Costo |
| --- | --- | --- |
| Generación de imagen | API pública de Pollinations | Gratis |
| Animación y efectos | Canvas 2D en el navegador | Gratis |
| Exportación de video | `canvas.captureStream` + `MediaRecorder` | Gratis |
| Hosting | GitHub Pages (o cualquier hosting estático) | Gratis |

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # genera dist/
npm run lint
```

Para usar otro endpoint de imágenes compatible, define `VITE_IMAGE_API` (por defecto `https://image.pollinations.ai/prompt/`).

## Publicar gratis

El workflow `.github/workflows/deploy.yml` publica en GitHub Pages en cada push a `main`. Activa **Settings → Pages → Source: GitHub Actions** en el repositorio.

## Notas

- La grabación ocurre en tiempo real: mantén la pestaña visible mientras se exporta.
- El servicio gratuito de imágenes tiene límites de uso; si falla, reintenta en unos segundos.
- Los videos se generan animando una imagen (movimiento 2D/“2.5D”); no es un modelo de video generativo.
