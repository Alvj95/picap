import { HSK1_VOCAB } from '../../src/data/hsk/hsk1.sample.ts';
import type { VocabItem } from '../../src/data/hsk/types.ts';

/** En producción: tabla `vocab` en Postgres con las ~5000 palabras de HSK 1-6. */
const ALL: VocabItem[] = [...HSK1_VOCAB];

export function vocabForLevel(level: number): VocabItem[] {
  return ALL.filter((v) => v.level <= level);
}

/** Conjunto de caracteres "conocidos" hasta un nivel, para el guardián de nivel. */
export function charsUpToLevel(level: number): Set<string> {
  return new Set(vocabForLevel(level).flatMap((v) => [...v.hanzi]));
}
