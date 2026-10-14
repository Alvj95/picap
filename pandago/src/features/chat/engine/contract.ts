/**
 * Contrato app ⇄ backend del tutor IA. Lo comparten el cliente (tipos) y el
 * servidor (validación + structured outputs del LLM). Sin dependencias de RN.
 */
import { z } from 'zod';

export const Persona = z.enum(['bao', 'native']);
export type Persona = z.infer<typeof Persona>;

/** Qué se le pide al usuario en el siguiente turno. */
export const NextTask = z.discriminatedUnion('type', [
  z.object({ type: z.literal('open_question') }),
  z.object({
    type: z.literal('fill_gap'),
    /** Frase con "___" donde va el hueco. */
    template_hanzi: z.string(),
    options: z.array(z.string()),
    answer: z.string(),
  }),
  z.object({
    type: z.literal('repeat_aloud'),
    hanzi: z.string(),
    pinyin: z.string(),
  }),
]);
export type NextTask = z.infer<typeof NextTask>;

export const Correction = z.object({
  /** Lo que escribió/dijo el usuario. */
  original: z.string(),
  /** Versión corregida (recast natural, no un "¡mal!"). */
  corrected: z.string(),
  /** Explicación breve en el idioma del usuario. */
  explanation: z.string(),
  /** Etiqueta normalizada para el modelo del estudiante, p.ej. "grammar:measure-word". */
  error_tag: z.string(),
  severity: z.enum(['minor', 'major']),
});
export type Correction = z.infer<typeof Correction>;

/** Respuesta estructurada que devuelve el LLM en cada turno. */
export const TutorTurn = z.object({
  reply: z.object({
    hanzi: z.string(),
    pinyin: z.string(),
    translation: z.string(),
  }),
  corrections: z.array(Correction),
  /** 0..1 — qué tan bien cumplió el usuario la tarea comunicativa del turno. */
  task_score: z.number(),
  bao_mood: z.enum(['happy', 'celebrate', 'encourage', 'talking']),
  /** Pista opcional si el usuario parece atascado. */
  hint: z.string().nullable(),
  next_task: NextTask,
  /** Palabras del usuario usadas correctamente (ids de vocabulario HSK) → refuerzan el SRS. */
  used_item_ids: z.array(z.string()),
  scenario_complete: z.boolean(),
});
export type TutorTurn = z.infer<typeof TutorTurn>;

export const Scenario = z.object({
  id: z.string(),
  title: z.string(),
  /** Objetivo comunicativo: "pedir un té y preguntar el precio". */
  goal: z.string(),
  persona: Persona,
  /** Rol del personaje nativo (camarero, compañero de clase…). */
  role: z.string().optional(),
  target_item_ids: z.array(z.string()),
  max_turns: z.number().int(),
});
export type Scenario = z.infer<typeof Scenario>;

/** Resumen del estudiante que el cliente envía en cada turno (nunca el historial completo del SRS). */
export const LearnerSnapshot = z.object({
  hsk_level: z.number().int().min(1).max(6),
  native_language: z.string(),
  weaknesses: z.array(z.string()),
  /** Ítems ya dominados, para que la IA los reutilice libremente. */
  known_item_ids: z.array(z.string()),
  session_target_p: z.number(),
});
export type LearnerSnapshot = z.infer<typeof LearnerSnapshot>;

export const UserInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), text: z.string() }),
  z.object({ kind: z.literal('gap_choice'), choice: z.string() }),
  /** Transcripción ASR + evaluación de pronunciación ya calculadas en el backend de voz. */
  z.object({ kind: z.literal('voice'), transcript: z.string(), pronunciation_score: z.number() }),
]);
export type UserInput = z.infer<typeof UserInput>;

export const TurnRequest = z.object({
  scenario: Scenario,
  learner: LearnerSnapshot,
  /** Turnos previos como texto plano, ya recortados por el cliente. */
  history: z.array(z.object({ role: z.enum(['user', 'tutor']), text: z.string() })),
  input: UserInput.nullable(), // null = abrir la conversación
});
export type TurnRequest = z.infer<typeof TurnRequest>;
