export type HskLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type ExerciseKind =
  | 'multiple_choice' // elegir significado / pinyin / audio
  | 'sentence_order' // ordenar fichas para formar la frase
  | 'match_pairs' // emparejar hanzi ↔ pinyin ↔ significado
  | 'stroke_writing' // trazar el carácter siguiendo el orden de trazos
  | 'ai_conversation'; // diálogo con Bao / nativo IA

export interface VocabItem {
  id: string; // "hsk1-0042"
  hanzi: string;
  pinyin: string; // con marcas de tono: "nǐ hǎo"
  tones: number[]; // [3, 3] — 5 = tono neutro
  meaning: string;
  level: HskLevel;
  /** Ids de gramática / palabras que conviene conocer antes. */
  prereqs?: string[];
}

export interface LessonNode {
  id: string;
  title: string;
  icon: string;
  kind: 'lesson' | 'chest' | 'conversation' | 'boss';
  /** Ítems de vocabulario/gramática que la lección introduce o repasa. */
  skillIds: string[];
}

export interface Unit {
  id: string;
  level: HskLevel;
  index: number;
  title: string;
  description: string;
  color: 'primary' | 'success' | 'info' | 'league';
  nodes: LessonNode[];
}
