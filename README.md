# Mi Anillo

App **gratuita y sin nube** para anillos inteligentes que usan la app **QRing**, como el **Leotec Kör Mau**, los Colmi R02/R03/R06/R10 y sus clones (chip Realtek RTL8762). Se conecta directamente al anillo por Bluetooth y guarda tus datos solo en el teléfono.

## Instalar en Android

1. Desde el teléfono abre la página **Releases** del repositorio (la más reciente).
2. Descarga **MiAnillo.apk** (si el navegador lo bloquea, baja `MiAnillo-apk.zip` y descomprímelo).
3. Ábrelo y permite “instalar apps de origen desconocido”.
4. Cierra la app QRing (o desvincula el anillo allí): el anillo solo acepta **una conexión a la vez**.
5. En Mi Anillo pulsa **Buscar anillo**, concede el permiso de “dispositivos cercanos” y elige tu anillo.

**Dos APK:** `MiAnillo.apk` es la normal y se instala sin problemas. `MiAnillo-avisos.apk` añade los avisos de notificaciones en el anillo; Google Play Protect bloquea las apps instaladas fuera de la tienda que leen notificaciones, así que para esa hay que pausar Play Protect mientras se instala (Play Store → tu foto → Play Protect → ⚙️).

Cada push compila un APK nuevo automáticamente con GitHub Actions y lo publica en Releases.

> iPhone: Safari no permite Bluetooth en páginas web, así que la versión web no puede conectarse al anillo desde iOS. En Chrome (Android o PC) la versión web sí funciona con Web Bluetooth.

## Qué hace

- **Hoy**: pasos con meta diaria, calorías, distancia, pulso y oxígeno.
- **Medir ahora**: pulso (lpm) y SpO₂ (%) en tiempo real.
- **Entreno con GPS** (del teléfono; el anillo no tiene GPS): caminar, correr o bici con mapa de la ruta (OpenStreetMap), distancia, tiempo, ritmo o velocidad, calorías y pulso del anillo durante el ejercicio. Historial de entrenos con su mapa.
- **📸 Cámara remota**: haz fotos tocando el anillo. La app aprende el toque o gesto de tu anillo la primera vez. Incluye temporizador, cámara frontal/trasera y compartir o guardar en Fotos.
- **🔔 Avisos en el anillo**: llamadas, WhatsApp, SMS, redes sociales y correo hacen que el anillo se encienda o vibre (servicio nativo de Android, funciona con la app en segundo plano; solo en `MiAnillo-avisos.apk`).
- **🧘 Respiración guiada**: Calma, Cuadrada o 4-7-8, de 1 a 5 min, con tu pulso antes y después.
- **📊 Resumen semanal**: pasos por día con la meta, sueño medio, pulso en reposo y entrenos, comparados con la semana anterior.
- **🏆 Rachas y logros**: racha de días cumpliendo la meta y 16 logros desbloqueables.
- **😌 Estrés y 💓 HRV**: cada 30 min, con gráfica diaria (si el anillo lo admite).
- **👆 Gestos**: enseña a la app cada gesto del anillo (dos veces) y asígnale pausar/pasar canción, volumen o empezar/terminar entreno. Los controles de música funcionan con cualquier app y con la pantalla apagada. Incluye un detector de eventos para descubrir los modos deportivos del anillo.
- **🎮 Juegos** controlados con el anillo: *Salta* (toca para saltar), *Reflejos* (tiempo de reacción) y *Globo zen* (sube cuando baja tu pulso). Sin anillo se juegan tocando la pantalla.
- **Apagar y restablecer de fábrica** el anillo desde Ajustes.
- **Historial de 7 días**: gráfica de pulso del día (min/media/máx), pasos por hora, fases del sueño y mediciones manuales.
- **Ajustes del anillo**: pulso automático (cada 5–60 min) y oxígeno automático.
- **Alertas**: vibración y aviso si el pulso sale del rango o el oxígeno baja del límite que elijas.
- **Buscar mi anillo**: lo hace parpadear o vibrar.
- **Exportar CSV** para Excel o Google Sheets.
- **Registro técnico**: muestra los paquetes Bluetooth. Las líneas con ★ son eventos que envía el propio anillo (toques, gestos), para poder añadir funciones nuevas como el control remoto de la cámara.
- Ajusta la hora del anillo al conectar y se reconecta solo al abrir la app.

## Cómo funciona

| Parte | Archivo |
| --- | --- |
| Bluetooth nativo de Android (buscar, conectar, enviar, recibir) | `android/app/src/main/java/com/mianillo/app/RingBlePlugin.java` |
| Bluetooth en el navegador (Web Bluetooth) | `src/lib/ble.ts` |
| Protocolo del anillo (comandos de 16 bytes con checksum) | `src/lib/ring.ts` |
| Almacenamiento local y exportación CSV | `src/lib/store.ts` |
| Pantallas y gráficas | `src/App.tsx`, `src/Charts.tsx` |

El protocolo es el de los anillos Colmi R0x, documentado por la comunidad (Gadgetbridge y `colmi_r02_client`):
servicio `6e40fff0-…`, escritura `6e400002-…`, notificaciones `6e400003-…`, y un canal de “big data” (`de5bf728-…`) para el sueño.

## Desarrollo

```bash
npm ci
npm run dev        # versión web (Chrome, con Web Bluetooth)
npm run android    # compila y abre el proyecto en Android Studio
```

## Límites del anillo

- **Pago NFC**: el Kör Mau no tiene chip NFC (solo Bluetooth), así que no puede pagar; no es algo que una app pueda añadir.
- **GPS**: el anillo no tiene GPS; los entrenos usan el del teléfono, con la pantalla encendida.

Aviso: las lecturas son orientativas. El anillo no es un dispositivo médico.
