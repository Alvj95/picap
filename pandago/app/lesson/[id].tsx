import { useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ComingSoon } from '@/components/ComingSoon';
import { LessonScreen } from '@/features/lesson/LessonScreen';
import { findNode, LOCAL_CONTENT } from '@/features/lesson/content';
import { buildLesson } from '@/features/lesson/engine/exerciseFactory';
import { createRng } from '@/features/lesson/engine/random';
import { useProgressStore } from '@/store/useProgressStore';

export default function Lesson() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const level = useProgressStore((s) => s.hskLevel);
  const node = findNode(id);
  // Nueva semilla cada vez que se abre: misma lección, distinto orden y distractores.
  const [seed] = useState(() => Date.now());
  const exercises = useMemo(() => (node ? buildLesson(node.skillIds, LOCAL_CONTENT, createRng(seed)) : []), [node, seed]);

  if (!node || !exercises.length) return <ComingSoon title="Lección" />;
  return <LessonScreen exercises={exercises} node={node} level={level} />;
}
