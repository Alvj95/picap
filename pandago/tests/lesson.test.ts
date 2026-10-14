import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HSK1_SENTENCES, HSK1_UNITS, HSK1_VOCAB } from '@/data/hsk/hsk1.sample';
import strokes from '@/data/strokes/hsk1.strokes.json';
import { createLearner, levelDifficulty } from '@/features/learning/adaptive/learnerModel';
import { newSession, planLesson } from '@/features/learning/adaptive/levelEngine';
import { buildLesson, exerciseFromPlan, grade } from '@/features/lesson/engine/exerciseFactory';
import { initLesson, lessonReducer, progressOf, summarize } from '@/features/lesson/engine/lessonReducer';
import { createRng } from '@/features/lesson/engine/random';
import { checkStroke, toScreen, writingScore, type Point, type StrokeData } from '@/features/lesson/engine/strokeMatcher';
import type { GradeResult } from '@/features/lesson/engine/types';

const content = { vocab: HSK1_VOCAB, sentences: HSK1_SENTENCES, strokeChars: new Set(Object.keys(strokes)) };
const STROKES = strokes as unknown as Record<string, StrokeData>;
const right: GradeResult = { correct: true, score: 1, solution: '', observations: [] };
const wrong: GradeResult = { correct: false, score: 0, solution: 'x', observations: [] };

describe('buildLesson', () => {
  const lessons = HSK1_UNITS.flatMap((u) => u.nodes).filter((n) => n.kind === 'lesson');

  it('genera lecciones de 8-12 ejercicios con todos los tipos', () => {
    for (const node of lessons) {
      const ex = buildLesson(node.skillIds, content, createRng(42));
      assert.ok(ex.length >= 8 && ex.length <= 12, `${node.id}: ${ex.length}`);
      const kinds = new Set(ex.map((e) => e.kind));
      for (const k of ['multiple_choice', 'sentence_order', 'match_pairs', 'stroke_writing']) assert.ok(kinds.has(k as never), `${node.id} sin ${k}`);
    }
  });

  it('opciones únicas, solución presente en el banco de fichas', () => {
    for (const node of lessons) {
      for (const e of buildLesson(node.skillIds, content, createRng(7))) {
        if (e.kind === 'multiple_choice') {
          assert.equal(new Set(e.options.map((o) => o.label)).size, 4);
          assert.ok(e.options[e.answerIndex]);
        }
        if (e.kind === 'sentence_order') for (const t of e.solution) assert.ok(e.bank.includes(t));
      }
    }
  });

  it('es determinista con la misma semilla', () => {
    const a = buildLesson(['hsk1-0001', 'hsk1-0004'], content, createRng(9)).map((e) => e.kind);
    const b = buildLesson(['hsk1-0001', 'hsk1-0004'], content, createRng(9)).map((e) => e.kind);
    assert.deepEqual(a, b);
  });
});

describe('grade', () => {
  it('ordenar frase: correcto y crédito parcial', () => {
    const so = buildLesson(['hsk1-0003', 'hsk1-0012', 'hsk1-0020'], content, createRng(3)).find((e) => e.kind === 'sentence_order');
    assert.ok(so && so.kind === 'sentence_order');
    assert.equal(grade(so, { kind: 'order', tokens: so.solution }).correct, true);
    const partial = grade(so, { kind: 'order', tokens: [so.solution[0] ?? ''] });
    assert.equal(partial.correct, false);
    assert.ok(partial.score > 0 && partial.score < 1);
  });
});

describe('lessonReducer', () => {
  const ex = buildLesson(['hsk1-0001', 'hsk1-0004'], content, createRng(1));

  it('un fallo cuesta una vida y re-encola el ejercicio una vez', () => {
    let s = initLesson(ex, 3);
    s = lessonReducer(s, { type: 'graded', result: wrong, costsHeart: true });
    assert.equal(s.hearts, 2);
    assert.equal(s.total, ex.length + 1);
    s = lessonReducer(s, { type: 'continue' });
    while (s.phase === 'answering') s = lessonReducer(lessonReducer(s, { type: 'graded', result: right, costsHeart: true }), { type: 'continue' });
    assert.equal(s.phase, 'complete');
    assert.equal(progressOf(s), 1);
    const sum = summarize(s);
    assert.equal(sum.perfect, false);
    assert.ok(sum.accuracy < 1);
  });

  it('sin vidas → out_of_hearts; recargar vuelve al feedback', () => {
    let s = initLesson(ex, 1);
    s = lessonReducer(lessonReducer(s, { type: 'graded', result: wrong, costsHeart: true }), { type: 'continue' });
    assert.equal(s.phase, 'out_of_hearts');
    s = lessonReducer(s, { type: 'refill', hearts: 5 });
    assert.equal(s.phase, 'feedback');
  });

  it('lección perfecta da bonus', () => {
    let s = initLesson(ex, 5);
    while (s.phase === 'answering') s = lessonReducer(lessonReducer(s, { type: 'graded', result: right, costsHeart: true }), { type: 'continue' });
    const sum = summarize(s);
    assert.equal(sum.perfect, true);
    assert.equal(sum.xp, 10 + ex.length + (ex.length >= 5 ? 3 : 0) + 5);
  });
});

describe('strokeMatcher (datos reales de 你)', () => {
  const ni = STROKES['你'];
  assert.ok(ni);
  const noisy = (m: Point[]): Point[] => toScreen(m).map(([x, y], i) => [x + (i % 2 ? 25 : -25), y + 20]);

  it('acepta cada trazo dibujado con ruido', () => {
    ni.medians.forEach((m, i) => assert.deepEqual(checkStroke(noisy(m), ni, i), { ok: true }, `trazo ${i}`));
  });
  it('rechaza un trazo en sentido contrario', () => {
    assert.equal(checkStroke([...noisy(ni.medians[1] ?? [])].reverse(), ni, 1).ok, false);
  });
  it('distingue error de orden de error de forma', () => {
    assert.deepEqual(checkStroke(noisy(ni.medians[2] ?? []), ni, 0), { ok: false, reason: 'order' });
    assert.deepEqual(checkStroke([[100, 900], [120, 880], [140, 860]], ni, 0), { ok: false, reason: 'shape' });
  });
  it('puntuación de escritura', () => {
    assert.equal(writingScore(7, 0, 0), 1);
    assert.ok(writingScore(7, 2, 1) < 1);
  });
});

describe('repaso adaptativo', () => {
  it('planLesson + exerciseFromPlan produce ejercicios para un alumno nuevo', () => {
    const plan = planLesson(createLearner(1), HSK1_VOCAB, () => levelDifficulty(1), newSession(), 10);
    const ex = plan.map((p) => exerciseFromPlan(p.itemId, p.kind, content, createRng(5))).filter(Boolean);
    assert.ok(ex.length >= 5);
  });
});
