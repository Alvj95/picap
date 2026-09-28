import { describe, expect, it } from 'vitest'
import { emptyData } from './store'
import { isMe, mergeCompanyShifts, parseCell, parseDate, parseFlights, parseRoster } from './roster'
import { applyAcceptedSwap, newSwap, swapCandidates } from './swaps'
import { monthGrid, nightMinutes, normalizeTime, shiftMinutes } from './time'
import { shiftsToICS } from './ics'

describe('time', () => {
  it('normalizes the ways people write times', () => {
    expect(['6', '600', '0600', '6:00', '6.00', '6h00', '6h', '24:00'].map(normalizeTime))
      .toEqual(['06:00', '06:00', '06:00', '06:00', '06:00', '06:00', '06:00', '00:00'])
    expect(normalizeTime('LIBRE')).toBeNull()
    expect(normalizeTime('25:00')).toBeNull()
  })
  it('counts overnight and night hours', () => {
    expect(shiftMinutes('22:00', '06:00')).toBe(480)
    expect(nightMinutes('22:00', '06:00')).toBe(480)
    expect(nightMinutes('04:00', '12:00')).toBe(120)
    expect(nightMinutes('14:00', '23:30')).toBe(90)
    expect(nightMinutes('08:00', '16:00')).toBe(0)
  })
  it('builds a Monday-first month grid', () => {
    const weeks = monthGrid(2026, 9) // October 2026 starts on Thursday
    expect(weeks[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
  })
})

describe('roster import', () => {
  it('parses dates in several formats', () => {
    expect(parseDate('2026-10-05', 2026, 9)).toBe('2026-10-05')
    expect(parseDate('05/10/2026', 2026, 0)).toBe('2026-10-05')
    expect(parseDate('5-10-26', 2026, 0)).toBe('2026-10-05')
    expect(parseDate('Lun 05/10', 2026, 0)).toBe('2026-10-05')
    expect(parseDate('5', 2026, 9)).toBe('2026-10-05')
    expect(parseDate('Empleado', 2026, 9)).toBeNull()
    expect(parseDate('31/02/2026', 2026, 9)).toBeNull()
  })
  it('reads a shift cell', () => {
    expect(parseCell('06:00-14:00 CKI')).toEqual({ start: '06:00', end: '14:00', rest: 'CKI' })
    expect(parseCell('0600 - 1400')).toEqual({ start: '06:00', end: '14:00', rest: '' })
    expect(parseCell('22 a 6')).toEqual({ start: '22:00', end: '06:00', rest: '' })
    expect(parseCell('LIBRE')).toBeNull()
  })
  it('imports the one-row-per-shift layout (semicolon CSV)', () => {
    const csv = [
      'Fecha;Empleado;Entrada;Salida;Puesto;Vuelos',
      '05/10/2026;Ana Pérez;05:00;13:00;Check-in;"IB6401 MAD 07:30, UX1093 LIS 09:10"',
      '05/10/2026;Luis Gómez;13:00;21:00;Embarque;',
      '05/10/2026;Marta Ruiz;LIBRE;;;',
      'xx;Luis Gómez;13:00;21:00;;',
    ].join('\n')
    const r = parseRoster(csv, 2026, 9)
    expect(r.format).toBe('lista')
    expect(r.employees).toEqual(['Ana Pérez', 'Luis Gómez', 'Marta Ruiz'])
    expect(r.entries).toHaveLength(3)
    expect(r.entries.find((e) => e.employee === 'Marta Ruiz')).toMatchObject({ start: '', label: 'LIBRE' })
    expect(r.warnings).toHaveLength(1)
  })
  it('imports a monthly grid pasted from Excel (tabs)', () => {
    const tsv = ['Nombre\t1\t2\t3', 'Ana Pérez\t06:00-14:00\tLIBRE\t22:00-06:00 Rampa', 'Luis Gómez\t14-22\t06:00-14:00\t'].join('\n')
    const r = parseRoster(tsv, 2026, 9)
    expect(r.format).toBe('cuadrante')
    expect(r.entries).toHaveLength(5)
    expect(r.entries.find((e) => e.date === '2026-10-03')).toMatchObject({ employee: 'Ana Pérez', start: '22:00', end: '06:00', role: 'Rampa' })
  })
  it('rejects unknown layouts', () => {
    expect(() => parseRoster('a,b\n1,2', 2026, 9)).toThrow(/formato/)
  })
  it('parses flight lists', () => {
    const f = parseFlights('IB6401 MAD 07:30, UX 1093 LIS 09:10; V73456 BCN')
    expect(f.map((x) => [x.number, x.destination, x.std])).toEqual([
      ['IB6401', 'MAD', '07:30'], ['UX1093', 'LIS', '09:10'], ['V73456', 'BCN', ''],
    ])
  })
  it('recognizes the user by name in any order or by employee number', () => {
    expect(isMe('PEREZ, Ana', { name: 'Ana Pérez', employeeId: '' })).toBe(true)
    expect(isMe('Ana Pérez Soto', { name: 'Ana Pérez', employeeId: '' })).toBe(false)
    expect(isMe('1234 - A. Pérez', { name: '', employeeId: '1234' })).toBe(true)
    expect(isMe('12345 - B. Soto', { name: '', employeeId: '1234' })).toBe(false)
  })
  it('replaces company shifts but keeps manual ones and typed flights', () => {
    const profile = { name: 'Ana Pérez', employeeId: '' }
    const roster = parseRoster('Fecha;Empleado;Entrada;Salida\n05/10/2026;Ana Pérez;05:00;13:00\n06/10/2026;Ana Pérez;06:00;14:00', 2026, 9).entries
    const first = mergeCompanyShifts([], roster, profile)
    first[0].flights = parseFlights('IB6401 MAD 07:30')
    const manual = { ...first[1], id: 'm', date: '2026-10-07', source: 'manual' as const }
    const second = mergeCompanyShifts([...first, manual], roster, profile)
    expect(second).toHaveLength(3)
    expect(second[0].flights[0].number).toBe('IB6401')
    expect(second.some((s) => s.id === 'm')).toBe(true)
  })
})

describe('swaps', () => {
  const profile = { name: 'Ana Pérez', employeeId: '' }
  const roster = parseRoster(
    ['Fecha;Empleado;Entrada;Salida', '05/10/2026;Ana Pérez;05:00;13:00', '05/10/2026;Luis Gómez;13:00;21:00',
      '05/10/2026;Marta Ruiz;LIBRE;', '05/10/2026;Pepe Díaz;05:00;13:00', '06/10/2026;Sara Gil;05:00;13:00'].join('\n'),
    2026, 9,
  ).entries

  it('lists coworkers who can trade or cover', () => {
    const c = swapCandidates(roster, profile, '2026-10-05', '05:00', '13:00')
    expect(c.map((x) => [x.employee, x.kind])).toEqual([
      ['Marta Ruiz', 'cesion'], ['Sara Gil', 'cesion'], ['Luis Gómez', 'intercambio'],
    ])
  })
  it('applies an accepted trade to the calendar and the roster', () => {
    const data = { ...emptyData(), profile, roster, shifts: mergeCompanyShifts([], roster, profile) }
    const swap = newSwap({ kind: 'intercambio', date: '2026-10-05', start: '05:00', end: '13:00', role: '', coworker: 'Luis Gómez', coworkerStart: '13:00', coworkerEnd: '21:00', note: '' })
    const next = applyAcceptedSwap({ ...data, swaps: [swap] }, swap)
    expect(next.shifts[0]).toMatchObject({ start: '13:00', end: '21:00', source: 'cambio' })
    expect(next.roster.find((e) => e.employee === 'Luis Gómez')).toMatchObject({ start: '05:00', end: '13:00' })
    expect(next.swaps[0].status).toBe('aceptado')
  })
  it('removes a covered shift', () => {
    const data = { ...emptyData(), profile, roster, shifts: mergeCompanyShifts([], roster, profile) }
    const swap = newSwap({ kind: 'cesion', date: '2026-10-05', start: '05:00', end: '13:00', role: '', coworker: 'Marta Ruiz', coworkerStart: '', coworkerEnd: '', note: '' })
    const next = applyAcceptedSwap(data, swap)
    expect(next.shifts).toHaveLength(0)
    expect(next.roster.find((e) => e.employee === 'Marta Ruiz')).toMatchObject({ start: '05:00', end: '13:00', label: '' })
  })
})

describe('ics', () => {
  it('ends overnight shifts on the next day', () => {
    const ics = shiftsToICS([{ id: 'a', date: '2026-10-31', start: '22:00', end: '06:00', role: 'Rampa', flights: [], notes: '', source: 'manual' }])
    expect(ics).toContain('DTSTART:20261031T220000')
    expect(ics).toContain('DTEND:20261101T060000')
  })
})
