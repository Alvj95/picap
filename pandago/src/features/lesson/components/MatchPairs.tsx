import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Speech from 'expo-speech';
import { feedback } from '@/lib/haptics';
import { useTheme } from '@/theme';
import type { Exercise } from '../engine/types';
import { ChoiceTile, type TileState } from './ChoiceTile';

type MP = Extract<Exercise, { kind: 'match_pairs' }>;

/**
 * Emparejar hanzi ↔ significado. Se autocorrige pareja a pareja: verde y se
 * apaga si acierta, tiembla en rojo si falla. Al terminar llama a onComplete
 * con una puntuación que descuenta los fallos.
 */
export function MatchPairs({ exercise, onComplete }: { exercise: MP; onComplete: (score: number) => void }) {
  const { spacing } = useTheme();
  const [left, setLeft] = useState<number | null>(null);
  const [right, setRight] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [flash, setFlash] = useState<{ l: number; r: number; ok: boolean } | null>(null);
  const mistakes = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  /** Se evalúa en el mismo toque que completa la pareja (sin efectos encadenados). */
  const tryPair = (l: number | null, r: number | null) => {
    setLeft(l);
    setRight(r);
    if (l === null || r === null) return;
    const ok = l === r;
    setFlash({ l, r, ok });
    if (ok) void feedback.correct();
    else {
      void feedback.wrong();
      mistakes.current += 1;
    }
    timer.current = setTimeout(
      () => {
        setFlash(null);
        setLeft(null);
        setRight(null);
        if (!ok) return;
        const next = new Set(matched).add(l);
        setMatched(next);
        if (next.size === exercise.pairs.length) onComplete(Math.max(0, 1 - mistakes.current / exercise.pairs.length));
      },
      ok ? 250 : 450,
    );
  };

  const state = (side: 'l' | 'r', i: number): TileState => {
    if (matched.has(i)) return 'disabled';
    if (flash && (side === 'l' ? flash.l : flash.r) === i) return flash.ok ? 'correct' : 'wrong';
    return (side === 'l' ? left : right) === i ? 'selected' : 'idle';
  };

  return (
    <View style={[styles.cols, { gap: spacing.sm }]}>
      <View style={[styles.col, { gap: spacing.sm }]}>
        {exercise.pairs.map((p, i) => (
          <ChoiceTile
            key={`l${i}`}
            hanzi
            label={p.hanzi}
            state={state('l', i)}
            style={styles.tile}
            onPress={() => {
              if (flash || matched.has(i)) return;
              Speech.speak(p.hanzi, { language: 'zh-CN', rate: 0.85 });
              tryPair(i, right);
            }}
          />
        ))}
      </View>
      <View style={[styles.col, { gap: spacing.sm }]}>
        {exercise.rightOrder.map((pairIndex) => (
          <ChoiceTile
            key={`r${pairIndex}`}
            label={exercise.pairs[pairIndex]?.meaning ?? ''}
            state={state('r', pairIndex)}
            style={styles.tile}
            onPress={() => !flash && !matched.has(pairIndex) && tryPair(left, pairIndex)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cols: { flexDirection: 'row' },
  col: { flex: 1 },
  tile: { height: 72 },
});
