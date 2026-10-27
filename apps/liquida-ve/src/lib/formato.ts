const bs = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const formatoBs = (n: number) => `Bs. ${bs.format(n)}`
export const formatoUsd = (n: number) => `$ ${bs.format(n)}`

export const formatoPorcentaje = (n: number) =>
  `${(n * 100).toLocaleString('es-VE', { maximumFractionDigits: 3 })} %`

// Parses "yyyy-mm-dd" as a local date so the day never shifts with the timezone.
export function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  return new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d))
}

export function hoyISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Accepts "1.234,56", "1234,56", "1234.56" and "36.500" (dots as thousands, the Venezuelan habit).
export function leerNumero(s: string): number {
  const t = s.trim().replace(/\s/g, '')
  let normal = t
  if (t.includes(',')) normal = t.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) normal = t.replace(/\./g, '')
  const n = Number(normal)
  return Number.isFinite(n) && n > 0 ? n : 0
}
