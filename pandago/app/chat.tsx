import { useLocalSearchParams } from 'expo-router';
import { ChatScreen } from '@/features/chat/ChatScreen';
import { PRONUNCIATION_DRILL, scenarioForNode } from '@/features/chat/scenarios';

export default function Chat() {
  const { nodeId, mode } = useLocalSearchParams<{ nodeId?: string; mode?: string }>();
  const scenario = mode === 'voice' ? PRONUNCIATION_DRILL : scenarioForNode(nodeId);
  return <ChatScreen scenario={scenario} />;
}
