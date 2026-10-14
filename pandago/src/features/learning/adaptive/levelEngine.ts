/**
 * Motor de adaptación HSK.
 *
 * 1. SELECCIÓN DE EJERCICIOS — "zona de desarrollo próximo": se eligen ítems cuya
 *    P(acierto) esté cerca de 0.80 (suficiente éxito para motivar, suficiente
 *    reto para aprender). Mezcla: 60% nuevo del nivel, 30% repaso SRS, 10% un
 *    "estiramiento" del nivel siguiente.
 * 2. DIFICULTAD DINÁMICA EN SESIÓN — tras 3 fallos seguidos se baja el objetivo
 *    (y Bao ofrece pista); tras 5 aciertos seguidos se sube.
 * 3. PROMOCIÓN/DESCENSO DE NIVEL — se promociona cuando la cobertura del nivel
 *    (ítems con dominio ≥ 0.8) supera el 85% Y la θ media pasa el umbral del
 *    nivel siguiente; se ofrece un "examen de salto" para avanzar antes.
 */
import type { ExerciseKind, HskLevel, VocabItem } from '@/data/hsk/types';
import { DIMENSIONS, levelDifficulty, pCorrect, type Dimension, type LearnerModel } from './learnerModel';
import { dueItems } from './srs';

export interface SessionState {
  streak: number; // positivos = aciertos seguidos, negativos = fallos seguidos
  targetP: number;
}

export const newSession = (): SessionState => ({ streak: 0, targetP: 0.8 });

export function updateSession(s: SessionState, correct: boolean): SessionState {
  const streak = correct ? Math.max(1, s.streak + 1) : Math.min(-1, s.streak - 1);
  let targetP = s.targetP;
  if (streak <= -3) targetP = Math.min(0.92, targetP + 0.05); // más fácil
  if (streak >= 5) targetP = Math.max(0.65, targetP - 0.05); // más difícil
  return { streak, targetP };
}

/** Qué tipo de ejercicio entrena mejor cada dimensión débil. */
const EXERCISE_FOR: Record<Dimension, ExerciseKind[]> = {
  vocab: ['multiple_choice', 'match_pairs'],
  grammar: ['sentence_order'],
  listening: ['multiple_choice'],
  tones: ['multiple_choice', 'ai_conversation'],
  writing: ['stroke_writing'],
  speaking: ['ai_conversation'],
};

export interface PlannedExercise {
  itemId: string;
  kind: ExerciseKind;
  dimension: Dimension;
  reason: 'new' | 'review' | 'stretch';
}

export function planLesson(
  model: LearnerModel,
  pool: VocabItem[],
  difficultyOf: (id: string) => number,
  session: SessionState,
  size = 12,
): PlannedExercise[] {
  const weakest = [...DIMENSIONS].sort((a, b) => model.theta[a] - model.theta[b]);
  const pickDim = (i: number): Dimension => weakest[i % 3] ?? 'vocab'; // rota entre las 3 más débiles

  const score = (item: VocabItem, dim: Dimension) => Math.abs(pCorrect(model.theta[dim], difficultyOf(item.id)) - session.targetP);

  const atLevel = pool.filter((v) => v.level === model.level && !model.items[v.id]);
  const stretch = pool.filter((v) => v.level === model.level + 1);
  const review = dueItems(model).map((id) => pool.find((v) => v.id === id)).filter((v): v is VocabItem => !!v);

  const nNew = Math.round(size * 0.6);
  const nReview = Math.round(size * 0.3);
  const plan: PlannedExercise[] = [];

  const take = (items: VocabItem[], n: number, reason: PlannedExercise['reason']) => {
    for (let i = 0; i < n; i++) {
      const dim = pickDim(plan.length);
      const best = [...items].sort((a, b) => score(a, dim) - score(b, dim)).find((v) => !plan.some((p) => p.itemId === v.id));
      if (!best) return;
      const kinds = EXERCISE_FOR[dim];
      plan.push({ itemId: best.id, dimension: dim, reason, kind: kinds[plan.length % kinds.length] ?? 'multiple_choice' });
    }
  };

  take(review, nReview, 'review');
  take(atLevel, nNew, 'new');
  take(stretch, size - plan.length, 'stretch');

  // Intercalado (interleaving): no agrupar repasos al principio.
  return plan.sort((a, b) => (a.itemId < b.itemId ? -1 : 1));
}

export type LevelDecision = { action: 'stay' } | { action: 'promote'; to: HskLevel } | { action: 'offer_jump_test'; to: HskLevel };

export function evaluateLevel(model: LearnerModel, levelItemIds: string[]): LevelDecision {
  if (model.level === 6) return { action: 'stay' };
  const next = (model.level + 1) as HskLevel;
  const mastered = levelItemIds.filter((id) => (model.items[id]?.mastery ?? 0) >= 0.8).length;
  const coverage = levelItemIds.length ? mastered / levelItemIds.length : 0;
  const meanTheta = DIMENSIONS.reduce((sum, d) => sum + model.theta[d], 0) / DIMENSIONS.length;
  const threshold = levelDifficulty(next);

  if (coverage >= 0.85 && meanTheta >= threshold) return { action: 'promote', to: next };
  if (meanTheta >= threshold + 0.5) return { action: 'offer_jump_test', to: next };
  return { action: 'stay' };
}
