/**
 * Reconocimiento de trazos (inspirado en el "quiz" de Hanzi Writer).
 *
 * Datos: Make Me a Hanzi — cada carácter trae `strokes` (contornos SVG) y
 * `medians` (línea central de cada trazo) en un cuadro de 1024 con el eje Y
 * hacia ARRIBA (y_pantalla = 900 − y_datos).
 *
 * Un trazo del usuario se acepta si, respecto a la mediana esperada:
 *  1. la distancia media entre ambas polilíneas es pequeña (forma y posición),
 *  2. empieza y acaba cerca de sus extremos (sentido del trazo),
 *  3. la dirección global coincide (coseno > 0).
 * Si no coincide con el trazo esperado pero sí con uno posterior, el error
 * es de ORDEN de trazos, que se comunica distinto.
 */

export type Point = [number, number];

export interface StrokeData {
  strokes: string[];
  medians: Point[][];
}

/** Mediana en coordenadas de pantalla (0..1024, Y hacia abajo). */
export function toScreen(median: Point[]): Point[] {
  return median.map(([x, y]) => [x, 900 - y]);
}

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function distToSegment(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return dist(p, [a[0] + t * dx, a[1] + t * dy]);
}

function distToPolyline(p: Point, line: Point[]) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) best = Math.min(best, distToSegment(p, line[i] as Point, line[i + 1] as Point));
  return line.length === 1 ? dist(p, line[0] as Point) : best;
}

/** Remuestrea a n puntos equidistantes para comparar trazos de distinta velocidad. */
export function resample(line: Point[], n = 16): Point[] {
  if (line.length < 2) return line;
  const lengths = [0];
  for (let i = 1; i < line.length; i++) lengths.push((lengths[i - 1] as number) + dist(line[i - 1] as Point, line[i] as Point));
  const total = lengths[lengths.length - 1] as number;
  if (total === 0) return [line[0] as Point];
  const out: Point[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    while (j < line.length - 2 && (lengths[j + 1] as number) < target) j++;
    const a = line[j] as Point;
    const b = line[j + 1] as Point;
    const seg = (lengths[j + 1] as number) - (lengths[j] as number) || 1;
    const t = (target - (lengths[j] as number)) / seg;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

export interface MatchOptions {
  /** Tolerancia en unidades del cuadro de 1024 (≈ 1/7 del ancho por defecto). */
  leniency?: number;
}

export function strokeMatches(user: Point[], median: Point[], { leniency = 1 }: MatchOptions = {}): boolean {
  if (user.length < 2) return false;
  const u = resample(user);
  const m = resample(toScreen(median));
  const threshold = 150 * leniency;
  const avgUserToMedian = u.reduce((s, p) => s + distToPolyline(p, m), 0) / u.length;
  const avgMedianToUser = m.reduce((s, p) => s + distToPolyline(p, u), 0) / m.length;
  if (Math.max(avgUserToMedian, avgMedianToUser) > threshold) return false;

  const start = dist(u[0] as Point, m[0] as Point);
  const end = dist(u[u.length - 1] as Point, m[m.length - 1] as Point);
  if (start > threshold * 1.6 || end > threshold * 1.6) return false;

  const uv: Point = [(u[u.length - 1] as Point)[0] - (u[0] as Point)[0], (u[u.length - 1] as Point)[1] - (u[0] as Point)[1]];
  const mv: Point = [(m[m.length - 1] as Point)[0] - (m[0] as Point)[0], (m[m.length - 1] as Point)[1] - (m[0] as Point)[1]];
  const cos = (uv[0] * mv[0] + uv[1] * mv[1]) / ((Math.hypot(...uv) || 1) * (Math.hypot(...mv) || 1));
  // Trazos muy cortos (puntos 丶) no tienen dirección fiable.
  return Math.hypot(...mv) < 120 || cos > 0;
}

export type StrokeVerdict = { ok: true } | { ok: false; reason: 'shape' | 'order' };

export function checkStroke(user: Point[], data: StrokeData, expectedIndex: number, opts?: MatchOptions): StrokeVerdict {
  const expected = data.medians[expectedIndex];
  if (expected && strokeMatches(user, expected, opts)) return { ok: true };
  const laterMatch = data.medians.slice(expectedIndex + 1).some((m) => strokeMatches(user, m, opts));
  return { ok: false, reason: laterMatch ? 'order' : 'shape' };
}

/** Puntuación final: 1 sin errores; cada fallo resta, cada pista resta más. */
export function writingScore(strokeCount: number, mistakes: number, hintsShown: number) {
  return Math.max(0, 1 - (mistakes * 0.5 + hintsShown) / Math.max(1, strokeCount));
}
