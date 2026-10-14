/**
 * Máquina de estados de una lección (estilo Duolingo):
 *   answering ──check──► feedback ──continue──► answering … ──► complete
 *                                  └─(sin vidas)──► out_of_hearts ──refill──► feedback
 * Los ejercicios fallados se re-encolan al final UNA vez, para cerrar la
 * lección habiendo acertado (aprendizaje por recuperación).
 */
import type { Exercise, GradeResult } from './types';

export interface LessonState {
  queue: Exercise[];
  index: number;
  /** Total para la barra de progreso (crece si se re-encolan fallos). */
  total: number;
  phase: 'answering' | 'feedback' | 'out_of_hearts' | 'complete';
  hearts: number;
  last: GradeResult | null;
  firstTryCorrect: number;
  answered: number;
  combo: number;
  bestCombo: number;
  retried: Set<string>;
  startedAt: number;
}

export type LessonAction =
  | { type: 'graded'; result: GradeResult; costsHeart: boolean }
  | { type: 'continue' }
  | { type: 'refill'; hearts: number };

export function initLesson(exercises: Exercise[], hearts: number, now = Date.now()): LessonState {
  return {
    queue: exercises, index: 0, total: exercises.length, phase: exercises.length ? 'answering' : 'complete',
    hearts, last: null, firstTryCorrect: 0, answered: 0, combo: 0, bestCombo: 0, retried: new Set(), startedAt: now,
  };
}

export function lessonReducer(state: LessonState, action: LessonAction): LessonState {
  switch (action.type) {
    case 'graded': {
      const ex = state.queue[state.index];
      if (!ex || state.phase !== 'answering') return state;
      const { result } = action;
      const isRetry = state.retried.has(ex.id);
      let { queue, total, retried, hearts } = state;
      if (!result.correct && !isRetry) {
        queue = [...queue, ex];
        total += 1;
        retried = new Set(retried).add(ex.id);
      }
      if (!result.correct && action.costsHeart) hearts = Math.max(0, hearts - 1);
      const combo = result.correct ? state.combo + 1 : 0;
      return {
        ...state, queue, total, retried, hearts, combo,
        bestCombo: Math.max(state.bestCombo, combo),
        last: result,
        answered: state.answered + 1,
        firstTryCorrect: state.firstTryCorrect + (result.correct && !isRetry ? 1 : 0),
        phase: 'feedback',
      };
    }
    case 'continue': {
      if (state.phase !== 'feedback') return state;
      if (state.hearts === 0) return { ...state, phase: 'out_of_hearts' };
      const index = state.index + 1;
      return { ...state, index, last: null, phase: index >= state.queue.length ? 'complete' : 'answering' };
    }
    case 'refill':
      // Si se quedó sin vidas tras fallar, vuelve al banner de ese fallo; si empezó sin vidas, a responder.
      return { ...state, hearts: action.hearts, phase: state.last ? 'feedback' : 'answering' };
  }
}

/** Progreso visible 0..1: ejercicios superados sobre el total (incluidos reintentos). */
export function progressOf(s: LessonState) {
  const done = s.index + (s.phase === 'feedback' && s.last?.correct ? 1 : 0);
  return s.total ? done / s.total : 1;
}

export interface LessonSummary {
  xp: number;
  accuracy: number;
  seconds: number;
  perfect: boolean;
  bestCombo: number;
}

/** XP: 10 base + 1 por acierto a la primera + bonus por combo y lección perfecta. */
export function summarize(s: LessonState, now = Date.now()): LessonSummary {
  const unique = s.total - s.retried.size;
  const accuracy = unique ? s.firstTryCorrect / unique : 1;
  const perfect = s.retried.size === 0;
  const xp = 10 + s.firstTryCorrect + (s.bestCombo >= 5 ? 3 : 0) + (perfect ? 5 : 0);
  return { xp, accuracy, seconds: Math.round((now - s.startedAt) / 1000), perfect, bestCombo: s.bestCombo };
}
