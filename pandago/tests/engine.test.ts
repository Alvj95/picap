import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applySandhi, scoreSyllables, tonesFromPinyin, toneTip } from '@/features/chat/engine/tones';
import { chatReducer, checkGapLocally, initChat, xpForTurn } from '@/features/chat/engine/orchestrator';
import type { TutorTurn } from '@/features/chat/engine/contract';
import { createLearner, observe, topWeaknesses } from '@/features/learning/adaptive/learnerModel';
import { evaluateLevel, newSession, updateSession } from '@/features/learning/adaptive/levelEngine';
import { buildLeaderboard, GROUP_SIZE, zoneOf } from '@/features/leagues/leaderboard';
import { FREE_TALK } from '@/features/chat/scenarios';

describe('tonos', () => {
  it('sandhi 3-3, 不 y 一', () => {
    assert.deepEqual(applySandhi(['你', '好'], [3, 3]), [2, 3]);
    assert.deepEqual(applySandhi([...'我也很好'], [3, 3, 3, 3]), [2, 3, 2, 3]);
    assert.deepEqual(applySandhi([...'不是'], [4, 4]), [2, 4]);
    assert.deepEqual(applySandhi([...'一个'], [1, 4]), [2, 4]);
    assert.deepEqual(applySandhi([...'一天'], [1, 1]), [4, 1]);
  });
  it('tonos desde pinyin con neutros', () => {
    assert.deepEqual(tonesFromPinyin('xièxie', 2), [4, 5]);
    assert.deepEqual(tonesFromPinyin('nǐ hǎo', 2), [3, 3]);
  });
  it('un tono equivocado se marca para repetir y Bao da un consejo', () => {
    const s = scoreSyllables([...'你好'], [2, 3], [
      { tone: 3, toneConfidence: 0.9, gop: 0.8 },
      { tone: 3, toneConfidence: 0.9, gop: 0.9 },
    ]);
    assert.deepEqual(s.map((x) => x.verdict), ['retry', 'great']);
    assert.match(toneTip(s) ?? '', /tono 2/);
  });
});

describe('modelo del estudiante', () => {
  it('los aciertos suben θ y los errores quedan etiquetados', () => {
    let m = createLearner(1);
    const before = m.theta.vocab;
    for (let i = 0; i < 5; i++) m = observe(m, { itemId: 'a', dimension: 'vocab', score: 1, difficulty: -2 });
    m = observe(m, { itemId: 'b', dimension: 'tones', score: 0, difficulty: -2, errorTags: ['tones:3-3-sandhi'] });
    assert.ok(m.theta.vocab > before);
    assert.deepEqual(topWeaknesses(m), ['tones:3-3-sandhi']);
    assert.deepEqual(evaluateLevel(m, ['a']), { action: 'stay' });
  });
  it('3 fallos seguidos facilitan la sesión', () => {
    let s = newSession();
    for (let i = 0; i < 3; i++) s = updateSession(s, false);
    assert.ok(s.targetP > 0.8);
  });
});

describe('orquestador del chat', () => {
  const turn = (over: Partial<TutorTurn> = {}): TutorTurn => ({
    reply: { hanzi: '你好', pinyin: 'nǐ hǎo', translation: 'hola' },
    corrections: [], task_score: 1, bao_mood: 'happy', hint: null,
    next_task: { type: 'open_question' }, used_item_ids: [], scenario_complete: false, ...over,
  });
  it('flujo básico y XP', () => {
    let s = chatReducer(initChat(FREE_TALK), { type: 'start' });
    assert.equal(s.phase, 'tutor_typing');
    s = chatReducer(s, { type: 'tutor_reply', turn: turn() });
    assert.equal(s.phase, 'await_user');
    assert.equal(s.xpEarned, 0); // el saludo inicial no da XP
    s = chatReducer(s, { type: 'submit', input: { kind: 'text', text: '你好' }, display: '你好' });
    s = chatReducer(s, { type: 'tutor_reply', turn: turn({ task_score: 0.6 }) });
    assert.equal(s.xpEarned, xpForTurn(turn({ task_score: 0.6 })));
    s = chatReducer(s, { type: 'tutor_reply', turn: turn({ scenario_complete: true }) });
    assert.equal(s.phase, 'finished');
    assert.equal(s.mood, 'celebrate');
  });
  it('corrección local de huecos', () => {
    const task = { type: 'fill_gap' as const, template_hanzi: '你叫___名字？', options: ['什么', '谢谢'], answer: '什么' };
    assert.equal(checkGapLocally(task, '什么'), true);
    assert.equal(checkGapLocally(task, '谢谢'), false);
  });
});

describe('ligas', () => {
  it('clasificación determinista con el usuario incluido y zonas', () => {
    const now = Date.UTC(2026, 9, 14, 12);
    const a = buildLeaderboard('Jade', 150, now);
    assert.equal(a.length, GROUP_SIZE);
    assert.deepEqual(a, buildLeaderboard('Jade', 150, now));
    assert.ok(a.some((e) => e.isMe));
    assert.equal(zoneOf(1, 'Jade'), 'promote');
    assert.equal(zoneOf(GROUP_SIZE, 'Jade'), 'demote');
    assert.equal(zoneOf(GROUP_SIZE, 'Bambú'), 'safe');
    assert.equal(zoneOf(1, 'Emperador'), 'safe');
  });
});
