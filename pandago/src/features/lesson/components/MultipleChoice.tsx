import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import { PressableScale } from '@/components/ui';
import { useTheme } from '@/theme';
import type { Exercise } from '../engine/types';
import { ChoiceTile, type TileState } from './ChoiceTile';

type MC = Extract<Exercise, { kind: 'multiple_choice' }>;

interface Props {
  exercise: MC;
  selected: number | null;
  /** Tras comprobar: se colorean acierto/fallo. */
  revealed: boolean;
  onSelect: (index: number) => void;
}

const speak = (text: string, slow = false) => Speech.speak(text, { language: 'zh-CN', rate: slow ? 0.55 : 0.85 });

export function MultipleChoice({ exercise, selected, revealed, onSelect }: Props) {
  const { c, type, spacing, radius } = useTheme();
  const isAudio = exercise.mode === 'audio_to_hanzi';

  // Se reproduce el audio automáticamente al entrar (como en Duolingo).
  useEffect(() => {
    if (exercise.speak) speak(exercise.speak);
  }, [exercise.id, exercise.speak]);

  const stateOf = (i: number): TileState => {
    if (!revealed) return selected === i ? 'selected' : 'idle';
    if (i === exercise.answerIndex) return 'correct';
    return selected === i ? 'wrong' : 'disabled';
  };

  return (
    <View style={{ gap: spacing.lg }}>
      {isAudio ? (
        <View style={[styles.row, { gap: spacing.md, justifyContent: 'center' }]}>
          <PressableScale onPress={() => speak(exercise.speak ?? '')} accessibilityLabel="Reproducir audio" style={[styles.audio, { backgroundColor: c.info, borderRadius: radius.lg }]}>
            <Text style={styles.audioIcon}>🔊</Text>
          </PressableScale>
          <PressableScale onPress={() => speak(exercise.speak ?? '', true)} accessibilityLabel="Reproducir despacio" style={[styles.audioSlow, { backgroundColor: c.info, borderRadius: radius.md }]}>
            <Text style={styles.audioSlowIcon}>🐢</Text>
          </PressableScale>
        </View>
      ) : (
        <PressableScale onPress={() => exercise.speak && speak(exercise.speak)} disabled={!exercise.speak} haptic={!!exercise.speak} style={styles.center}>
          <Text style={[exercise.mode === 'hanzi_to_meaning' ? type.hanzi : type.title, { color: c.textPrimary, fontSize: exercise.mode === 'hanzi_to_meaning' ? 56 : 24, lineHeight: exercise.mode === 'hanzi_to_meaning' ? 68 : 30 }]}>
            {exercise.question}
          </Text>
          {exercise.questionSub && <Text style={[type.body, { color: c.textSecondary }]}>{exercise.questionSub} {exercise.speak ? '🔊' : ''}</Text>}
        </PressableScale>
      )}

      <View style={[styles.grid, { gap: spacing.sm }]}>
        {exercise.options.map((o, i) => (
          <ChoiceTile
            key={`${exercise.id}-${i}`}
            label={o.label}
            sub={o.sub}
            hanzi={exercise.mode !== 'hanzi_to_meaning'}
            state={stateOf(i)}
            containerStyle={styles.cell}
            style={styles.cellInner}
            onPress={() => {
              if (revealed) return;
              onSelect(i);
              if (exercise.mode !== 'hanzi_to_meaning') speak(o.label);
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '48%', flexGrow: 1 },
  cellInner: { minHeight: 84 },
  audio: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  audioIcon: { fontSize: 52 },
  audioSlow: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  audioSlowIcon: { fontSize: 30 },
});
