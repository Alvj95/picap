import { HSK1_SENTENCES, HSK1_UNITS, HSK1_VOCAB } from '@/data/hsk/hsk1.sample';
import strokes from '@/data/strokes/hsk1.strokes.json';
import type { Content } from './engine/exerciseFactory';

/** Contenido disponible en el dispositivo (en producción: paquete descargable por nivel HSK). */
export const LOCAL_CONTENT: Content = {
  vocab: HSK1_VOCAB,
  sentences: HSK1_SENTENCES,
  strokeChars: new Set(Object.keys(strokes)),
};

export const findNode = (id: string) => HSK1_UNITS.flatMap((u) => u.nodes).find((n) => n.id === id);
