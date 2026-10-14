import { useLocalSearchParams } from 'expo-router';
import { ComingSoon } from '@/components/ComingSoon';

export default function Lesson() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ComingSoon title={`Lección ${id}`} />;
}
