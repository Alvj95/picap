import { useMemo } from 'react';
import { useProgressStore } from '@/store/useProgressStore';
import { buildLeaderboard } from './leaderboard';

/** Clasificación actual (misma fuente para la Home y la pestaña Ligas). */
export function useLeagueStanding() {
  const league = useProgressStore((s) => s.league);
  const xp = useProgressStore((s) => s.leagueWeeklyXp);
  return useMemo(() => {
    const board = buildLeaderboard(league, xp);
    return { league, xp, board, rank: board.findIndex((e) => e.isMe) + 1 };
  }, [league, xp]);
}
