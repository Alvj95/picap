import { StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Bao } from '@/components/mascot';
import { Button3D, Card } from '@/components/ui';
import { useTheme } from '@/theme';
import type { LessonSummary } from '../engine/lessonReducer';

function Stat({ label, value, color, index }: { label: string; value: string; color: string; index: number }) {
  const { type, spacing } = useTheme();
  return (
    <View style={styles.flex}>
      <Card index={index} tint={color} style={{ padding: spacing.sm, borderColor: color }}>
        <Text style={[type.caption, styles.center, { color: '#fff' }]}>{label}</Text>
        <Text style={[type.title, styles.center, { color: '#fff' }]}>{value}</Text>
      </Card>
    </View>
  );
}

export function LessonComplete({ summary, onContinue }: { summary: LessonSummary; onContinue: () => void }) {
  const { c, type, spacing } = useTheme();
  const mins = Math.floor(summary.seconds / 60);
  const secs = String(summary.seconds % 60).padStart(2, '0');
  return (
    <View style={[styles.screen, { padding: spacing.lg, gap: spacing.lg }]}>
      <View style={[styles.center, { gap: spacing.md }]}>
        <Bao mood="celebrate" size={140} />
        <Animated.Text entering={ZoomIn.delay(200).springify()} style={[type.display, { color: c.xpText, textAlign: 'center' }]}>
          {summary.perfect ? '¡Lección perfecta!' : '¡Lección completada!'}
        </Animated.Text>
      </View>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Stat index={1} label="XP" value={`+${summary.xp}`} color={c.xp} />
        <Stat index={2} label="PRECISIÓN" value={`${Math.round(summary.accuracy * 100)}%`} color={c.success} />
        <Stat index={3} label="TIEMPO" value={`${mins}:${secs}`} color={c.info} />
      </View>
      <Button3D label="Continuar" onPress={onContinue} />
    </View>
  );
}

export function OutOfHearts({ gems, cost, onRefill, onPractice, onQuit }: { gems: number; cost: number; onRefill: () => void; onPractice: () => void; onQuit: () => void }) {
  const { c, type, spacing } = useTheme();
  return (
    <View style={[styles.screen, { padding: spacing.lg, gap: spacing.lg }]}>
      <View style={[styles.center, { gap: spacing.md }]}>
        <Bao mood="encourage" size={120} />
        <Text style={[type.display, { color: c.danger, textAlign: 'center' }]}>¡Sin vidas!</Text>
        <Text style={[type.body, { color: c.textSecondary, textAlign: 'center' }]}>
          Se recupera 1 vida cada 30 minutos. Mientras tanto, puedes practicar conversación con Bao: allí no se pierden vidas.
        </Text>
      </View>
      <Button3D label="Practicar con Bao" onPress={onPractice} />
      <Button3D label={`Recargar · 💎 ${cost}`} variant="success" disabled={gems < cost} onPress={onRefill} />
      <Button3D label="Terminar por hoy" variant="ghost" onPress={onQuit} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center' },
  center: { alignItems: 'center', textAlign: 'center' },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
});
