/**
 * Generador de ejercicios a partir del contenido HSK. Puro y determinista
 * (recibe un RNG), así que se prueba sin UI.
 */
import type { SampleSentence } from '@/data/hsk/hsk1.sample';
import type { ExerciseKind as PlannedKind, VocabItem } from '@/data/hsk/types';
import { sample, shuffle, type Rng } from './random';
import type { Answer, Exercise, GradeResult } from './types';

export interface Content {
  vocab: VocabItem[];
  sentences: SampleSentence[];
  /** Caracteres con datos de orden de trazos disponibles. */
  strokeChars: Set<string>;
}

let counter = 0;
const nextId = (kind: string) => `${kind}-${(counter++).toString(36)}`;

function distractors(item: VocabItem, pool: VocabItem[], n: number, rng: Rng): VocabItem[] {
  // Preferimos distractores de la misma longitud (en hanzi) para que no se adivine por la forma.
  const others = pool.filter((v) => v.id !== item.id && v.meaning !== item.meaning);
  const sameLength = others.filter((v) => v.hanzi.length === item.hanzi.length);
  const picked = sample(sameLength, n, rng);
  return picked.length >= n ? picked : [...picked, ...sample(others.filter((v) => !picked.includes(v)), n - picked.length, rng)];
}

export function multipleChoice(item: VocabItem, mode: Extract<Exercise, { kind: 'multiple_choice' }>['mode'], content: Content, rng: Rng): Exercise {
  const options = shuffle([item, ...distractors(item, content.vocab, 3, rng)], rng);
  const answerIndex = options.indexOf(item);
  switch (mode) {
    case 'hanzi_to_meaning':
      return {
        kind: 'multiple_choice', id: nextId('mc'), itemId: item.id, mode,
        instruction: '¿Qué significa?', question: item.hanzi, questionSub: item.pinyin, speak: item.hanzi,
        options: options.map((o) => ({ label: o.meaning })), answerIndex,
      };
    case 'meaning_to_hanzi':
      return {
        kind: 'multiple_choice', id: nextId('mc'), itemId: item.id, mode,
        instruction: '¿Cómo se dice en chino?', question: `«${item.meaning}»`,
        options: options.map((o) => ({ label: o.hanzi, sub: o.pinyin })), answerIndex,
      };
    case 'audio_to_hanzi':
      return {
        kind: 'multiple_choice', id: nextId('mc'), itemId: item.id, mode,
        instruction: 'Escucha y elige lo que oyes', question: '🔊', speak: item.hanzi,
        // Sin pinyin: el ejercicio entrena el oído, no la lectura.
        options: options.map((o) => ({ label: o.hanzi })), answerIndex,
      };
  }
}

export function sentenceOrder(sentence: SampleSentence, content: Content, rng: Rng): Exercise {
  const extra = sample(
    content.vocab.filter((v) => !sentence.tokens.includes(v.hanzi)),
    sentence.tokens.length > 3 ? 2 : 1,
    rng,
  ).map((v) => v.hanzi);
  return {
    kind: 'sentence_order', id: nextId('so'), itemIds: sentence.itemIds,
    instruction: 'Traduce esta frase', meaning: sentence.meaning, pinyin: sentence.pinyin,
    solution: sentence.tokens, bank: shuffle([...sentence.tokens, ...extra], rng),
  };
}

export function matchPairs(items: VocabItem[], rng: Rng): Exercise {
  const pairs = items.slice(0, 5).map((v) => ({ itemId: v.id, hanzi: v.hanzi, pinyin: v.pinyin, meaning: v.meaning }));
  return {
    kind: 'match_pairs', id: nextId('mp'), itemIds: pairs.map((p) => p.itemId),
    instruction: 'Empareja las parejas', pairs, rightOrder: shuffle(pairs.map((_, i) => i), rng),
  };
}

export function strokeWriting(item: VocabItem, char: string): Exercise {
  return {
    kind: 'stroke_writing', id: nextId('sw'), itemId: item.id,
    instruction: 'Escribe el carácter', char, word: item.hanzi, position: [...item.hanzi].indexOf(char), pinyin: item.pinyin, meaning: item.meaning,
  };
}

/**
 * Lección de un nodo del camino (~10 ejercicios). Progresión pedagógica:
 * reconocer (hanzi→significado) → recordar (significado→hanzi) → oír →
 * producir (ordenar frases, escribir) → consolidar (emparejar).
 */
