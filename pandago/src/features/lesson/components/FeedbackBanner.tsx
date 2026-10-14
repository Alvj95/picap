import { StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { Bao } from '@/components/mascot';
import { Button3D } from '@/components/ui';
import { useTheme } from '@/theme';

const PRAISE = ['¡Excelente!', '¡Genial!', '太棒了!', '¡Perfecto!', '¡Así se hace!'];
const COMBO = (n: number) => (n >= 5 ? `🔥 ¡${n} seguidas!` : null);

interface Props {
  correct: boolean;
  solution: string;
  combo: number;
  onContinue: () => void;
}

/** Hoja inferior que sube tras comprobar: verde con Bao saltando o roja con Bao animando. */
export function FeedbackBanner({ correct, solution, combo, onContinue }: Props) {
  const { c, type, spacing } = useTheme();
  const title = correct ? (COMBO(combo) ?? PRAISE[combo % PRAISE.length]) : 'Solución correcta:';

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18)}
      style={[styles.sheet, { backgroundColor: correct ? c.successSoft : c.dangerSoft, padding: spacing.md, gap: spacing.sm }]}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Bao mood={correct ? 'happy' : 'encourage'} size={60} />
        <View style={styles.flex}>
          <Text style={[type.title, { color: correct ? c.successLip : c.danger }]}>{title}</Text>
          {!correct && solution ? <Text style={[type.hanzi, { color: c.danger, fontSize: 22, lineHeight: 30 }]}>{solution}</Text> : null}
          {!correct && <Text style={[type.caption, { color: c.danger }]}>Lo repasaremos al final 💪</Text>}
        </View>
      </View>
      <Button3D label="Continuar" variant={correct ? 'success' : 'danger'} onPress={onContinue} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
