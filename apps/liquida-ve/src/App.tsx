import { useEffect, useMemo, useState } from 'react'
import { fechaLarga, formatoBs, formatoUsd, hoyISO, leerNumero } from './lib/formato.ts'
import { BOLIVARES, DOLARES, numeroALetras } from './lib/letras.ts'
import { factura, IGTF, IVA_GENERAL, liquidar, type Motivo } from './lib/lottt.ts'
import { guardarTasa, type Tasa, tasaBCV, tasaGuardada } from './lib/tasa.ts'

type Moneda = 'USD' | 'VES'
type Vista = 'liquidacion' | 'factura' | 'conversor'

const MOTIVOS: Record<Motivo, string> = {
  renuncia: 'Renuncia',
  despido_justificado: 'Despido justificado',
  despido_injustificado: 'Despido injustificado',
}

// Shows an amount in its own currency and its equivalent in the other one.
function Doble({ monto, moneda, tasa }: { monto: number; moneda: Moneda; tasa: number }) {
  const usd = moneda === 'USD' ? monto : tasa ? monto / tasa : 0
  const ves = moneda === 'VES' ? monto : monto * tasa
  return (
    <span className="doble">
      <strong>{formatoBs(ves)}</strong>
      <small>{tasa ? formatoUsd(usd) : '—'}</small>
    </span>
  )
}

function CampoNumero({ label, valor, onChange, sufijo }: { label: string; valor: string; onChange: (v: string) => void; sufijo?: string }) {
  return (
    <label className="campo">
      <span>{label}</span>
      <div className="con-sufijo">
        <input inputMode="decimal" value={valor} onChange={(e) => onChange(e.target.value)} placeholder="0,00" />
        {sufijo && <em>{sufijo}</em>}
      </div>
    </label>
  )
}

function SelectorMoneda({ moneda, onChange }: { moneda: Moneda; onChange: (m: Moneda) => void }) {
  return (
    <div className="segmento" role="group" aria-label="Moneda">
      {(['USD', 'VES'] as Moneda[]).map((m) => (
        <button key={m} className={moneda === m ? 'activo' : ''} onClick={() => onChange(m)} type="button">
          {m === 'USD' ? 'US$' : 'Bs.'}
        </button>
      ))}
    </div>
  )
}

function BarraTasa({ tasa, setTasa }: { tasa: Tasa | null; setTasa: (t: Tasa) => void }) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')

  const actualizar = async () => {
    setCargando(true)
    setError('')
    try {
      setTasa(await tasaBCV())
    } catch {
      setError('No se pudo consultar el BCV. Escribe la tasa del día.')
      setEditando(true)
    } finally {
      setCargando(false)
    }
  }

  // Refresh once per day on open.
  useEffect(() => {
    if (!tasa || tasa.fecha !== hoyISO()) void actualizar()
  }, [])

  const guardar = () => {
    const v = leerNumero(texto)
    if (v) {
      setTasa({ valor: v, fecha: hoyISO(), fuente: 'manual' })
      setEditando(false)
      setError('')
    }
  }

  return (
    <div className="tasa">
      {editando ? (
        <div className="tasa-editar">
          <input autoFocus inputMode="decimal" placeholder="Bs. por dólar" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && guardar()} />
          <button className="btn" onClick={guardar} type="button">Usar</button>
        </div>
      ) : (
        <button className="tasa-valor" onClick={() => { setTexto(tasa ? String(tasa.valor).replace('.', ',') : ''); setEditando(true) }} type="button">
          <span>Tasa {tasa?.fuente === 'manual' ? 'manual' : 'BCV'}</span>
          <strong>{tasa ? `${formatoBs(tasa.valor)} / US$` : 'Sin tasa'}</strong>
          <small>{tasa ? fechaLarga(tasa.fecha) : 'Toca para escribirla'}</small>
        </button>
      )}
      <button className="btn-sec" onClick={actualizar} disabled={cargando} type="button">{cargando ? 'Consultando…' : '↻ BCV'}</button>
      {error && <p className="aviso">{error}</p>}
    </div>
  )
}

