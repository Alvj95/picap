// Labor settlement under the Ley Orgánica del Trabajo, los Trabajadores y las Trabajadoras (LOTTT, 2012).
// Amounts are computed in the salary's own currency; the UI converts with the BCV rate.

export interface Antiguedad { anios: number; meses: number; dias: number; totalMeses: number }

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function antiguedad(ingresoISO: string, egresoISO: string): Antiguedad {
  const a = parse(ingresoISO)
  const b = parse(egresoISO)
  let anios = b.getFullYear() - a.getFullYear()
  let meses = b.getMonth() - a.getMonth()
  let dias = b.getDate() - a.getDate()
  if (dias < 0) {
    meses -= 1
    dias += new Date(b.getFullYear(), b.getMonth(), 0).getDate()
  }
  if (meses < 0) {
    anios -= 1
    meses += 12
  }
  if (anios < 0) return { anios: 0, meses: 0, dias: 0, totalMeses: 0 }
  return { anios, meses, dias, totalMeses: anios * 12 + meses }
}

export type Motivo = 'renuncia' | 'despido_justificado' | 'despido_injustificado'

export interface DatosLiquidacion {
  ingreso: string
  egreso: string
  salarioMensual: number
  diasUtilidades: number // art. 131: entre 30 y 120 días al año
  vacacionesPendientes: number // días de vacaciones vencidas y no disfrutadas
  motivo: Motivo
}

export interface Concepto { concepto: string; detalle: string; dias: number; salario: number; monto: number }

export interface Liquidacion {
  antiguedad: Antiguedad
  salarioDiario: number
  alicuotaUtilidades: number
  alicuotaBonoVacacional: number
  salarioIntegral: number
  diasGarantia: number
  garantia: number
  diasRetroactivo: number
  retroactivo: number
  prestacionesMetodo: 'garantia' | 'retroactivo'
  conceptos: Concepto[]
  total: number
}

const r2 = (x: number) => Math.round(x * 100) / 100

// Art. 190 y 192: 15 días el primer año, +1 por cada año adicional, hasta 30.
export const diasVacaciones = (aniosCompletos: number) => Math.min(15 + aniosCompletos, 30)

// Art. 142 a) y b): 15 días por trimestre iniciado, más 2 días por año después del primero, acumulativos hasta 30.
export function diasGarantia(a: Antiguedad): number {
  const trimestres = Math.floor(a.totalMeses / 3) + (a.totalMeses % 3 || a.dias ? 1 : 0)
  let adicionales = 0
  for (let k = 2; k <= a.anios; k++) adicionales += Math.min(2 * (k - 1), 30)
  return 15 * trimestres + adicionales
}

// Art. 142 c): 30 días por año de servicio o fracción superior a seis meses.
export function diasRetroactivo(a: Antiguedad): number {
  const fraccion = a.meses > 6 || (a.meses === 6 && a.dias > 0) ? 1 : 0
  return 30 * (a.anios + fraccion)
}

// Months worked in the current fiscal (calendar) year, for fractional profit sharing (art. 131).
function mesesEnAnio(ingresoISO: string, egresoISO: string): number {
  const egreso = parse(egresoISO)
  const inicioAnio = `${egreso.getFullYear()}-01-01`
  const desde = ingresoISO > inicioAnio ? ingresoISO : inicioAnio
  const a = antiguedad(desde, egresoISO)
  return Math.min(12, a.totalMeses + (a.dias > 0 ? 1 : 0))
}

