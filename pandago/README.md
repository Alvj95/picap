# 🐼 PandaGO! — Aprende chino mandarín jugando

App móvil gamificada para aprender mandarín (HSK 1 → 6) con **Bao**, un panda rojo guía, y un **tutor de conversación con IA** que corrige con empatía, propone huecos y evalúa tu pronunciación y tus tonos.

| Home (claro) | Camino de aprendizaje (oscuro) | Chat con Bao |
| --- | --- | --- |
| ![Home](docs/screenshots/home-light.png) | ![Camino](docs/screenshots/home-dark-path.png) | ![Chat](docs/screenshots/chat-light.png) |

> Capturas reales de la app renderizada (Expo web, 390×844). El chat usa respuestas simuladas del backend.

## Stack

| Capa | Elección | Por qué |
| --- | --- | --- |
| App | **React Native + Expo SDK 57** (TypeScript, Nueva Arquitectura) | Un código para iOS/Android, OTA updates, mismo lenguaje que el backend |
| Navegación | **Expo Router** (rutas por archivos) | Deep links (`pandago://chat`) y modales gratis |
| Animación | **Reanimated 4** (hilo UI) + **react-native-svg** | Microinteracciones a 60/120 fps; Bao es vectorial y se anima por estado |
| Háptica | `expo-haptics` | Vocabulario único: `tap`, `press`, `correct`, `wrong`, `levelUp` |
| Estado | **Zustand** + `persist` (AsyncStorage) | Progreso offline-first; se sincroniza con el servidor en segundo plano |
| Voz | `expo-audio` (grabación) + `expo-speech` (TTS zh-CN) | Grabar → backend de evaluación de pronunciación |
| Backend | **Node + Hono** + **Claude API** (`@anthropic-ai/sdk`, salida estructurada con Zod) | La API key nunca está en el móvil; validación del contrato en ambos lados |

## Estructura de carpetas

```
pandago/
├── app/                          # Rutas (Expo Router) — solo "pegamento", sin lógica
│   ├── _layout.tsx               # Fuentes, ThemeProvider, gestos, Stack raíz
│   ├── (tabs)/                   # Barra inferior: Aprender · Hablar · Ligas · Perfil
│   │   ├── _layout.tsx
│   │   └── index.tsx             # → features/home/HomeScreen
│   ├── chat.tsx                  # Conversación IA (modal a pantalla completa)
│   ├── lesson/[id].tsx           # Lección de ejercicios
│   └── review.tsx                # Repaso SRS
│
├── src/
│   ├── theme/                    # Design system
│   │   ├── tokens.ts             # Colores semánticos claro/oscuro, radios, tipografía, motion
│   │   └── ThemeProvider.tsx     # useTheme() + preferencia sistema/claro/oscuro
│   ├── components/
│   │   ├── ui/                   # Primitivas: Button3D, Card, PressableScale, ProgressBar, StatPill
│   │   └── mascot/               # Bao: BaoFace (SVG), Bao (animaciones por mood), BaoBubble
│   ├── features/                 # Un directorio por dominio (vertical slices)
│   │   ├── home/                 # HomeScreen + TopStatusBar, DailyGoalCard, QuickActions,
│   │   │                         #   LeagueChestRow, LearningPath, PathNode
│   │   ├── chat/
│   │   │   ├── ChatScreen.tsx
│   │   │   ├── components/       # MessageBubble, TaskInput (texto / hueco / micrófono)
│   │   │   └── engine/           # ⚙️ Lógica pura, testeable sin UI
│   │   │       ├── contract.ts   # Esquemas Zod compartidos app ⇄ servidor
│   │   │       ├── orchestrator.ts  # Máquina de estados del chat (reducer)
│   │   │       ├── tones.ts      # Sandhi tonal, tonos desde pinyin, puntuación por sílaba
│   │   │       └── aiClient.ts   # HTTP al backend (tutor + evaluación de voz)
│   │   └── learning/adaptive/    # 🧠 Motor adaptativo HSK
│   │       ├── learnerModel.ts   # Elo por dimensión + dominio por ítem + etiquetas de error
│   │       ├── srs.ts            # Repetición espaciada (curva de olvido tipo FSRS)
│   │       └── levelEngine.ts    # Selección de ejercicios, dificultad en sesión, promoción HSK
│   ├── store/                    # useProgressStore (racha, vidas, XP, ligas, cofres) · useLearnerStore
│   ├── data/hsk/                 # Tipos de contenido + muestra HSK 1 (el corpus vive en el backend)
│   └── lib/                      # haptics, auth
│
├── server/                       # Backend del tutor IA
│   └── src/
│       ├── index.ts              # POST /v1/tutor/turn (Hono)
│       ├── tutor.ts              # Llamada a Claude con structured outputs + reintento de nivel
│       ├── promptBuilder.ts      # System prompt estable (cacheado) + turno volátil
│       ├── levelGuard.ts         # Verificación determinista de vocabulario fuera de nivel
│       └── vocab.ts
│
└── docs/
    ├── AI_ENGINE.md              # Lógica del motor de IA conversacional y de adaptación HSK
    └── screenshots/
```

