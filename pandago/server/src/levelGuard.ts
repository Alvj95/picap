/**
 * Guardián de nivel: comprobación determinista tras la respuesta del LLM.
 * Si la respuesta usa demasiados caracteres fuera del nivel, se pide una
 * reescritura (una sola vez) en lugar de confiar ciegamente en el prompt.
 */
import { charsUpToLevel } from './vocab.ts';

const HANZI = /\p{Script=Han}/u;
const PUNCT_OK = new Set(['吗', '呢', '吧', '啊', '的', '了']); // partículas siempre permitidas

export function outOfLevelRatio(text: string, level: number): { ratio: number; unknown: string[] } {
  const known = charsUpToLevel(level);
  const hanzi = [...text].filter((ch) => HANZI.test(ch));
  if (!hanzi.length) return { ratio: 0, unknown: [] };
  const unknown = hanzi.filter((ch) => !known.has(ch) && !PUNCT_OK.has(ch));
  return { ratio: unknown.length / hanzi.length, unknown: [...new Set(unknown)] };
}

/** Umbral: con el corpus completo, ~15% permite la "+1" del input comprensible. */
export const MAX_OUT_OF_LEVEL = 0.15;
