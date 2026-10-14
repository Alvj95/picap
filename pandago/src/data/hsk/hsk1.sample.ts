import type { Unit, VocabItem } from './types';

/** Muestra mínima: el corpus completo (HSK 3.0, ~5000 palabras hasta HSK 6) vive en el backend. */
export const HSK1_VOCAB: VocabItem[] = [
  { id: 'hsk1-0001', hanzi: '你好', pinyin: 'nǐ hǎo', tones: [3, 3], meaning: 'hola', level: 1 },
  { id: 'hsk1-0002', hanzi: '谢谢', pinyin: 'xièxie', tones: [4, 5], meaning: 'gracias', level: 1 },
  { id: 'hsk1-0003', hanzi: '我', pinyin: 'wǒ', tones: [3], meaning: 'yo', level: 1 },
  { id: 'hsk1-0004', hanzi: '你', pinyin: 'nǐ', tones: [3], meaning: 'tú', level: 1 },
  { id: 'hsk1-0005', hanzi: '是', pinyin: 'shì', tones: [4], meaning: 'ser', level: 1 },
  { id: 'hsk1-0006', hanzi: '叫', pinyin: 'jiào', tones: [4], meaning: 'llamarse', level: 1 },
  { id: 'hsk1-0007', hanzi: '什么', pinyin: 'shénme', tones: [2, 5], meaning: 'qué', level: 1 },
  { id: 'hsk1-0008', hanzi: '名字', pinyin: 'míngzi', tones: [2, 5], meaning: 'nombre', level: 1 },
  { id: 'hsk1-0009', hanzi: '喝', pinyin: 'hē', tones: [1], meaning: 'beber', level: 1 },
  { id: 'hsk1-0010', hanzi: '茶', pinyin: 'chá', tones: [2], meaning: 'té', level: 1 },
  { id: 'hsk1-0011', hanzi: '他', pinyin: 'tā', tones: [1], meaning: 'él', level: 1 },
  { id: 'hsk1-0012', hanzi: '很', pinyin: 'hěn', tones: [3], meaning: 'muy', level: 1 },
  { id: 'hsk1-0013', hanzi: '不', pinyin: 'bù', tones: [4], meaning: 'no', level: 1 },
  { id: 'hsk1-0014', hanzi: '中国', pinyin: 'Zhōngguó', tones: [1, 2], meaning: 'China', level: 1 },
  { id: 'hsk1-0015', hanzi: '人', pinyin: 'rén', tones: [2], meaning: 'persona', level: 1 },
  { id: 'hsk1-0016', hanzi: '吗', pinyin: 'ma', tones: [5], meaning: '¿…? (partícula)', level: 1 },
  { id: 'hsk1-0017', hanzi: '水', pinyin: 'shuǐ', tones: [3], meaning: 'agua', level: 1 },
  { id: 'hsk1-0018', hanzi: '大', pinyin: 'dà', tones: [4], meaning: 'grande', level: 1 },
  { id: 'hsk1-0019', hanzi: '小', pinyin: 'xiǎo', tones: [3], meaning: 'pequeño', level: 1 },
  { id: 'hsk1-0020', hanzi: '好', pinyin: 'hǎo', tones: [3], meaning: 'bien, bueno', level: 1 },
];

export interface SampleSentence {
  id: string;
  /** Fichas en el orden correcto. */
  tokens: string[];
  pinyin: string;
  meaning: string;
  /** Vocabulario que practica (para el modelo del estudiante). */
  itemIds: string[];
}

/** Frases para "ordenar la frase". En producción salen del corpus etiquetado por patrón gramatical. */
export const HSK1_SENTENCES: SampleSentence[] = [
  { id: 's1', tokens: ['你', '叫', '什么', '名字'], pinyin: 'Nǐ jiào shénme míngzi?', meaning: '¿Cómo te llamas?', itemIds: ['hsk1-0004', 'hsk1-0006', 'hsk1-0007', 'hsk1-0008'] },
  { id: 's2', tokens: ['我', '是', '中国', '人'], pinyin: 'Wǒ shì Zhōngguó rén.', meaning: 'Soy chino/a.', itemIds: ['hsk1-0003', 'hsk1-0005', 'hsk1-0014', 'hsk1-0015'] },
  { id: 's3', tokens: ['我', '很', '好'], pinyin: 'Wǒ hěn hǎo.', meaning: 'Estoy muy bien.', itemIds: ['hsk1-0003', 'hsk1-0012', 'hsk1-0020'] },
  { id: 's4', tokens: ['他', '不', '喝', '茶'], pinyin: 'Tā bù hē chá.', meaning: 'Él no bebe té.', itemIds: ['hsk1-0011', 'hsk1-0013', 'hsk1-0009', 'hsk1-0010'] },
  { id: 's5', tokens: ['你', '喝', '水', '吗'], pinyin: 'Nǐ hē shuǐ ma?', meaning: '¿Bebes agua?', itemIds: ['hsk1-0004', 'hsk1-0009', 'hsk1-0017', 'hsk1-0016'] },
];

export const HSK1_UNITS: Unit[] = [
  {
    id: 'hsk1-u1',
    level: 1,
    index: 1,
    title: 'Saludos',
    description: 'Di hola, gracias y preséntate',
    color: 'primary',
    nodes: [
      { id: 'u1-l1', title: '你好', icon: '👋', kind: 'lesson', skillIds: ['hsk1-0001', 'hsk1-0004'] },
      { id: 'u1-l2', title: '谢谢', icon: '🙏', kind: 'lesson', skillIds: ['hsk1-0002', 'hsk1-0012', 'hsk1-0020'] },
      { id: 'u1-c1', title: 'Cofre', icon: '🎁', kind: 'chest', skillIds: [] },
      { id: 'u1-l3', title: '我叫…', icon: '🪪', kind: 'lesson', skillIds: ['hsk1-0003', 'hsk1-0006', 'hsk1-0007', 'hsk1-0008'] },
      { id: 'u1-ai', title: 'Charla con Bao', icon: '💬', kind: 'conversation', skillIds: ['hsk1-0001', 'hsk1-0006', 'hsk1-0008'] },
      { id: 'u1-boss', title: 'Desafío', icon: '🏆', kind: 'boss', skillIds: [] },
    ],
  },
  {
    id: 'hsk1-u2',
    level: 1,
    index: 2,
    title: 'En la casa de té',
    description: 'Pide bebidas y sé educado',
    color: 'success',
    nodes: [
      { id: 'u2-l1', title: '喝茶', icon: '🍵', kind: 'lesson', skillIds: ['hsk1-0009', 'hsk1-0010', 'hsk1-0017', 'hsk1-0011', 'hsk1-0013'] },
      { id: 'u2-ai', title: 'Pedir té', icon: '💬', kind: 'conversation', skillIds: ['hsk1-0009', 'hsk1-0010', 'hsk1-0002'] },
      { id: 'u2-c1', title: 'Cofre', icon: '🎁', kind: 'chest', skillIds: [] },
    ],
  },
];
