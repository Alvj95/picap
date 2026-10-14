import { StyleSheet, Text, View } from 'react-native';
import { StatPill } from '@/components/ui';
import { MAX_HEARTS, useProgressStore } from '@/store/useProgressStore';
import { useTheme } from '@/theme';

/** Barra superior fija: nivel HSK · racha · gemas · vidas. */
export function TopStatusBar({ onPressLevel }: { onPressLevel?: () => void }) {
  const { c, radius, type, spacing } = useTheme();
  const { hskLevel, streakDays, gems, hearts, xpToday } = useProgressStore();
  const streakActiveToday = xpToday > 0;

  return (
    <View style={[styles.bar, { backgroundColor: c.background, borderBottomColor: c.border, paddingHorizontal: spacing.md }]}>
      <View style={[styles.level, { backgroundColor: c.primarySoft, borderRadius: radius.sm }]} onTouchEnd={onPressLevel}>
        <Text style={[type.caption, { color: c.primary }]}>🇨🇳 HSK {hskLevel}</Text>
      </View>
      <StatPill icon={streakActiveToday ? '🔥' : '🩶'} value={streakDays} color={streakActiveToday ? c.streak : c.textSecondary} label="Racha" />
      <StatPill icon="💎" value={gems} color={c.info} label="Gemas" />
      <StatPill icon="❤️" value={hearts === MAX_HEARTS ? hearts : `${hearts}`} color={c.danger} label="Vidas" />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 56, borderBottomWidth: 2 },
  level: { paddingHorizontal: 10, paddingVertical: 6 },
});
