/**
 * Utilidades de tonos del mandarín, deterministas y sin red.
 * Se usan para (a) calcular los tonos ESPERADOS reales tras sandhi antes de
 * evaluar la pronunciación y (b) colorear las sílabas en la UI.
 */

export type Tone = 1 | 2 | 3 | 4 | 5; // 5 = neutro

/**
 * Aplica las reglas de sandhi tonal a una secuencia de sílabas.
 * - 3 + 3        → 2 + 3        (你好 nǐ hǎo → ní hǎo)
 * - 不 + 4       → bú            (不是 bú shì)
 * - 一 + 4       → yí; 一 + 1/2/3 → yì; 一 al final o en ordinal → yī
 */
export function applySandhi(hanzi: string[], tones: Tone[]): Tone[] {
  const out = [...tones];
  for (let i = 0; i < out.length - 1; i++) {
    const next = tones[i + 1];
    if (hanzi[i] === '不' && next === 4) out[i] = 2;
    else if (hanzi[i] === '一' && next !== undefined && next !== 5) out[i] = next === 4 ? 2 : 4;
  }
  // 3-3 se resuelve de derecha a izquierda para cadenas de terceros tonos (我也很好).
  for (let i = out.length - 2; i >= 0; i--) {
    if (out[i] === 3 && out[i + 1] === 3) out[i] = 2;
  }
  return out;
}

export interface SyllableScore {
  hanzi: string;
  expectedTone: Tone;
  detectedTone: Tone | null;
  /** Goodness of Pronunciation de la sílaba (iniciales/finales), 0..1. */
  gop: number;
  /** Puntuación final 0..1 combinando segmental y tono. */
  score: number;
  verdict: 'great' | 'ok' | 'retry';
}

/**
 * Combina la salida del modelo acústico (GOP por sílaba + tono clasificado desde
 * el contorno F0) con los tonos esperados. Ponderamos el tono al 50%: en
 * mandarín un tono equivocado cambia la palabra (mǎi "comprar" vs mài "vender").
 */
export function scoreSyllables(
  hanzi: string[],
  expected: Tone[],
  detected: { tone: Tone | null; toneConfidence: number; gop: number }[],
): SyllableScore[] {
  return hanzi.map((h, i) => {
    const exp = expected[i] ?? 5;
    const det = detected[i];
    if (!det) return { hanzi: h, expectedTone: exp, detectedTone: null, gop: 0, score: 0, verdict: 'retry' };
    // El tono neutro es corto y átono: no penalizamos su contorno.
    const toneOk = exp === 5 ? 1 : det.tone === exp ? det.toneConfidence : 0;
    const score = 0.5 * det.gop + 0.5 * toneOk;
    return {
      hanzi: h,
      expectedTone: exp,
      detectedTone: det.tone,
      gop: det.gop,
      score,
      verdict: score >= 0.8 ? 'great' : score >= 0.55 ? 'ok' : 'retry',
    };
  });
}

/** Mensaje empático de Bao según el error de tono más frecuente. */
export function toneTip(scores: SyllableScore[]): string | null {
  const wrong = scores.find((s) => s.verdict === 'retry' && s.detectedTone !== null && s.detectedTone !== s.expectedTone);
  if (!wrong) return null;
  const shapes: Record<Tone, string> = {
    1: 'alto y plano, como cantando una nota',
    2: 'subiendo, como cuando preguntas "¿eh?"',
    3: 'bajando y luego subiendo un poco',
    4: 'cayendo fuerte, como una orden',
    5: 'corto y ligero',
  };
  return `Casi 💪 En «${wrong.hanzi}» va el tono ${wrong.expectedTone}: ${shapes[wrong.expectedTone]}.`;
}

const MARKS: Record<string, Tone> = Object.fromEntries(
  [
    ['āēīōūǖ', 1],
    ['áéíóúǘ', 2],
    ['ǎěǐǒǔǚ', 3],
    ['àèìòùǜ', 4],
  ].flatMap(([chars, tone]) => [...(chars as string)].map((ch) => [ch, tone as Tone])),
);

/**
 * Tonos léxicos a partir del pinyin con marcas ("xièxie" → [4, 5]).
 * Cada marca es una sílaba con tono; las sílabas sin marca (neutras) casi
 * siempre van al final de la palabra en HSK 1-3, así que rellenamos con 5.
 */
export function tonesFromPinyin(pinyin: string, syllableCount: number): Tone[] {
  const tones = [...pinyin].map((ch) => MARKS[ch]).filter((t): t is Tone => t !== undefined);
  while (tones.length < syllableCount) tones.push(5);
  return tones.slice(0, syllableCount);
}