function VistaLiquidacion({ tasa }: { tasa: number }) {
  const [trabajador, setTrabajador] = useState('')
  const [cedula, setCedula] = useState('')
  const [cargo, setCargo] = useState('')
  const [patrono, setPatrono] = useState('')
  const [rif, setRif] = useState('')
  const [ingreso, setIngreso] = useState('2022-01-10')
  const [egreso, setEgreso] = useState(hoyISO())
  const [salario, setSalario] = useState('')
  const [moneda, setMoneda] = useState<Moneda>('USD')
  const [diasUtil, setDiasUtil] = useState('30')
  const [vacPend, setVacPend] = useState('0')
  const [motivo, setMotivo] = useState<Motivo>('renuncia')

  const salarioN = leerNumero(salario)
  const fechasOk = ingreso && egreso && ingreso < egreso
  const util = Math.min(Math.max(leerNumero(diasUtil) || 30, 30), 120)
  const liq = useMemo(
    () => (fechasOk && salarioN ? liquidar({ ingreso, egreso, salarioMensual: salarioN, diasUtilidades: util, vacacionesPendientes: leerNumero(vacPend), motivo }) : null),
    [fechasOk, ingreso, egreso, salarioN, util, vacPend, motivo],
  )
  const enBs = (n: number) => (moneda === 'VES' ? n : n * tasa)
  const enUsd = (n: number) => (moneda === 'USD' ? n : tasa ? n / tasa : 0)

  const compartir = () => {
    if (!liq) return
    const lineas = [
      `*Liquidación LOTTT* — ${trabajador || 'Trabajador'}`,
      `Antigüedad: ${liq.antiguedad.anios} años, ${liq.antiguedad.meses} meses, ${liq.antiguedad.dias} días`,
      ...liq.conceptos.map((c) => `• ${c.concepto}: ${formatoBs(enBs(c.monto))} (${formatoUsd(enUsd(c.monto))})`),
      `*Total: ${formatoBs(enBs(liq.total))} (${formatoUsd(enUsd(liq.total))})*`,
      `Tasa BCV: ${formatoBs(tasa)}`,
    ]
    window.open(`https://wa.me/?text=${encodeURIComponent(lineas.join('\n'))}`, '_blank')
  }

  return (
    <>
      <section className="tarjeta no-print">
        <h2>Datos de la relación laboral</h2>
        <div className="rejilla">
          <label className="campo"><span>Trabajador(a)</span><input value={trabajador} onChange={(e) => setTrabajador(e.target.value)} placeholder="Nombre y apellido" /></label>
          <label className="campo"><span>Cédula</span><input value={cedula} onChange={(e) => setCedula(e.target.value)} placeholder="V-12.345.678" /></label>
          <label className="campo"><span>Cargo</span><input value={cargo} onChange={(e) => setCargo(e.target.value)} /></label>
          <label className="campo"><span>Patrono / empresa</span><input value={patrono} onChange={(e) => setPatrono(e.target.value)} /></label>
          <label className="campo"><span>RIF</span><input value={rif} onChange={(e) => setRif(e.target.value)} placeholder="J-12345678-9" /></label>
          <label className="campo"><span>Motivo de egreso</span>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value as Motivo)}>
              {Object.entries(MOTIVOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="campo"><span>Fecha de ingreso</span><input type="date" value={ingreso} onChange={(e) => setIngreso(e.target.value)} /></label>
          <label className="campo"><span>Fecha de egreso</span><input type="date" value={egreso} onChange={(e) => setEgreso(e.target.value)} /></label>
        </div>
        <div className="fila-salario">
          <CampoNumero label="Último salario mensual" valor={salario} onChange={setSalario} />
          <SelectorMoneda moneda={moneda} onChange={setMoneda} />
        </div>
        <div className="rejilla">
          <CampoNumero label="Días de utilidades al año (30–120)" valor={diasUtil} onChange={setDiasUtil} sufijo="días" />
          <CampoNumero label="Vacaciones vencidas no disfrutadas" valor={vacPend} onChange={setVacPend} sufijo="días" />
        </div>
        {!fechasOk && <p className="aviso">La fecha de egreso debe ser posterior a la de ingreso.</p>}
        {moneda === 'USD' && !tasa && <p className="aviso">Falta la tasa BCV para mostrar los montos en bolívares.</p>}
      </section>

      {liq && (
        <>
          <section className="tarjeta no-print">
            <h2>Resultado</h2>
            <dl className="resumen">
              <div><dt>Antigüedad</dt><dd>{liq.antiguedad.anios} a, {liq.antiguedad.meses} m, {liq.antiguedad.dias} d</dd></div>
              <div><dt>Salario diario</dt><dd><Doble monto={liq.salarioDiario} moneda={moneda} tasa={tasa} /></dd></div>
              <div><dt>Salario integral diario</dt><dd><Doble monto={liq.salarioIntegral} moneda={moneda} tasa={tasa} /></dd></div>
              <div><dt>Garantía ({liq.diasGarantia} días)</dt><dd><Doble monto={liq.garantia} moneda={moneda} tasa={tasa} /></dd></div>
              <div><dt>Retroactivo ({liq.diasRetroactivo} días)</dt><dd><Doble monto={liq.retroactivo} moneda={moneda} tasa={tasa} /></dd></div>
            </dl>
            <ul className="conceptos">
              {liq.conceptos.map((c) => (
                <li key={c.concepto}>
                  <div><b>{c.concepto}</b><small>{c.detalle} · {c.dias.toLocaleString('es-VE')} días</small></div>
                  <Doble monto={c.monto} moneda={moneda} tasa={tasa} />
                </li>
              ))}
              <li className="total"><b>Total a pagar</b><Doble monto={liq.total} moneda={moneda} tasa={tasa} /></li>
            </ul>
            <div className="acciones">
              <button className="btn" onClick={() => window.print()} type="button">Imprimir / guardar PDF</button>
              <button className="btn-sec" onClick={compartir} type="button">Enviar por WhatsApp</button>
            </div>
            <p className="nota">Cálculo referencial con el último salario. No incluye intereses sobre prestaciones (art. 143) ni anticipos ya pagados. Los bonos no salariales (cestaticket, bono de guerra) no forman parte del salario.</p>
          </section>

          <article className="documento">
            <h1>Finiquito y liquidación de prestaciones sociales</h1>
            <p className="doc-lugar">Venezuela, {fechaLarga(egreso)}</p>
            <table className="doc-datos">
              <tbody>
                <tr><th>Trabajador(a)</th><td>{trabajador || '________________'}</td><th>Cédula</th><td>{cedula || '__________'}</td></tr>
                <tr><th>Patrono</th><td>{patrono || '________________'}</td><th>RIF</th><td>{rif || '__________'}</td></tr>
                <tr><th>Cargo</th><td>{cargo || '—'}</td><th>Motivo</th><td>{MOTIVOS[motivo]}</td></tr>
                <tr><th>Ingreso</th><td>{fechaLarga(ingreso)}</td><th>Egreso</th><td>{fechaLarga(egreso)}</td></tr>
                <tr><th>Antigüedad</th><td colSpan={3}>{liq.antiguedad.anios} años, {liq.antiguedad.meses} meses y {liq.antiguedad.dias} días</td></tr>
                <tr><th>Salario mensual</th><td>{formatoBs(enBs(salarioN))}{tasa ? ` (${formatoUsd(enUsd(salarioN))})` : ''}</td><th>Salario integral diario</th><td>{formatoBs(enBs(liq.salarioIntegral))}</td></tr>
              </tbody>
            </table>
            <table className="doc-tabla">
              <thead><tr><th>Concepto</th><th>Días</th><th>Monto Bs.</th><th>Ref. US$</th></tr></thead>
              <tbody>
                {liq.conceptos.map((c) => (
                  <tr key={c.concepto}><td>{c.concepto}<small>{c.detalle}</small></td><td>{c.dias.toLocaleString('es-VE')}</td><td>{formatoBs(enBs(c.monto))}</td><td>{tasa ? formatoUsd(enUsd(c.monto)) : '—'}</td></tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={2}>Total</td><td>{formatoBs(enBs(liq.total))}</td><td>{tasa ? formatoUsd(enUsd(liq.total)) : '—'}</td></tr></tfoot>
            </table>
            <p>
              Recibí de <b>{patrono || '________________'}</b> la cantidad de <b>{numeroALetras(enBs(liq.total), BOLIVARES)}</b> ({formatoBs(enBs(liq.total))})
              {tasa ? <>, equivalentes a {numeroALetras(enUsd(liq.total), DOLARES)} ({formatoUsd(enUsd(liq.total))}) a la tasa oficial del BCV de {formatoBs(tasa)} por dólar,</> : ','}{' '}
              por concepto de liquidación de prestaciones sociales y demás beneficios laborales conforme a la LOTTT.
            </p>
            <div className="firmas">
              <div><span />{trabajador || 'Trabajador(a)'}<small>C.I. {cedula}</small></div>
              <div><span />{patrono || 'Patrono'}<small>RIF {rif}</small></div>
            </div>
            <p className="marca">Generado con LiquidaYa</p>
          </article>
        </>
      )}
    </>
  )
}

function VistaFactura({ tasa }: { tasa: number }) {
  const [base, setBase] = useState('')
  const [exento, setExento] = useState('')
  const [moneda, setMoneda] = useState<Moneda>('USD')
  const [divisas, setDivisas] = useState(true)
  const f = factura(leerNumero(base), leerNumero(exento), divisas)
  const filas: [string, number][] = [
    ['Base imponible', f.base],
    ['Exento', f.exento],
    [`IVA ${IVA_GENERAL * 100} %`, f.iva],
    ['Subtotal', f.subtotal],
    [`IGTF ${IGTF * 100} % (pago en divisas)`, f.igtf],
  ]
  return (
    <section className="tarjeta">
      <h2>Precio con IVA e IGTF</h2>
      <div className="fila-salario">
        <CampoNumero label="Monto gravado (sin IVA)" valor={base} onChange={setBase} />
        <SelectorMoneda moneda={moneda} onChange={setMoneda} />
      </div>
      <CampoNumero label="Monto exento" valor={exento} onChange={setExento} />
      <label className="check"><input type="checkbox" checked={divisas} onChange={(e) => setDivisas(e.target.checked)} /> El cliente paga en divisas (aplica IGTF)</label>
      <ul className="conceptos">
        {filas.map(([k, v]) => <li key={k}><b>{k}</b><Doble monto={v} moneda={moneda} tasa={tasa} /></li>)}
        <li className="total"><b>Total a cobrar</b><Doble monto={f.total} moneda={moneda} tasa={tasa} /></li>
      </ul>
      <p className="nota">El IGTF lo cobran los contribuyentes especiales y las personas jurídicas que reciben pagos en divisas. La factura fiscal debe emitirse en bolívares desde una máquina o sistema autorizado por el SENIAT.</p>
    </section>
  )
}

function VistaConversor({ tasa }: { tasa: number }) {
  const [monto, setMonto] = useState('')
  const [moneda, setMoneda] = useState<Moneda>('USD')
  const n = leerNumero(monto)
  const ves = moneda === 'VES' ? n : n * tasa
  const usd = moneda === 'USD' ? n : tasa ? n / tasa : 0
  return (
    <section className="tarjeta">
      <h2>Conversor Bs. ⇄ US$</h2>
      <div className="fila-salario">
        <CampoNumero label="Monto" valor={monto} onChange={setMonto} />
        <SelectorMoneda moneda={moneda} onChange={setMoneda} />
      </div>
      <div className="conversion">
        <strong>{moneda === 'USD' ? formatoBs(ves) : formatoUsd(usd)}</strong>
        <small>{numeroALetras(moneda === 'USD' ? ves : usd, moneda === 'USD' ? BOLIVARES : DOLARES)}</small>
      </div>
    </section>
  )
}

export default function App() {
  const [vista, setVista] = useState<Vista>('liquidacion')
  const [tasa, setTasaState] = useState<Tasa | null>(tasaGuardada)
  const setTasa = (t: Tasa) => {
    setTasaState(t)
    guardarTasa(t)
  }
  const valorTasa = tasa?.valor ?? 0

  return (
    <div className="app">
      <header className="cabecera no-print">
        <div className="logo"><span>Liquida</span>Ya <em>VE</em></div>
        <BarraTasa tasa={tasa} setTasa={setTasa} />
      </header>
      <nav className="pestanas no-print">
        {([['liquidacion', 'Liquidación'], ['factura', 'IVA e IGTF'], ['conversor', 'Conversor']] as [Vista, string][]).map(([k, v]) => (
          <button key={k} className={vista === k ? 'activo' : ''} onClick={() => setVista(k)} type="button">{v}</button>
        ))}
      </nav>
      <main>
        {vista === 'liquidacion' && <VistaLiquidacion tasa={valorTasa} />}
        {vista === 'factura' && <VistaFactura tasa={valorTasa} />}
        {vista === 'conversor' && <VistaConversor tasa={valorTasa} />}
      </main>
    </div>
  )
}