export function liquidar(d: DatosLiquidacion): Liquidacion {
  const ant = antiguedad(d.ingreso, d.egreso)
  const salarioDiario = d.salarioMensual / 30
  const diasBono = diasVacaciones(ant.anios)
  const alicuotaUtilidades = (salarioDiario * d.diasUtilidades) / 360
  const alicuotaBonoVacacional = (salarioDiario * diasBono) / 360
  const salarioIntegral = salarioDiario + alicuotaUtilidades + alicuotaBonoVacacional

  const dG = diasGarantia(ant)
  const dR = diasRetroactivo(ant)
  const garantia = dG * salarioIntegral
  const retroactivo = dR * salarioIntegral
  // Art. 142 d): el trabajador recibe el monto que resulte mayor.
  const metodo = retroactivo > garantia ? 'retroactivo' : 'garantia'
  const prestaciones = Math.max(garantia, retroactivo)

  const fraccionMeses = ant.meses + (ant.dias > 0 ? 1 : 0)
  const diasVacFrac = (diasVacaciones(ant.anios) * Math.min(fraccionMeses, 12)) / 12
  const diasBonoFrac = (diasBono * Math.min(fraccionMeses, 12)) / 12
  const mesesUtil = mesesEnAnio(d.ingreso, d.egreso)
  const diasUtilFrac = (d.diasUtilidades * mesesUtil) / 12

  const conceptos: Concepto[] = [
    {
      concepto: 'Prestaciones sociales',
      detalle: metodo === 'retroactivo' ? 'Art. 142 c) — 30 días por año (mayor que la garantía)' : 'Art. 142 a) y b) — garantía trimestral (mayor que el retroactivo)',
      dias: metodo === 'retroactivo' ? dR : dG,
      salario: salarioIntegral,
      monto: prestaciones,
    },
    { concepto: 'Vacaciones fraccionadas', detalle: `Art. 196 — ${fraccionMeses} de 12 meses`, dias: diasVacFrac, salario: salarioDiario, monto: diasVacFrac * salarioDiario },
    { concepto: 'Bono vacacional fraccionado', detalle: `Art. 192 y 196 — ${fraccionMeses} de 12 meses`, dias: diasBonoFrac, salario: salarioDiario, monto: diasBonoFrac * salarioDiario },
    { concepto: 'Utilidades fraccionadas', detalle: `Art. 131 — ${mesesUtil} meses del año en curso`, dias: diasUtilFrac, salario: salarioDiario, monto: diasUtilFrac * salarioDiario },
  ]
  if (d.vacacionesPendientes > 0) {
    conceptos.push({ concepto: 'Vacaciones vencidas no disfrutadas', detalle: 'Art. 190 y 192', dias: d.vacacionesPendientes, salario: salarioDiario, monto: d.vacacionesPendientes * salarioDiario })
  }
  if (d.motivo === 'despido_injustificado') {
    conceptos.push({ concepto: 'Indemnización por despido injustificado', detalle: 'Art. 92 — monto igual a las prestaciones', dias: metodo === 'retroactivo' ? dR : dG, salario: salarioIntegral, monto: prestaciones })
  }

  const redondeados = conceptos.map((c) => ({ ...c, dias: r2(c.dias), salario: r2(c.salario), monto: r2(c.monto) }))
  return {
    antiguedad: ant,
    salarioDiario: r2(salarioDiario),
    alicuotaUtilidades: r2(alicuotaUtilidades),
    alicuotaBonoVacacional: r2(alicuotaBonoVacacional),
    salarioIntegral: r2(salarioIntegral),
    diasGarantia: dG,
    garantia: r2(garantia),
    diasRetroactivo: dR,
    retroactivo: r2(retroactivo),
    prestacionesMetodo: metodo,
    conceptos: redondeados,
    total: r2(redondeados.reduce((s, c) => s + c.monto, 0)),
  }
}

// Factura: IVA general 16 % e IGTF 3 % sobre pagos en divisas.
export const IVA_GENERAL = 0.16
export const IGTF = 0.03

export interface Factura { base: number; exento: number; iva: number; subtotal: number; igtf: number; total: number }

export function factura(base: number, exento: number, pagoEnDivisas: boolean, tasaIva = IVA_GENERAL): Factura {
  const iva = r2(base * tasaIva)
  const subtotal = r2(base + exento + iva)
  const igtf = pagoEnDivisas ? r2(subtotal * IGTF) : 0
  return { base, exento, iva, subtotal, igtf, total: r2(subtotal + igtf) }
}