**Regla de dependencias:** `app/` → `features/` → `components/`, `store/`, `theme/`. Los `engine/` y `adaptive/` no importan React ni React Native, así que se prueban con Node y el servidor puede reutilizar el contrato.

## Diseño visual (resumen)

- **Paleta "panda rojo"**: naranja Bao `#FF6B2C` (acción principal), verde bambú (acierto), cereza (error/vidas), oro (XP/cofres), violeta (ligas). Todos los componentes usan **roles semánticos** (`c.primary`, `c.successSoft`…) que cambian entre claro y oscuro; ningún componente usa un hex directo.
- **Profundidad táctil**: tarjetas y botones con *labio* inferior de 4 px; al pulsar, la cara baja y tapa el labio (`Button3D`), y todo lo pulsable encoge con resorte + háptica (`PressableScale`).
- **Tipografía**: Nunito (redonda, amable) para el latín y Noto Sans SC para los hanzi.
- **Bao** reacciona a todo: respira en reposo, salta con destellos al acertar, gira al completar, se estremece y anima al fallar, inclina la cabeza mientras la IA "piensa".
- **Camino serpenteante** (onda senoidal) con nodos completados ⭐, nodo actual flotando con "EMPEZAR", cofres que se agitan y nodos bloqueados 🔒.

## Gamificación

Implementada en `src/store/useProgressStore.ts`:

- **Racha diaria** con *protectores de racha* que cubren días perdidos automáticamente.
- **Vidas** (5): se pierden en lecciones, se regeneran 1 cada 30 min. En el chat con IA **no se pierden vidas**, para que hablar sea seguro.
- **XP** con meta diaria, **ligas semanales** (Bambú → Jade → Seda → Linterna → Dragón → Emperador).
- **Cofres** con recompensa variable (refuerzo intermitente) y un mínimo garantizado.

## Ejecutar

```bash
# App
cd pandago
npm install
npx expo start            # escanea el QR con Expo Go o usa un emulador
npm run typecheck

# Backend del tutor
cd pandago/server
npm install
ANTHROPIC_API_KEY=... npm run dev   # http://localhost:8787
```

Configura la URL del backend en `app.json` → `expo.extra.apiUrl` (por defecto `http://localhost:8787`).

## Qué falta para producción

- Pantallas de lección (los 4 tipos de ejercicio), ligas, perfil y repaso (hoy son marcadores).
- Servicio de voz `/v1/speech/assess`: ASR de mandarín + alineamiento forzado + clasificador de tonos por F0 (ver `docs/AI_ENGINE.md`).
- Autenticación real, sincronización del progreso con el servidor, y el corpus HSK 1-6 completo.
- Animación de Bao en **Rive** (state machine con los mismos estados que `BaoMood`) para sustituir al SVG.
