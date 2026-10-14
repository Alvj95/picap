import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { DEMOTE, GROUP_SIZE, LEAGUES, LEAGUE_STYLE, PROMOTE, weekProgress, zoneOf, type Entry } from './leaderboard';
import { useLeagueStanding } from './useLeagueStanding';

function timeLeft(ms: number) {
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  return days > 0 ? `${days} d ${hours} h` : `${hours} h`;
}

export function LeaguesScreen() {
  const { c, type, spacing, radius } = useTheme();
  const { league, board, rank } = useLeagueStanding();
  const [now] = useState(() => Date.now());
  const { msLeft } = weekProgress(now);
  const current = LEAGUES.indexOf(league);

  // Funciones de render (no componentes anidados) para no remontar filas en cada render.
  const zoneLabel = (text: string, color: string) => (
    <Text style={[type.caption, { color, textAlign: 'center', marginVertical: spacing.xs }]}>{text}</Text>
  );

  const renderRow = (item: Entry, index: number) => {
    const r = index + 1;
    const zone = zoneOf(r, league);
    return (
      <>
        {r === PROMOTE + 1 && league !== 'Emperador' && zoneLabel('⬆︎ ZONA DE ASCENSO', c.success)}
        {r === GROUP_SIZE - DEMOTE + 1 && league !== 'Bambú' && zoneLabel('⬇︎ ZONA DE DESCENSO', c.danger)}
        <Animated.View
          entering={FadeInRight.delay(Math.min(index, 12) * 30)}
          style={[
            styles.row,
            {
              gap: spacing.sm,
              padding: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: item.isMe ? c.primarySoft : 'transparent',
              borderWidth: item.isMe ? 2 : 0,
              borderColor: c.primary,
            },
          ]}
        >
          <Text style={[type.title, styles.rank, { color: zone === 'promote' ? c.success : zone === 'demote' ? c.danger : c.textSecondary }]}>
            {r <= 3 ? ['🥇', '🥈', '🥉'][r - 1] : r}
          </Text>
          <View style={[styles.avatar, { backgroundColor: c.surfaceSunken }]}>
            <Text style={styles.avatarText}>{item.avatar}</Text>
          </View>
          <Text style={[type.body, styles.flex, { color: c.textPrimary, fontFamily: item.isMe ? type.title.fontFamily : type.body.fontFamily }]}>{item.name}</Text>
          <Text style={[type.caption, { color: c.textSecondary }]}>{item.xp} XP</Text>
        </Animated.View>
      </>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: c.background }]}>
      <FlatList
        data={board}
        keyExtractor={(e) => e.id}
        renderItem={({ item, index }) => renderRow(item, index)}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
            {/* Escalera de ligas: las superadas en color, las futuras apagadas */}
            <View style={[styles.ladder, { gap: spacing.xs }]}>
              {LEAGUES.map((l, i) => (
                <View
                  key={l}
                  accessibilityLabel={`Liga ${l}${i === current ? ' (actual)' : ''}`}
                  style={[
                    styles.shield,
                    {
                      backgroundColor: i <= current ? LEAGUE_STYLE[l].color : c.locked,
                      transform: [{ scale: i === current ? 1.25 : 0.9 }],
                      opacity: i > current ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text style={styles.shieldIcon}>{i > current ? '🔒' : LEAGUE_STYLE[l].icon}</Text>
                </View>
              ))}
            </View>
            <Text style={[type.display, { color: c.textPrimary, textAlign: 'center' }]}>Liga {league}</Text>
            <Text style={[type.body, { color: c.textSecondary, textAlign: 'center' }]}>
              Los {PROMOTE} primeros ascienden · Quedan {timeLeft(msLeft)}
            </Text>
            <Text style={[type.caption, { color: c.primary, textAlign: 'center' }]}>Vas en el puesto #{rank}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rank: { width: 32, textAlign: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22 },
  ladder: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  shield: { width: 44, height: 50, borderRadius: 14, borderBottomLeftRadius: 22, borderBottomRightRadius: 22, alignItems: 'center', justifyContent: 'center' },
  shieldIcon: { fontSize: 22 },
});
