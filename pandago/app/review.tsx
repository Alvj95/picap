import { useState } from 'react';
import { LessonScreen } from '@/features/lesson/LessonScreen';
import { LOCAL_CONTENT } from '@/features/lesson/content';
import { exerciseFromPlan } from '@/features/lesson/engine/exerciseFactory';
import { createRng } from '@/features/lesson/engine/random';
import type { Exercise } from '@/features/lesson/engine/types';
import { levelDifficulty } from '@/features/learning/adaptive/learnerModel';
import { planLesson } from '@/features/learning/adaptive/levelEngine';
import { useLearnerStore } from '@/store/useLearnerStore';

/**
 * Repaso adaptativo: el motor elige ítems (repaso SRS + nuevos + estiramiento)
 * en la zona de ~80% de acierto y los ejercita por la dimensión más débil.
 * No cuesta vidas.
 */
export default function Review() {
  const model = useLearnerStore((s) => s.model);
  const session = useLearnerStore((s) => s.session);

  // Se planifica una sola vez al abrir: el plan no debe cambiar mientras se responde.
  const [exercises] = useState(() => {
    const rng = createRng(Date.now());
    const plan = planLesson(model, LOCAL_CONTENT.vocab, (id) => levelDifficulty(LOCAL_CONTENT.vocab.find((v) => v.id === id)?.level ?? 1), session, 10);
    return plan.map((p) => exerciseFromPlan(p.itemId, p.kind, LOCAL_CONTENT, rng)).filter((e): e is Exercise => !!e);
  });

  return <LessonScreen exercises={exercises} level={model.level} costsHearts={false} />;
}