export function buildLesson(skillIds: string[], content: Content, rng: Rng): Exercise[] {
  const items = skillIds.map((id) => content.vocab.find((v) => v.id === id)).filter((v): v is VocabItem => !!v);
  if (!items.length) return [];
  const out: Exercise[] = [];

  // Topes por tipo para que la lección quepa en ~11 ejercicios sin perder variedad.
  for (const item of items.slice(0, 4)) out.push(multipleChoice(item, 'hanzi_to_meaning', content, rng));
  for (const item of sample(items, 3, rng)) out.push(multipleChoice(item, rng() < 0.5 ? 'meaning_to_hanzi' : 'audio_to_hanzi', content, rng));

  const sentences = content.sentences.filter((s) => s.itemIds.some((id) => skillIds.includes(id)));
  for (const s of sample(sentences, 2, rng)) out.push(sentenceOrder(s, content, rng));

  const writable = items.flatMap((v) => [...v.hanzi].filter((ch) => content.strokeChars.has(ch)).map((ch) => ({ v, ch })));
  for (const { v, ch } of sample(writable, 1, rng)) out.push(strokeWriting(v, ch));

  // Emparejar necesita ≥3 parejas: completamos con vocabulario ya visto del nivel.
  const matchItems = items.length >= 3 ? items : [...items, ...sample(content.vocab.filter((v) => !items.includes(v)), 3 - items.length, rng)];
  out.push(matchPairs(shuffle(matchItems, rng), rng));

  return out;
}

/** Convierte un plan del motor adaptativo (levelEngine.planLesson) en ejercicios concretos. */
export function exerciseFromPlan(itemId: string, kind: PlannedKind, content: Content, rng: Rng): Exercise | null {
  const item = content.vocab.find((v) => v.id === itemId);
  if (!item) return null;
  switch (kind) {
    case 'multiple_choice':
      return multipleChoice(item, rng() < 0.5 ? 'hanzi_to_meaning' : 'audio_to_hanzi', content, rng);
    case 'sentence_order': {
      const s = content.sentences.find((x) => x.itemIds.includes(itemId));
      return s ? sentenceOrder(s, content, rng) : multipleChoice(item, 'meaning_to_hanzi', content, rng);
    }
    case 'match_pairs':
      return matchPairs([item, ...distractors(item, content.vocab, 3, rng)], rng);
    case 'stroke_writing': {
      const ch = [...item.hanzi].find((c) => content.strokeChars.has(c));
      return ch ? strokeWriting(item, ch) : multipleChoice(item, 'meaning_to_hanzi', content, rng);
    }
    case 'ai_conversation':
      // En un repaso sin red, lo más cercano a "hablar" es entrenar el oído.
      return multipleChoice(item, 'audio_to_hanzi', content, rng);
  }
}

const sameTokens = (a: string[], b: string[]) => a.length === b.length && a.every((t, i) => t === b[i]);

export function grade(ex: Exercise, answer: Answer): GradeResult {
  switch (ex.kind) {
    case 'multiple_choice': {
      const correct = answer.kind === 'choice' && answer.index === ex.answerIndex;
      const sol = ex.options[ex.answerIndex];
      return {
        correct,
        score: correct ? 1 : 0,
        solution: sol ? `${sol.label}${sol.sub ? ` (${sol.sub})` : ''}` : '',
        observations: [{ itemId: ex.itemId, dimension: ex.mode === 'audio_to_hanzi' ? 'listening' : 'vocab', score: correct ? 1 : 0 }],
      };
    }
    case 'sentence_order': {
      const tokens = answer.kind === 'order' ? answer.tokens : [];
      const correct = sameTokens(tokens, ex.solution);
      // Crédito parcial por posiciones correctas: distingue "casi" de "ni idea".
      const positional = ex.solution.filter((t, i) => tokens[i] === t).length / ex.solution.length;
      return {
        correct,
        score: correct ? 1 : positional * 0.6,
        solution: ex.solution.join(''),
        observations: ex.itemIds.map((itemId) => ({ itemId, dimension: 'grammar' as const, score: correct ? 1 : positional * 0.6 })),
      };
    }
    case 'match_pairs':
    case 'stroke_writing': {
      const score = answer.kind === 'self_graded' ? answer.score : 0;
      const ids = ex.kind === 'match_pairs' ? ex.itemIds : [ex.itemId];
      return {
        correct: score >= 0.6,
        score,
        solution: ex.kind === 'stroke_writing' ? ex.char : '',
        observations: ids.map((itemId) => ({ itemId, dimension: ex.kind === 'match_pairs' ? ('vocab' as const) : ('writing' as const), score })),
      };
    }
  }
}
