import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaoBubble } from '@/components/mascot';
import { HSK1_UNITS } from '@/data/hsk/hsk1.sample';
import type { LessonNode } from '@/data/hsk/types';
import { feedback } from '@/lib/haptics';
import { useProgressStore } from '@/store/useProgressStore';
import { useTheme } from '@/theme';
import { DailyGoalCard } from './components/DailyGoalCard';
import { LearningPath } from './components/LearningPath';
import { LeagueChestRow } from './components/LeagueChestRow';
import { QuickActions } from './components/QuickActions';
import { TopStatusBar } from './components/TopStatusBar';

/** Tip del día de Bao (en producción lo genera el motor de IA según los errores recientes). */
const TIP = {
  message: 'Truco: cuando dos 3er tonos van juntos, el primero se pronuncia como 2º tono.',
  hanzi: '你好',
  pinyin: 'ní hǎo',
};

export function HomeScreen() {
  const { c, spacing } = useTheme();
  const router = useRouter();
  const tick = useProgressStore((s) => s.tick);
  const openChest = useProgressStore((s) => s.openChest);
  const [showTip, setShowTip] = useState(true);

  // Regenera vidas / evalúa la racha cada vez que se monta la Home.
  useEffect(() => tick(), [tick]);

  const openNode = (node: LessonNode) => {
    void feedback.tap();
    if (node.kind === 'conversation') router.push({ pathname: '/chat', params: { nodeId: node.id } });
    else router.push({ pathname: '/lesson/[id]', params: { id: node.id } });
  };

  const handleChest = () => {
    const reward = openChest();
    if (!reward) return;
    void feedback.levelUp();
    Alert.alert('🎁 ¡Cofre abierto!', `+${reward.gems} 💎${reward.xpBoostMinutes ? ` y XP doble durante ${reward.xpBoostMinutes} min` : ''}`);
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.background }]}>
      <TopStatusBar />
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl * 2 }}
        showsVerticalScrollIndicator={false}
      >
        <DailyGoalCard />
        <QuickActions onPress={(key) => router.push(key === 'review' ? '/review' : { pathname: '/chat', params: { mode: key } })} />
        <LeagueChestRow onOpenLeague={() => router.push('/leagues')} onOpenChest={handleChest} />
        {showTip && (
          <View onTouchEnd={() => setShowTip(false)}>
            <BaoBubble {...TIP} mood="talking" />
          </View>
        )}
        <LearningPath units={HSK1_UNITS} onOpenNode={openNode} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
