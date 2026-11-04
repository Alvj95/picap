import type { TrackPoint } from './lib/gps'

/**
 * Lightweight route map: OpenStreetMap tiles + the track as an SVG line, no map library.
 * Tiles are darkened with CSS to match the app; without internet only the line is drawn.
 */
const TILE = 256
const W = 360
const H = 240

const project = (lat: number, lon: number, z: number) => {
  const n = TILE * 2 ** z
  const s = Math.sin((lat * Math.PI) / 180)
  return { x: ((lon + 180) / 360) * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n }
}

export function RouteMap({ points, live, height = H }: { points: TrackPoint[]; live?: boolean; height?: number }) {
  if (points.length === 0)
    return (
      <div className="map map-empty" style={{ aspectRatio: `${W} / ${height}` }}>
        <span>{live ? 'Esperando señal GPS…' : 'Sin ruta'}</span>
      </div>
    )

  const lats = points.map((p) => p.lat)
  const lons = points.map((p) => p.lon)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  // Highest zoom where the whole route fits with some margin.
  let z = 17
  for (; z > 2; z--) {
    const a = project(maxLat, minLon, z)
    const b = project(minLat, maxLon, z)
    if (b.x - a.x < W * 0.8 && b.y - a.y < height * 0.8) break
  }
  const c = project((minLat + maxLat) / 2, (minLon + maxLon) / 2, z)
  const ox = c.x - W / 2
  const oy = c.y - height / 2
  const pts = points.map((p) => {
    const q = project(p.lat, p.lon, z)
    return { x: q.x - ox, y: q.y - oy }
  })

  const tiles: { x: number; y: number; tx: number; ty: number }[] = []
  const max = 2 ** z
  for (let tx = Math.floor(ox / TILE); tx * TILE < ox + W; tx++) {
    for (let ty = Math.floor(oy / TILE); ty * TILE < oy + height; ty++) {
      if (ty < 0 || ty >= max) continue
      tiles.push({ x: tx * TILE - ox, y: ty * TILE - oy, tx: ((tx % max) + max) % max, ty })
    }
  }
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('')
  const first = pts[0]
  const last = pts[pts.length - 1]

  return (
    <div className="map">
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Mapa de la ruta">
        <defs>
          <linearGradient id="route" x1="0" x2="1">
            <stop offset="0" stopColor="#3ee6a0" />
            <stop offset="1" stopColor="#a46bff" />
          </linearGradient>
        </defs>
        <g className="tiles">
          {tiles.map((t) => (
            <image key={`${t.tx}-${t.ty}`} href={`https://tile.openstreetmap.org/${z}/${t.tx}/${t.ty}.png`} x={t.x} y={t.y} width={TILE} height={TILE} onError={(e) => (e.currentTarget.style.display = 'none')} />
          ))}
        </g>
        <path d={d} className="route-glow" />
        <path d={d} className="route" stroke="url(#route)" />
        <circle cx={first.x} cy={first.y} r={5} className="route-start" />
        <circle cx={last.x} cy={last.y} r={live ? 7 : 5} className={live ? 'route-here' : 'route-end'} />
      </svg>
      <small className="map-credit">© OpenStreetMap</small>
    </div>
  )
}
