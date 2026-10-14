import { HSK1_UNITS } from '@/data/hsk/hsk1.sample';
import type { Scenario } from './engine/contract';

/** Escenario libre con Bao (también se abre desde la Home sin nodo concreto). */
export const FREE_TALK: Scenario = {
  id: 'free-bao',
  title: 'Charla con Bao',
  goal: 'Preséntate y pregunta su nombre a Bao',
  persona: 'bao',
  target_item_ids: ['hsk1-0001', 'hsk1-0006', 'hsk1-0007', 'hsk1-0008'],
  max_turns: 8,
};

/** Detalles de los escenarios ligados a nodos del camino. En producción vienen del CMS. */
const DETAILS: Record<string, Pick<Scenario, 'goal' | 'persona' | 'role'>> = {
  'u1-ai': { goal: FREE_TALK.goal, persona: 'bao' },
  'u2-ai': { goal: 'Pide un té en la casa de té y da las gracias', persona: 'native', role: 'camarero de una casa de té en Pekín' },
};

/** Práctica de pronunciación: Bao propone frases y pide repetirlas (repeat_aloud). */
export const PRONUNCIATION_DRILL: Scenario = {
  id: 'voice-drill',
  title: 'Taller de tonos',
  goal: 'Repite en voz alta las frases de Bao cuidando los tonos',
  persona: 'bao',
  target_item_ids: ['hsk1-0001', 'hsk1-0002', 'hsk1-0012', 'hsk1-0017'],
  max_turns: 6,
};

export function scenarioForNode(nodeId: string | undefined): Scenario {
  const node = HSK1_UNITS.flatMap((u) => u.nodes).find((n) => n.id === nodeId);
  const details = nodeId ? DETAILS[nodeId] : undefined;
  if (!node || !details) return FREE_TALK;
  return { id: node.id, title: node.title, target_item_ids: node.skillIds, max_turns: 8, ...details };
}

export const ALL_SCENARIOS: { scenario: Scenario; icon: string; unitTitle: string }[] = [
  { scenario: FREE_TALK, icon: '🐼', unitTitle: 'Libre' },
  { scenario: PRONUNCIATION_DRILL, icon: '🎙️', unitTitle: 'Pronunciación' },
  ...HSK1_UNITS.flatMap((u) =>
    u.nodes.filter((n) => n.kind === 'conversation').map((n) => ({ scenario: scenarioForNode(n.id), icon: n.icon, unitTitle: `HSK ${u.level} · ${u.title}` })),
  ),
];
