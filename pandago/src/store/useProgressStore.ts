import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { HskLevel, LessonNode } from '@/data/hsk/types';
import type { League } from '@/features/leagues/leaderboard';

export const MAX_HEARTS = 5;
const HEART_REGEN_MS = 30 * 60 * 1000; // 1 vida cada 30 min
const DAY_MS = 24 * 60 * 60 * 1000;


export interface ProgressState {
  hskLevel: HskLevel;
  xpTotal: number;
  xpToday: number;
  dailyGoalXp: number;
  streakDays: number;
  streakFreezes: number;
  lastActiveDay: string | null; // "2026-10-14" (zona local)
  hearts: number;
  heartsUpdatedAt: number;
  gems: number;
  league: League;
  leagueWeeklyXp: number;
  completedNodeIds: string[];
  /** Cofres ganados pendientes de abrir. */
  pendingChests: number;

  awardXp: (amount: number) => void;
  setDailyGoal: (xp: number) => void;
  loseHeart: () => void;
  refillHearts: () => void;
  /** Devuelve false si no hay gemas suficientes. */
  spendGems: (amount: number) => boolean;
  completeNode: (node: LessonNode) => void;
  openChest: () => { gems: number; xpBoostMinutes: number } | null;
  /** Llamar al abrir la app: regenera vidas y rompe/conserva la racha. */
  tick: (now?: number) => void;
}

const dayKey = (t: number) => new Date(t).toLocaleDateString('sv-SE'); // YYYY-MM-DD local

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      hskLevel: 1,
      xpTotal: 0,
      xpToday: 0,
      dailyGoalXp: 30,
      streakDays: 0,
      streakFreezes: 1,
      lastActiveDay: null,
      hearts: MAX_HEARTS,
      heartsUpdatedAt: Date.now(),
      gems: 100,
      league: 'Bambú',
      leagueWeeklyXp: 0,
      completedNodeIds: [],
      pendingChests: 0,

      awardXp: (amount) => {
        const today = dayKey(Date.now());
        const s = get();
        const firstActivityToday = s.lastActiveDay !== today;
        set({
          xpTotal: s.xpTotal + amount,
          xpToday: (firstActivityToday ? 0 : s.xpToday) + amount,
          leagueWeeklyXp: s.leagueWeeklyXp + amount,
          // La racha cuenta el primer día con actividad; `tick` ya decidió si continúa o se rompió.
          streakDays: firstActivityToday ? s.streakDays + 1 : s.streakDays,
          lastActiveDay: today,
        });
      },

      setDailyGoal: (xp) => set({ dailyGoalXp: xp }),

      loseHeart: () => set((s) => ({ hearts: Math.max(0, s.hearts - 1), heartsUpdatedAt: s.hearts === MAX_HEARTS ? Date.now() : s.heartsUpdatedAt })),

      refillHearts: () => set({ hearts: MAX_HEARTS, heartsUpdatedAt: Date.now() }),

      spendGems: (amount) => {
        if (get().gems < amount) return false;
        set((s) => ({ gems: s.gems - amount }));
        return true;
      },

      completeNode: (node) =>
        set((s) => {
          if (s.completedNodeIds.includes(node.id)) return s;
          return {
            completedNodeIds: [...s.completedNodeIds, node.id],
            pendingChests: s.pendingChests + (node.kind === 'chest' ? 1 : 0),
          };
        }),

      openChest: () => {
        const s = get();
        if (s.pendingChests === 0) return null;
        // Recompensa variable (refuerzo intermitente), con suelo garantizado.
        const roll = Math.random();
        const reward = roll > 0.9 ? { gems: 50, xpBoostMinutes: 15 } : roll > 0.6 ? { gems: 25, xpBoostMinutes: 0 } : { gems: 10, xpBoostMinutes: 0 };
        set({ pendingChests: s.pendingChests - 1, gems: s.gems + reward.gems });
        return reward;
      },

      tick: (now = Date.now()) => {
        const s = get();
        const patch: Partial<ProgressState> = {};

        if (s.hearts < MAX_HEARTS) {
          const regenerated = Math.floor((now - s.heartsUpdatedAt) / HEART_REGEN_MS);
          if (regenerated > 0) {
            patch.hearts = Math.min(MAX_HEARTS, s.hearts + regenerated);
            patch.heartsUpdatedAt = s.heartsUpdatedAt + regenerated * HEART_REGEN_MS;
          }
        }

        if (s.lastActiveDay) {
          const today = dayKey(now);
          if (s.lastActiveDay !== today) {
            patch.xpToday = 0;
            const missedDays = Math.round((Date.parse(today) - Date.parse(s.lastActiveDay)) / DAY_MS) - 1;
            if (missedDays > 0) {
              if (missedDays <= s.streakFreezes) {
                patch.streakFreezes = s.streakFreezes - missedDays;
                // Marcamos ayer como activo para que la racha continúe hoy.
                patch.lastActiveDay = dayKey(now - DAY_MS);
              } else {
                patch.streakDays = 0;
              }
            }
          }
        }

        if (Object.keys(patch).length) set(patch);
      },
    }),
    { name: 'pandago-progress', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
