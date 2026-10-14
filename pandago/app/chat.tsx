import { useLocalSearchParams } from 'expo-router';
import { ChatScreen } from '@/features/chat/ChatScreen';
import type { Scenario } from '@/features/chat/engine/contract';
import { HSK1_UNITS } from '@/data/hsk/hsk1.sample';

/** Escenario libre con Bao cuando se entra desde la Home sin nodo concreto. */
const FREE_TALK: Scenario = {
  id: 'free-bao',
  title: 'Charla con Bao',
  goal: 'Preséntate y pregunta su nombre a Bao',
  persona: 'bao',
  target_item_ids: ['hsk1-0001', 'hsk1-0006', 'hsk1-0007', 'hsk1-0008'],
  max_turns: 8,
};

export default function Chat() {
  const { nodeId } = useLocalSearchParams<{ nodeId?: string }>();
  const node = HSK1_UNITS.flatMap((u) => u.nodes).find((n) => n.id === nodeId);
  const scenario: Scenario = node
    ? {
        id: node.id,
        title: node.title,
        goal: node.id === 'u2-ai' ? 'Pide un té en la casa de té y da las gracias' : FREE_TALK.goal,
        persona: node.id === 'u2-ai' ? 'native' : 'bao',
        role: node.id === 'u2-ai' ? 'camarero de una casa de té en Pekín' : undefined,
        target_item_ids: node.skillIds,
        max_turns: 8,
      }
    : FREE_TALK;
  return <ChatScreen scenario={scenario} />;
}
