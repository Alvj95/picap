/**
 * Repetición espaciada ligera (inspirada en FSRS): la retención decae como
 *   R(t) = 0.9 ^ (t / stability)   (t en días)
 * y un ítem "vence" cuando R < objetivo. `stability` la actualiza learnerModel.observe.
 */
import type { LearnerModel } from './learnerModel';

const DAY = 24 * 60 * 60 * 1000;
export const TARGET_RETENTION = 0.85;

export function retrievability(stabilityDays: number, lastSeen: number, now = Date.now()) {
  const days = (now - lastSeen) / DAY;
  return Math.pow(0.9, days / stabilityDays);
}

/** Ítems a repasar, los más olvidados primero. */
export function dueItems(model: LearnerModel, now = Date.now(), limit = 20): string[] {
  return Object.entries(model.items)
    .map(([id, s]) => ({ id, r: retrievability(s.stability, s.lastSeen, now) }))
    .filter((x) => x.r < TARGET_RETENTION)
    .sort((a, b) => a.r - b.r)
    .slice(0, limit)
    .map((x) => x.id);
}
