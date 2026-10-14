import type { Dimension } from '@/features/learning/adaptive/learnerModel';

export interface ChoiceOption {
  label: string;
  /** Línea secundaria (pinyin) — solo cuando no delata la respuesta. */
  sub?: string;
}

export type Exercise =
  | {
      kind: 'multiple_choice';
      id: string;
      itemId: string;
      /** hanzi→significado (vocab), significado→hanzi (vocab), audio→hanzi (listening). */
      mode: 'hanzi_to_meaning' | 'meaning_to_hanzi' | 'audio_to_hanzi';
      instruction: string;
      question: string;
      questionSub?: string;
      /** Texto que se lee con TTS (zh-CN). */
      speak?: string;
      options: ChoiceOption[];
      answerIndex: number;
    }
  | {
      kind: 'sentence_order';
      id: string;
      itemIds: string[];
      instruction: string;
      meaning: string;
      pinyin: string;
      solution: string[];
      /** Fichas barajadas (incluye 1-2 distractores). */
      bank: string[];
    }
  | {
      kind: 'match_pairs';
      id: string;
      itemIds: string[];
      instruction: string;
      pairs: { itemId: string; hanzi: string; pinyin: string; meaning: string }[];
      /** Orden barajado de la columna derecha (índices de `pairs`). */
      rightOrder: number[];
    }
  | {
      kind: 'stroke_writing';
      id: string;
      itemId: string;
      instruction: string;
      char: string;
      /** Palabra de la que sale el carácter (puede ser el propio carácter). */
      word: string;
      /** Posición del carácter dentro de `word`. */
      position: number;
      pinyin: string;
      meaning: string;
    };

export type ExerciseKind = Exercise['kind'];

/** Respuesta del usuario, independiente de la UI que la produjo. */
export type Answer =
  | { kind: 'choice'; index: number }
  | { kind: 'order'; tokens: string[] }
  /** Ejercicios que se autocorrigen mientras se hacen (emparejar, trazos): ya traen su puntuación. */
  | { kind: 'self_graded'; score: number };

export interface GradeResult {
  correct: boolean;
  /** 0..1 — crédito parcial para el modelo del estudiante. */
  score: number;
  /** Solución a mostrar si falló. */
  solution: string;
  /** Observaciones para el motor adaptativo (una por ítem practicado). */
  observations: { itemId: string; dimension: Dimension; score: number }[];
}
