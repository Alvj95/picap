import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LearnerSnapshot } from '@/features/chat/engine/contract';
import { createLearner, observe, topWeaknesses, type LearnerModel, type Observation } from '@/features/learning/adaptive/learnerModel';
import { newSession, updateSession, type SessionState } from '@/features/learning/adaptive/levelEngine';

interface LearnerStore {
  model: LearnerModel;
  session: SessionState;
  record: (o: Observation) => void;
  snapshot: () => LearnerSnapshot;
}

export const useLearnerStore = create<LearnerStore>()(
  persist(
    (set, get) => ({
      model: createLearner(1),
      session: newSession(),
      record: (o) => set((s) => ({ model: observe(s.model, o), session: updateSession(s.session, o.score >= 0.6) })),
      snapshot: () => {
        const { model, session } = get();
        return {
          hsk_level: model.level,
          native_language: 'español',
          weaknesses: topWeaknesses(model),
          known_item_ids: Object.entries(model.items)
            .filter(([, s]) => s.mastery >= 0.8)
            .map(([id]) => id),
          session_target_p: session.targetP,
        };
      },
    }),
    {
      name: 'pandago-learner',
      storage: createJSONStorage(() => AsyncStorage),
      // La sesión (racha de aciertos/fallos) no sobrevive a cerrar la app.
      partialize: (s) => ({ model: s.model }),
    },
  ),
);
