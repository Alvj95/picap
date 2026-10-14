# Motor de IA de PandaGO!

Dos sistemas cooperan:

1. **Tutor conversacional** (LLM en el servidor): genera los turnos de Bao o del personaje nativo, corrige y decide la siguiente tarea.
2. **Motor adaptativo HSK** (código determinista en el dispositivo): mide lo que sabe el estudiante, elige ejercicios y decide cuándo sube de nivel.

El principio: **el LLM hace lo que solo un LLM puede hacer** (conversar con naturalidad, entender respuestas abiertas, explicar errores). Todo lo que se puede calcular — tonos esperados, puntuaciones, selección de ejercicios, promoción de nivel, control de vocabulario — es código determinista, rápido, barato y testeable.

```
┌──────────────── App (React Native) ────────────────┐        ┌──────────── Servidor ────────────┐
│                                                    │        │                                   │
│  ChatScreen ──► orchestrator (reducer) ──────────────────►  POST /v1/tutor/turn                │
│      ▲              │ buildTurnRequest()           │  JSON  │   1. Zod valida TurnRequest       │
│      │              │  · escenario                 │        │   2. promptBuilder                │
│      │              │  · LearnerSnapshot ◄─────┐   │        │      system (cacheado, por nivel) │
│      │              │  · historial (últimos 12) │   │        │      + turno volátil              │
│      │              ▼                          │   │        │   3. Claude → TutorTurn (Zod)     │
│   Bao mood ◄── TutorTurn ──► learnFrom() ──► learnerModel  │   4. levelGuard: ¿>15% fuera de   │
│   háptica        corrections / used_item_ids   (Elo + SRS) │      nivel? → 1 reintento         │
│                                                ▲   │        │                                   │
│  🎙️ grabar ──► /v1/speech/assess ──► tones.ts ──┘   │        │  POST /v1/speech/assess          │
│               (ASR + alineado + F0)  sandhi+score  │        │   ASR zh + alineamiento + tonos   │
└────────────────────────────────────────────────────┘        └───────────────────────────────────┘
```

---

## 1. Tutor conversacional

### 1.1 Escenarios

Cada conversación es un `Scenario` (`src/features/chat/engine/contract.ts`): un **objetivo comunicativo** ("pide un té y da las gracias"), una **persona** (`bao` o `native` con un rol: camarero, compañero…), las **palabras objetivo** de la unidad y un máximo de turnos. Los escenarios están atados a los nodos del camino (`kind: 'conversation'`), así que la conversación practica exactamente lo que la unidad acaba de enseñar.

### 1.2 El turno como salida estructurada

El modelo no devuelve texto libre sino un `TutorTurn` validado con Zod (structured outputs de la API de Claude, `client.beta.messages.parse` + `betaZodOutputFormat`):

| Campo | Para qué sirve |
| --- | --- |
| `reply {hanzi, pinyin, translation}` | La burbuja. Tocar = TTS zh-CN; mantener pulsado = traducción |
| `corrections[]` | Tarjeta verde de corrección. `error_tag` (`grammar:jiao-name`, `tones:3-3-sandhi`…) alimenta el modelo del estudiante |
| `task_score` 0..1 | Cuánto cumplió la intención comunicativa → XP y señal para la dificultad |
| `bao_mood` | Animación de Bao + háptica (happy → `correct`, encourage → `wrong`) |
| `hint` | Pista proactiva si el estudiante se atasca |
| `next_task` | `open_question` · `fill_gap {template, options, answer}` · `repeat_aloud {hanzi, pinyin}` — cambia la zona de entrada |
| `used_item_ids` | Vocabulario usado correctamente → refuerza el SRS |
| `scenario_complete` | Cierra la conversación con celebración, XP extra y vuelta al camino |

Así la UI nunca "interpreta" texto del LLM: cada decisión visual sale de un campo tipado.

### 1.3 Construcción del prompt (`server/src/promptBuilder.ts`)

- **System prompt estable por (persona, nivel, idioma)**: personalidad, reglas de nivel *i+1* (como máximo una palabra nueva por turno, longitud de frase según HSK), estilo de **corrección por reformulación** (*recast*: Bao repite la frase bien dicha, en vez de "¡mal!"), máximo 2 correcciones por turno, política de tareas (huecos cada 3-4 turnos, `repeat_aloud` cuando la pronunciación < 0.7) y la **lista de vocabulario permitido** del nivel. Lleva `cache_control` (TTL 1 h): con el corpus completo son miles de tokens que se leen de caché en cada turno (latencia y coste mucho menores).
- **Mensaje de usuario volátil**: escenario, debilidades del estudiante, `session_target_p`, historial recortado (12 mensajes) y la nueva entrada (texto, opción del hueco, o transcripción + nota de pronunciación).
- **Esfuerzo de razonamiento bajo** (`effort: 'low'`): es chat en tiempo real; lo difícil (tonos, niveles) ya lo resuelve el código.
- **Respaldo ante rechazos** (`fallbacks: 'default'`): si el filtro de seguridad rechaza un turno, la API lo reintenta en otro modelo dentro de la misma llamada.

### 1.4 Guardián de nivel (`server/src/levelGuard.ts`)

Los prompts no son garantías. Tras cada respuesta se cuentan los hanzi fuera del vocabulario permitido; si superan el 15 % se pide **una** reescritura con la lista de caracteres problemáticos. Si vuelve a pasarse, se acepta y la UI ofrece glosas.

### 1.5 Orquestador del chat (`src/features/chat/engine/orchestrator.ts`)

