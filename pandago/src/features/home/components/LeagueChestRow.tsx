import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { Card, PressableScale } from '@/components/ui';
import { useProgressStore } from '@/store/useProgressStore';
import { useTheme } from '@/theme';

/** Fila con la liga semanal y el cofre de recompensas (que se agita si hay alguno pendiente). */
export function LeagueChestRow({ onOpenLeague, onOpenChest }: { onOpenLeague: () => void; onOpenChest: () => void }) {
  const { c, type, spacing } = useTheme();
  const { league, leagueRank, leagueWeeklyXp, pendingChests } = useProgressStore();
  const wiggle = useSharedValue(0);

  useEffect(() => {
    wiggle.set(pendingChests
      ? withRepeat(withSequence(withTiming(-8, { duration: 90 }), withTiming(8, { duration: 90 }), withTiming(0, { duration: 90 }), withTiming(0, { duration: 1200 })), -1)
      : 0);
  }, [pendingChests, wiggle]);
  const wiggleStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wiggle.value}deg` }] }));

  return (
    <View style={[styles.row, { gap: spacing.sm }]}>
      <PressableScale containerStyle={styles.flex} onPress={onOpenLeague} accessibilityLabel={`Liga ${league}, puesto ${leagueRank}`}>
        <Card index={1}>
          <Text style={[type.caption, { color: c.textSecondary }]}>LIGA {league.toUpperCase()}</Text>
          <View style={[styles.row, { gap: spacing.xs, marginTop: 4 }]}>
            <Text style={styles.emoji}>🏮</Text>
            <View>
              <Text style={[type.title, { color: c.league }]}>#{leagueRank}</Text>
              <Text style={[type.caption, { color: c.textSecondary }]}>{leagueWeeklyXp} XP semanal</Text>
            </View>
          </View>
        </Card>
      </PressableScale>
      <PressableScale containerStyle={styles.flex} onPress={onOpenChest} accessibilityLabel={`${pendingChests} cofres por abrir`}>
        <Card index={1} tint={pendingChests ? c.primarySoft : undefined}>
          <Text style={[type.caption, { color: c.textSecondary }]}>COFRES</Text>
          <View style={[styles.row, { gap: spacing.xs, marginTop: 4 }]}>
            <Animated.Text style={[styles.emoji, wiggleStyle]}>🎁</Animated.Text>
            <View>
              <Text style={[type.title, { color: c.xpLip }]}>{pendingChests}</Text>
              <Text style={[type.caption, { color: c.textSecondary }]}>{pendingChests ? '¡Ábrelo!' : 'Sigue avanzando'}</Text>
            </View>
          </View>
        </Card>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  emoji: { fontSize: 32 },
});
