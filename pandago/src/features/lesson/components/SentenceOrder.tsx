import { StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition, ZoomIn } from 'react-native-reanimated';
import * as Speech from 'expo-speech';
import { Bao } from '@/components/mascot';
import { useTheme } from '@/theme';
import type { Exercise } from '../engine/types';
import { ChoiceTile } from './ChoiceTile';

type SO = Extract<Exercise, { kind: 'sentence_order' }>;

interface Props {
  exercise: SO;
  /** Índices del banco colocados en la línea de respuesta, en orden. */
  picked: number[];
  revealed: boolean;
  correct: boolean | null;
  onChange: (picked: number[]) => void;
}

/**
 * Ordenar la frase: las fichas "viajan" entre el banco y la línea de respuesta
 * gracias a las transiciones de layout de Reanimated.
 */
export function SentenceOrder({ exercise, picked, revealed, correct, onChange }: Props) {
  const { c, type, spacing, radius } = useTheme();

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Bao mood="talking" size={64} />
        <View style={[styles.bubble, { borderColor: c.border, borderRadius: radius.md, padding: spacing.sm }]}>
          <Text style={[type.body, { color: c.textPrimary }]}>{exercise.meaning}</Text>
        </View>
      </View>

      {/* Línea de respuesta */}
      <View style={[styles.answer, { borderColor: c.border, minHeight: 64, gap: spacing.xs, paddingVertical: spacing.xs }]}>
        {picked.map((bankIndex, pos) => (
          <Animated.View key={`a-${bankIndex}`} layout={LinearTransition.springify().damping(16)} entering={ZoomIn.duration(160)}>
            <ChoiceTile
              hanzi
              label={exercise.bank[bankIndex] ?? ''}
              state={!revealed ? 'idle' : correct ? 'correct' : 'wrong'}
              onPress={() => !revealed && onChange(picked.filter((_, i) => i !== pos))}
            />
          </Animated.View>
        ))}
      </View>
      {revealed && <Text style={[type.caption, { color: c.textSecondary, textAlign: 'center' }]}>{exercise.pinyin}</Text>}

      {/* Banco de fichas: los huecos se mantienen para que nada salte de sitio */}
      <View style={[styles.bank, { gap: spacing.xs }]}>
        {exercise.bank.map((token, i) => {
          const used = picked.includes(i);
          return (
            <Animated.View key={`b-${i}`} layout={LinearTransition}>
              <ChoiceTile
                hanzi
                label={token}
                state={used ? 'disabled' : 'idle'}
                style={used ? { opacity: 0.35 } : undefined}
                onPress={() => {
                  if (used || revealed) return;
                  Speech.speak(token, { language: 'zh-CN', rate: 0.85 });
                  onChange([...picked, i]);
                }}
              />
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  bubble: { flex: 1, borderWidth: 2 },
  answer: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: 2, borderTopWidth: 2, alignItems: 'center' },
  bank: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
});
