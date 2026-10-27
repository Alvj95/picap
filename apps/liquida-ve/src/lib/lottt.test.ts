import assert from 'node:assert/strict'
import { test } from 'node:test'
import { leerNumero } from './formato.ts'
import { BOLIVARES, DOLARES, numeroALetras } from './letras.ts'
import { antiguedad, diasGarantia, diasRetroactivo, factura, liquidar } from './lottt.ts'

test('valor en letras', () => {
  assert.equal(numeroALetras(0), 'CERO BOLÍVARES CON 00/100')
  assert.equal(numeroALetras(1), 'UN BOLÍVAR CON 00/100')
  assert.equal(numeroALetras(21.5), 'VEINTIÚN BOLÍVARES CON 50/100')
  assert.equal(numeroALetras(100), 'CIEN BOLÍVARES CON 00/100')
  assert.equal(numeroALetras(1000), 'MIL BOLÍVARES CON 00/100')
  assert.equal(numeroALetras(1_000_000), 'UN MILLÓN DE BOLÍVARES CON 00/100')
  assert.equal(numeroALetras(36_545.07, BOLIVARES), 'TREINTA Y SEIS MIL QUINIENTOS CUARENTA Y CINCO BOLÍVARES CON 07/100')
  assert.equal(numeroALetras(250, DOLARES), 'DOSCIENTOS CINCUENTA DÓLARES ESTADOUNIDENSES CON 00/100')
  assert.equal(numeroALetras(21_000_000), 'VEINTIÚN MILLONES DE BOLÍVARES CON 00/100')
})

test('leer números escritos a la venezolana', () => {
  assert.equal(leerNumero('1.234,56'), 1234.56)
  assert.equal(leerNumero('36.500'), 36500)
  assert.equal(leerNumero('36,5'), 36.5)
  assert.equal(leerNumero('1.5'), 1.5)
  assert.equal(leerNumero('abc'), 0)
})

test('antigüedad y días de prestaciones', () => {
  const a = antiguedad('2021-03-15', '2026-10-20')
  assert.deepEqual(a, { anios: 5, meses: 7, dias: 5, totalMeses: 67 })
  // 23 trimestres iniciados (22 completos + fracción) = 345 días + adicionales 2+4+6+8 = 20.
  assert.equal(diasGarantia(a), 365)
  // 5 años + fracción de 7 meses = 6 años.
  assert.equal(diasRetroactivo(a), 180)
  assert.equal(diasRetroactivo(antiguedad('2025-01-01', '2025-07-01')), 0)
  assert.equal(diasRetroactivo(antiguedad('2025-01-01', '2025-07-02')), 30)
  assert.equal(diasGarantia(antiguedad('2026-01-01', '2026-03-01')), 15)
  assert.equal(diasGarantia(antiguedad('2026-01-01', '2026-04-01')), 15)
  assert.equal(diasGarantia(antiguedad('2026-01-01', '2026-04-02')), 30)
})

test('liquidación completa', () => {
  const l = liquidar({ ingreso: '2021-03-15', egreso: '2026-10-20', salarioMensual: 300, diasUtilidades: 30, vacacionesPendientes: 0, motivo: 'renuncia' })
  // Diario 10; alícuota utilidades 10*30/360; bono 20 días (15+5).
  assert.equal(l.salarioDiario, 10)
  assert.equal(l.alicuotaUtilidades, 0.83)
  assert.equal(l.alicuotaBonoVacacional, 0.56)
  assert.equal(l.prestacionesMetodo, 'garantia')
  assert.equal(l.conceptos.length, 4)

  const d = liquidar({ ingreso: '2021-03-15', egreso: '2026-10-20', salarioMensual: 300, diasUtilidades: 30, vacacionesPendientes: 15, motivo: 'despido_injustificado' })
  assert.equal(d.conceptos.length, 6)
  assert.equal(d.conceptos[5].monto, d.conceptos[0].monto)
})

test('factura con IVA e IGTF', () => {
  assert.deepEqual(factura(100, 0, false), { base: 100, exento: 0, iva: 16, subtotal: 116, igtf: 0, total: 116 })
  assert.equal(factura(100, 0, true).total, 119.48)
})
