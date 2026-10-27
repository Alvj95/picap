// BCV official rate (Bs. per US$). Fetched from a public mirror when online; the user can always override it.

export interface Tasa { valor: number; fecha: string; fuente: 'bcv' | 'manual' }

const CLAVE = 'liquidaya.tasa'

export function tasaGuardada(): Tasa | null {
  try {
    const t = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Tasa | null
    return t && t.valor > 0 ? t : null
  } catch {
    return null
  }
}

export function guardarTasa(t: Tasa): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(t))
  } catch {
    // Private mode: the rate simply is not remembered.
  }
}

export async function tasaBCV(): Promise<Tasa> {
  const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as { promedio?: number; fechaActualizacion?: string }
  if (!data.promedio || data.promedio <= 0) throw new Error('Respuesta sin tasa')
  return { valor: data.promedio, fecha: (data.fechaActualizacion ?? new Date().toISOString()).slice(0, 10), fuente: 'bcv' }
}