Una máquina de estados pura (`idle → tutor_typing → await_user → (recording → assessing) → … → finished`). Detalles de UX importantes:

- **Feedback instantáneo en huecos**: `checkGapLocally` compara con `answer` antes de llamar a la red → háptica y animación en 0 ms; la IA responde después con la continuación.
- **Sin vidas en el chat**: hablar debe sentirse seguro. Los errores dan menos XP, nunca castigo.
- **Bao "piensa"** mientras la IA genera (mood `thinking`), así la espera forma parte del personaje.

---

## 2. Pronunciación y tonos en tiempo real

Pipeline (servicio de voz `/v1/speech/assess`, independiente del LLM):

1. **Grabación** con `expo-audio` (pulsar y mantener) → m4a.
2. **ASR de mandarín** (p. ej. Whisper/Paraformer) para la transcripción libre.
3. **Alineamiento forzado** contra la frase esperada → segmentos por sílaba → **GOP** (*Goodness of Pronunciation*) de iniciales y finales.
4. **Clasificación de tono** por sílaba a partir del contorno de **F0** (pitch) normalizado al rango del hablante (CNN ligera sobre F0 + energía) → tono 1-4 o neutro + confianza.

En el cliente (`src/features/chat/engine/tones.ts`, determinista):

- `tonesFromPinyin` obtiene los tonos léxicos de la frase objetivo.
- `applySandhi` aplica las reglas reales del habla: 3+3 → 2+3 (你好 → ní hǎo, 我也很好 → wó yě hén hǎo), 不 ante 4º tono → bú, 一 → yí / yì. **Sin esto, la app castigaría al estudiante por pronunciar bien.**
- `scoreSyllables` combina 50 % segmental (GOP) + 50 % tono: un tono equivocado cambia la palabra (mǎi "comprar" ≠ mài "vender"). Cada sílaba se colorea *great / ok / retry*.
- `toneTip` genera el consejo empático de Bao con una imagen mental del tono ("subiendo, como cuando preguntas ¿eh?").

La puntuación viaja al LLM como `pronunciation_score`, que decide si pedir otra repetición (`repeat_aloud`) o seguir conversando.

---

## 3. Motor adaptativo HSK

### 3.1 Modelo del estudiante (`learnerModel.ts`)

Elo/IRT por **dimensión** — `vocab`, `grammar`, `listening`, `tones`, `writing`, `speaking`:

```
P(acierto) = σ(θ_dimensión − b_ítem)
θ ← θ + K · (resultado − P)        K decrece con los intentos
```

- `b` (dificultad del ítem) la estima el servidor agregando a todos los usuarios; HSK 1 ≈ −2 … HSK 6 ≈ +3.
- Crédito parcial (0..1) y **pistas** que valen la mitad.
- `mastery` por ítem (media móvil) y `stability` para el SRS.
- `errorTags`: contador de patrones de error que reporta la IA (`grammar:measure-word`). Los aciertos en esa dimensión los "curan" poco a poco. `topWeaknesses()` los inyecta en el prompt del tutor → **la conversación practica justo lo que fallas**.

### 3.2 Repetición espaciada (`srs.ts`)

Curva de olvido `R(t) = 0.9^(t / stability)`; un ítem vence cuando `R < 0.85`. Los aciertos multiplican la estabilidad, los fallos la reducen. Lo que usas bien en el chat (`used_item_ids`) también cuenta como repaso.

### 3.3 Selección de ejercicios (`levelEngine.ts → planLesson`)

- **Zona de desarrollo próximo**: se eligen ítems cuya `P(acierto)` esté cerca de `targetP` (0.80 por defecto).
- **Mezcla**: 60 % nuevo del nivel · 30 % repaso SRS · 10 % "estiramiento" del nivel siguiente.
- **Dimensión**: rota entre las 3 más débiles y elige el tipo de ejercicio que mejor la entrena (tonos → opción múltiple de audio y conversación; gramática → ordenar frases; escritura → trazos).
- **Intercalado** (interleaving) en vez de bloques.

### 3.4 Dificultad dentro de la sesión

`updateSession`: 3 fallos seguidos → `targetP` sube (ejercicios más fáciles, Bao ofrece pista, el prompt pide simplificar); 5 aciertos seguidos → baja (más reto). `session_target_p` se envía al tutor, así **la conversación y los ejercicios se adaptan con la misma señal**.

### 3.5 Subir de nivel HSK (`evaluateLevel`)

- **Promoción** cuando ≥ 85 % de los ítems del nivel tienen dominio ≥ 0.8 **y** la θ media supera la dificultad del nivel siguiente.
- **Examen de salto** si la θ media supera ese umbral con margen aunque la cobertura sea menor (para quien ya sabe algo de chino).
- Al subir: nuevo vocabulario permitido en el prompt (nueva entrada de caché), nuevas unidades en el camino y celebración de Bao.

---

## 4. Seguridad, coste y privacidad

- La API key del LLM solo existe en el servidor; la app envía un JWT.
- Límite de turnos por usuario/hora en el plan gratuito; el historial enviado se recorta a 12 mensajes.
- Las grabaciones de voz se procesan y se descartan; solo se guardan las puntuaciones.
- El contrato se valida con Zod en el servidor (entrada) y en el cliente (salida).

## 5. Cómo evaluar la calidad del tutor

Antes de cambiar prompts o modelo, conviene un set de evaluación: ~100 turnos reales anonimizados por nivel, puntuados en (a) % de vocabulario dentro de nivel (automático, con `levelGuard`), (b) corrección de las correcciones (revisión por un nativo) y (c) tono empático (rúbrica). Cada cambio de prompt se compara contra ese set.
