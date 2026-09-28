# Turnos Handling

App web/móvil (PWA) de calendario de turnos para el personal de handling del aeropuerto.

## Qué hace

- **Mis turnos**: calendario mensual con tus turnos (hora de entrada y salida, puesto) y los **vuelos que te toca atender** en check-in/embarque (nº de vuelo, destino, hora de salida STD, mostradores o puerta). Turnos nocturnos que terminan al día siguiente incluidos. Exporta el mes a Google Calendar / Outlook / calendario del móvil (`.ics`).
- **Horario**: carga el **horario general de la empresa** y consulta quién trabaja cada día, agrupado por franja horaria. Tus turnos se pasan al calendario automáticamente.
- **Cambios**: elige uno de tus turnos y la app te muestra, según el horario general, qué compañeros trabajan en otra franja ese día (**intercambio**) o están libres (**te pueden cubrir**). El cambio sigue estos pasos:
  1. **Envías la solicitud** a tu compañero por WhatsApp. El mensaje lleva un enlace.
  2. **Tu compañero abre el enlace**, ve la solicitud en su app y pulsa **Aceptar** o **Rechazar**. Su respuesta te llega por WhatsApp, también con un enlace.
  3. **Abres su respuesta** y, si aceptó, te aparece el botón **✉️ Enviar correo a programación**, que abre tu correo con el mensaje ya redactado (fecha, turnos de los dos y la hora en que tu compañero aceptó). El correo de programación se pide la primera vez y queda en tu perfil.
  4. Cuando **programación lo aprueba**, cada uno lo marca en su app y el cambio se aplica a su calendario.
- **Horas**: horas del mes, horas nocturnas (22:00–06:00), turnos, vuelos atendidos, desglose por semana y por puesto.
- **Perfil y copia de seguridad**: tu nombre (tal como aparece en el horario) y nº de empleado; descarga/restaura una copia para cambiar de teléfono.

Funciona sin conexión después de abrirla la primera vez. Los datos se guardan en el propio teléfono.

## Formato del horario de la empresa

Se sube como CSV o se **copia la tabla en Excel y se pega** en la app. Se aceptan dos formatos:

**1. Una fila por turno** (columnas en cualquier orden; `Puesto` y `Vuelos` son opcionales):

| Fecha | Empleado | Entrada | Salida | Puesto | Vuelos |
| --- | --- | --- | --- | --- | --- |
| 05/10/2026 | Ana Pérez | 05:00 | 13:00 | Check-in | IB6401 MAD 07:30, UX1093 LIS 09:10 |
| 05/10/2026 | Marta Ruiz | LIBRE | | | |

También sirve una sola columna `Horario`/`Turno` con `05:00-13:00`.

**2. Cuadrante mensual**: empleados en la primera columna y un día por columna (`01/10`, `Jue 1`, `1`…). Las celdas pueden ser `06:00-14:00`, `0600-1400`, `6-14`, `22:00-06:00 Rampa`, o un código como `LIBRE`, `VAC`, `BAJA`.

La app tiene un botón para descargar una plantilla.

## Desarrollo

```bash
cd handling
npm install
npm run dev     # http://localhost:5173
npm test        # tests del importador, horas y cambios
npm run build   # genera dist/
```

## Siguientes pasos

Hoy cada trabajador tiene sus datos en su teléfono y las solicitudes viajan como enlaces por WhatsApp. Para que el horario y las solicitudes se sincronicen solas (sin reenviar enlaces) y programación apruebe desde la propia app entre compañeros y supervisores hace falta un backend (p. ej. Supabase o Firebase) con inicio de sesión; toda la persistencia está en `src/lib/store.ts` para poder sustituirla. Otras ideas: aprobación de cambios por el supervisor, avisos antes de cada turno, lectura directa de `.xlsx` y del plan de vuelos del día.
