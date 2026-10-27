// Converts an amount to the words Venezuelan receipts and settlements require,
// e.g. 1250.5 -> "UN MIL DOSCIENTOS CINCUENTA BOLÍVARES CON 50/100".

const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE']
const DIEZ_A_VEINTINUEVE = [
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
  'VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
]
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

// 0..999. Uses the apocopated "UN"/"VEINTIÚN" because the number is always followed by MIL, MILLONES or the currency name.
function hastaMil(n: number): string {
  if (n === 100) return 'CIEN'
  const c = Math.floor(n / 100)
  const resto = n % 100
  let dec = ''
  if (resto >= 30) {
    const u = resto % 10
    dec = DECENAS[Math.floor(resto / 10)] + (u ? ` Y ${UNIDADES[u]}` : '')
  } else if (resto >= 10) {
    dec = DIEZ_A_VEINTINUEVE[resto - 10]
  } else {
    dec = UNIDADES[resto]
  }
  return [CENTENAS[c], dec].filter(Boolean).join(' ')
}

function hastaMillon(n: number): string {
  const miles = Math.floor(n / 1000)
  const resto = n % 1000
  const partes: string[] = []
  if (miles === 1) partes.push('MIL')
  else if (miles > 1) partes.push(`${hastaMil(miles)} MIL`)
  if (resto) partes.push(hastaMil(resto))
  return partes.join(' ')
}

export interface Moneda { singular: string; plural: string }

export const BOLIVARES: Moneda = { singular: 'BOLÍVAR', plural: 'BOLÍVARES' }
export const DOLARES: Moneda = { singular: 'DÓLAR ESTADOUNIDENSE', plural: 'DÓLARES ESTADOUNIDENSES' }

export function numeroALetras(valor: number, moneda: Moneda = BOLIVARES): string {
  const centavos = Math.round(Math.abs(valor) * 100)
  const n = Math.floor(centavos / 100)
  const cc = String(centavos % 100).padStart(2, '0')
  const nombre = n === 1 ? moneda.singular : moneda.plural
  if (n === 0) return `CERO ${nombre} CON ${cc}/100`
  const millones = Math.floor(n / 1_000_000)
  const resto = n % 1_000_000
  const partes: string[] = []
  if (millones === 1) partes.push('UN MILLÓN')
  else if (millones > 1) partes.push(`${hastaMillon(millones)} MILLONES`)
  if (resto) partes.push(hastaMillon(resto))
  // "Un millón de bolívares" but "un millón cien bolívares".
  const de = millones && !resto ? ' DE' : ''
  return `${partes.join(' ')}${de} ${nombre} CON ${cc}/100`
}
