import { StyleSheet, Text, View } from 'react-native';
import { Card, ProgressBar } from '@/components/ui';
import { Bao, type BaoMood } from '@/components/mascot';
import { useProgressStore } from '@/store/useProgressStore';
import { useTheme } from '@/theme';

function baoLine(xp: number, goal: number, streak: number): { text: string; mood: BaoMood } {
  if (xp >= goal) return { text: '¡Meta cumplida! 太棒了! Tu racha está a salvo 🔥', mood: 'celebrate' };
  if (xp > 0) return { text: `¡Vas genial! Solo ${goal - xp} XP más.`, mood: 'happy' };
  if (streak > 0) return { text: `¡No pierdas tus ${streak} días de racha! Una lección rápida y listo.`, mood: 'talking' };
  return { text: '你好! Soy Bao. ¿Empezamos tu primera lección?', mood: 'idle' };
}

export function DailyGoalCard() {
  const { c, type, spacing } = useTheme();
  const { xpToday, dailyGoalXp, streakDays } = useProgressStore();
  const line = baoLine(xpToday, dailyGoalXp, streakDays);

  return (
    <Card index={0}>
      <View style={[styles.row, { gap: spacing.md }]}>
        <Bao mood={line.mood} size={84} />
        <View style={styles.flex}>
          <Text style={[type.caption, { color: c.textSecondary }]}>META DIARIA</Text>
          <Text style={[type.body, { color: c.textPrimary, marginVertical: spacing.xxs }]}>{line.text}</Text>
          <View style={[styles.row, { gap: spacing.xs }]}>
            <View style={styles.flex}>
              <ProgressBar progress={xpToday / dailyGoalXp} color={c.xp} />
            </View>
            <Text style={[type.caption, { color: c.xpLip }]}>
              {Math.min(xpToday, dailyGoalXp)}/{dailyGoalXp} XP
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
