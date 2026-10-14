/**
 * Modelo del estudiante — "Elo por habilidad".
 *
 * Cada ítem (palabra, patrón gramatical, sílaba con tono) tiene una dificultad `b`
 * y el usuario una habilidad `θ` por DIMENSIÓN. La probabilidad de acierto es
 *   P(correcto) = σ(θ − b)
 * y tras cada respuesta ambos se actualizan (el servidor agrega las `b` de todos
 * los usuarios; el cliente solo ajusta su `θ` y su dominio por ítem).
 *
 * Es el mismo modelo que usan Duolingo (Half-Life Regression + Elo) y Lingvist,
 * barato de calcular en el dispositivo y fácil de explicar.
 */
import type { HskLevel } from '@/data/hsk/types';

export type Dimension = 'vocab' | 'grammar' | 'listening' | 'tones' | 'writing' | 'speaking';
export const DIMENSIONS: Dimension[] = ['vocab', 'grammar', 'listening', 'tones', 'writing', 'speaking'];

export interface ItemState {
  /** Probabilidad estimada de que el usuario recuerde/produzca el ítem (0..1). */
  mastery: number;
  attempts: number;
  lastSeen: number;
  /** Para el SRS. */
  stability: number;
}

export interface LearnerModel {
  level: HskLevel;
  theta: Record<Dimension, number>;
  items: Record<string, ItemState>;
  /** Patrones de error recurrentes detectados por la IA, p.ej. "tone:3-3-sandhi", "grammar:了". */
  errorTags: Record<string, number>;
}

export interface Observation {
  itemId: string;
  dimension: Dimension;
  /** 0..1 — permite crédito parcial (p.ej. 2 de 3 tonos correctos). */
  score: number;
  /** Dificultad del ítem conocida por el servidor. */
  difficulty: number;
  /** Se usó pista de Bao → la señal vale menos. */
  hinted?: boolean;
  errorTags?: string[];
  at?: number;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function pCorrect(theta: number, difficulty: number) {
  return sigmoid(theta - difficulty);
}

/** K decreciente: el modelo se mueve rápido al principio y se estabiliza después. */
const kFactor = (attempts: number) => 0.4 / (1 + attempts * 0.05);

export function createLearner(level: HskLevel = 1): LearnerModel {
  // θ inicial = dificultad media del nivel, para que P≈0.5 en el primer ítem del nivel.
  const base = levelDifficulty(level);
  return {
    level,
    theta: Object.fromEntries(DIMENSIONS.map((d) => [d, base])) as Record<Dimension, number>,
    items: {},
    errorTags: {},
  };
}

/** Escala de dificultad: HSK1 ≈ −2, HSK6 ≈ +3 (unidad logit). */
export function levelDifficulty(level: HskLevel) {
  return -2 + (level - 1);
}

export function observe(model: LearnerModel, o: Observation): LearnerModel {
  const now = o.at ?? Date.now();
  const prev = model.items[o.itemId] ?? { mastery: 0.3, attempts: 0, lastSeen: now, stability: 1 };
  const expected = pCorrect(model.theta[o.dimension], o.difficulty);
  const weight = o.hinted ? 0.5 : 1;
  const surprise = (o.score - expected) * weight;

  const theta = { ...model.theta, [o.dimension]: model.theta[o.dimension] + kFactor(prev.attempts) * surprise };

  // Dominio del ítem: media móvil exponencial; con pista, la respuesta cuenta la mitad.
  const mastery = prev.mastery + 0.4 * weight * (o.score - prev.mastery);

  const errorTags = { ...model.errorTags };
  for (const tag of o.errorTags ?? []) errorTags[tag] = (errorTags[tag] ?? 0) + 1;
  // Los aciertos "curan" lentamente los patrones de error relacionados con la dimensión.
  if (o.score > 0.8) {
    for (const tag of Object.keys(errorTags)) {
      if (tag.startsWith(`${o.dimension}:`)) errorTags[tag] = Math.max(0, (errorTags[tag] ?? 0) - 0.25);
    }
  }

  return {
    ...model,
    theta,
    errorTags,
    items: {
      ...model.items,
      [o.itemId]: {
        mastery,
        attempts: prev.attempts + 1,
        lastSeen: now,
        stability: o.score >= 0.6 ? prev.stability * (1.8 + o.score) : Math.max(0.5, prev.stability * 0.5),
      },
    },
  };
}

/** Los N patrones de error más frecuentes; se inyectan al prompt del tutor IA. */
export function topWeaknesses(model: LearnerModel, n = 3): string[] {
  return Object.entries(model.errorTags)
    .filter(([, count]) => count >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([tag]) => tag);
}
