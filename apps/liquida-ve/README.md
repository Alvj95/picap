# LiquidaYa VE

Calculadora laboral y fiscal para **Venezuela**, con montos en **bolívares y dólares** a la tasa oficial del BCV.
Funciona en el navegador y en el teléfono (PWA): no necesita servidor ni base de datos.

## Qué hace

- **Liquidación según la LOTTT (2012)**
  - Antigüedad exacta (años, meses y días).
  - Salario diario e **integral** (alícuotas de utilidades y bono vacacional).
  - **Prestaciones sociales** por garantía trimestral (art. 142 a y b) y por retroactivo (art. 142 c), y paga **la mayor** (art. 142 d).
  - Vacaciones y bono vacacional **fraccionados** (arts. 190, 192 y 196), vacaciones vencidas.
  - Utilidades fraccionadas (art. 131, 30 a 120 días).
  - **Indemnización por despido injustificado** (art. 92).
  - **Finiquito imprimible / PDF** con el monto en letras en bolívares y dólares, y espacio para las firmas.
  - Envío del resumen por WhatsApp.
- **IVA (16 %) e IGTF (3 %)** para calcular el precio final en Bs. y US$.
- **Conversor Bs. ⇄ US$** con el monto en letras.
- **Tasa BCV automática** (desde `ve.dolarapi.com`); si no hay conexión, se escribe a mano y queda guardada.

## Cómo ganar dinero con ella

| Cliente | Qué paga | Precio sugerido |
| --- | --- | --- |
| Trabajadores | Liquidación con PDF sin marca de agua | 1–3 US$ por documento |
| Pymes, contadores, RR. HH. | Plan mensual: liquidaciones ilimitadas, logo propio y varios trabajadores | 5–15 US$/mes |
| Escritorios contables | Licencia con su marca (marca blanca) | Pago único o anual |

Los cobros en Venezuela pueden hacerse por Pago Móvil, Zelle o Binance Pay.

## Límites del cálculo

- Usa el **último salario** para todo el período. Si hubo aumentos, la garantía real (depositada trimestre a trimestre) puede variar.
- No incluye los **intereses sobre prestaciones** (art. 143) ni los anticipos ya entregados.
- Los bonos no salariales (cestaticket, bono contra la guerra económica) no forman parte del salario para estos cálculos.
- Es una herramienta referencial: un caso en litigio debe revisarlo un abogado laboral.

## Desarrollo

```bash
cd apps/liquida-ve
npm install
npm run dev     # http://localhost:5173
npm test        # pruebas de los cálculos (LOTTT, letras, IVA/IGTF)
npm run build   # genera dist/
```

La lógica legal está en `src/lib/lottt.ts`; los montos en letras están en `src/lib/letras.ts`.
