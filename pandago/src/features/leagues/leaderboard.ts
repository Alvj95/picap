/**
 * Liga semanal. En producción la clasificación viene del servidor (grupos de
 * 30 usuarios de XP similar); aquí se simulan rivales deterministas por semana
 * para que la pantalla y la Home funcionen offline y sean coherentes entre sí.
 */
import { createRng } from '@/features/lesson/engine/random';

export const LEAGUES = ['Bambú', 'Jade', 'Seda', 'Linterna', 'Dragón', 'Emperador'] as const;
export type League = (typeof LEAGUES)[number];

export const LEAGUE_STYLE: Record<League, { icon: string; color: string }> = {
  Bambú: { icon: '🎋', color: '#3CCB6F' },
  Jade: { icon: '🟢', color: '#1FB59A' },
  Seda: { icon: '🧣', color: '#3DA9FC' },
  Linterna: { icon: '🏮', color: '#FF4B5C' },
  Dragón: { icon: '🐉', color: '#8B5CF6' },
  Emperador: { icon: '👑', color: '#FFC233' },
};

export const GROUP_SIZE = 20;
export const PROMOTE = 5;
export const DEMOTE = 5;

const NAMES = ['Lucía', 'Mateo', 'Wei', 'Sofía', 'Hugo', 'Mei', 'Diego', 'Valentina', 'Chen', 'Martina', 'Leo', 'Ling', 'Pablo', 'Camila', 'Bruno', 'Xiu', 'Alba', 'Tomás', 'Yan', 'Inés', 'Iker', 'Lan', 'Nora', 'Álex'];
const AVATARS = ['🐯', '🐰', '🦊', '🐨', '🐸', '🐵', '🐧', '🦁', '🐮', '🐷', '🐻', '🦉', '🐙', '🦄'];

export interface Entry {
  id: string;
  name: string;
  avatar: string;
  xp: number;
  isMe: boolean;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Semanas desde el lunes 5-ene-1970 (las ligas cierran el domingo a medianoche UTC). */
export const weekIndex = (now: number) => Math.floor((now - 4 * 24 * 60 * 60 * 1000) / WEEK_MS);

export function weekProgress(now: number) {
  const start = weekIndex(now) * WEEK_MS + 4 * 24 * 60 * 60 * 1000;
  const elapsed = (now - start) / WEEK_MS;
  return { elapsed, msLeft: start + WEEK_MS - now };
}

export function buildLeaderboard(league: League, myXp: number, now = Date.now()): Entry[] {
  const rng = createRng(weekIndex(now) * 31 + LEAGUES.indexOf(league));
  const { elapsed } = weekProgress(now);
  const tier = 1 + LEAGUES.indexOf(league) * 0.6; // ligas altas = rivales más activos
  const bots: Entry[] = Array.from({ length: GROUP_SIZE - 1 }, (_, i) => {
    const weekly = Math.round((40 + rng() * 360) * tier);
    // Los rivales "juegan" a lo largo de la semana: XP proporcional al tiempo transcurrido, con ritmos distintos.
    const pace = Math.min(1, elapsed * (0.6 + rng() * 0.8));
    return {
      id: `bot${i}`,
      name: NAMES[Math.floor(rng() * NAMES.length)] ?? 'Rival',
      avatar: AVATARS[Math.floor(rng() * AVATARS.length)] ?? '🐼',
      xp: Math.round(weekly * pace),
      isMe: false,
    };
  });
  return [...bots, { id: 'me', name: 'Tú', avatar: '🐼', xp: myXp, isMe: true }].sort((a, b) => b.xp - a.xp || (a.isMe ? -1 : 1));
}

export type Zone = 'promote' | 'safe' | 'demote';

export function zoneOf(rank: number, league: League): Zone {
  if (rank <= PROMOTE && league !== 'Emperador') return 'promote';
  if (rank > GROUP_SIZE - DEMOTE && league !== 'Bambú') return 'demote';
  return 'safe';
}
