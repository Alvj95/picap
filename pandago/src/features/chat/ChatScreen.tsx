import { useCallback, useEffect, useReducer, useRef } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { useRouter } from 'expo-router';
import { exitTo } from '@/lib/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bao } from '@/components/mascot';
import { Button3D } from '@/components/ui';
import { getAuthToken } from '@/lib/auth';
import { feedback } from '@/lib/haptics';
import { useLearnerStore } from '@/store/useLearnerStore';
import { useProgressStore } from '@/store/useProgressStore';
import { useTheme } from '@/theme';
import { MessageBubble } from './components/MessageBubble';
import { TaskInput } from './components/TaskInput';
import { assessPronunciation, requestTutorTurn } from './engine/aiClient';
import type { Scenario, TutorTurn, UserInput } from './engine/contract';
import { buildTurnRequest, chatReducer, checkGapLocally, initChat } from './engine/orchestrator';
import { applySandhi, scoreSyllables, toneTip, tonesFromPinyin } from './engine/tones';

export function ChatScreen({ scenario }: { scenario: Scenario }) {
  const { c, spacing, type } = useTheme();
  const router = useRouter();
  const [state, dispatch] = useReducer(chatReducer, scenario, initChat);
  const snapshot = useLearnerStore((s) => s.snapshot);
  const record = useLearnerStore((s) => s.record);
  const awardXp = useProgressStore((s) => s.awardXp);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const listRef = useRef<FlatList>(null);

  const learnFrom = useCallback(
    (turn: TutorTurn) => {
      // Cada turno alimenta el modelo del estudiante → el motor de niveles se adapta solo.
      for (const corr of turn.corrections) {
        const dimension = (corr.error_tag.split(':')[0] ?? 'speaking') as 'vocab' | 'grammar' | 'tones' | 'speaking';
        record({ itemId: corr.error_tag, dimension, score: corr.severity === 'major' ? 0 : 0.4, difficulty: 0, errorTags: [corr.error_tag] });
      }
      for (const itemId of turn.used_item_ids) record({ itemId, dimension: 'speaking', score: 1, difficulty: 0 });
      if (turn.bao_mood === 'happy' || turn.bao_mood === 'celebrate') void feedback.correct();
      if (turn.bao_mood === 'encourage') void feedback.wrong();
    },
    [record],
  );

  const send = useCallback(
    async (input: UserInput | null, display?: string) => {
      if (input && display) dispatch({ type: 'submit', input, display });
      else dispatch({ type: 'start' });
      try {
        const turn = await requestTutorTurn(buildTurnRequest(state, snapshot(), input), await getAuthToken());
        if (input) learnFrom(turn);
        dispatch({ type: 'tutor_reply', turn });
      } catch {
        dispatch({ type: 'fail', message: 'Bao se ha quedado sin bambú 🎋 Reintenta en un momento.' });
      }
    },
    [state, snapshot, learnFrom],
  );

  useEffect(() => {
    if (state.phase === 'idle') void send(null);
  }, [state.phase, send]);

  useEffect(() => {
    if (state.phase === 'finished') {
      awardXp(state.xpEarned);
      void feedback.levelUp();
    }
  }, [state.phase, state.xpEarned, awardXp]);

  const onGap = (choice: string) => {
    if (!state.task) return;
    const ok = checkGapLocally(state.task, choice);
    void (ok ? feedback.correct() : feedback.wrong()); // feedback instantáneo, antes de la red
    void send({ kind: 'gap_choice', choice }, choice);
  };

  const onMicDown = async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    dispatch({ type: 'record_start' });
  };

  const onMicUp = async () => {
    if (state.phase !== 'recording') return;
    await recorder.stop();
    dispatch({ type: 'record_stop' });
    const target = state.task?.type === 'repeat_aloud' ? state.task : null;
    const expected = target?.hanzi ?? '';
    try {
      const result = await assessPronunciation(recorder.uri ?? '', expected, await getAuthToken());
      let score = 1;
      if (target) {
        const hanzi = [...target.hanzi].filter((ch) => /\p{Script=Han}/u.test(ch));
        // Tonos esperados = léxicos (del pinyin) + sandhi; así 你好 se evalúa como ní hǎo.
        const syllables = scoreSyllables(hanzi, applySandhi(hanzi, tonesFromPinyin(target.pinyin, hanzi.length)), result.syllables);
        score = syllables.reduce((a, s) => a + s.score, 0) / Math.max(1, syllables.length);
        const tip = toneTip(syllables);
        if (tip) record({ itemId: `tones:${expected}`, dimension: 'tones', score, difficulty: 0, errorTags: ['tones:contour'] });
      }
      void send({ kind: 'voice', transcript: result.transcript, pronunciation_score: score }, result.transcript);
    } catch {
      dispatch({ type: 'fail', message: 'No te he oído bien 🙉 ¿Lo intentamos otra vez?' });
    }
  };

  const busy = state.phase === 'tutor_typing' || state.phase === 'assessing';

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, padding: spacing.sm, gap: spacing.sm }]}>
        <Bao mood={state.mood} size={56} />
        <View style={styles.flex}>
          <Text style={[type.title, { color: c.textPrimary }]}>{scenario.title}</Text>
          <Text style={[type.caption, { color: c.textSecondary }]}>
            {busy ? 'Bao está escribiendo…' : `🎯 ${scenario.goal}`}
          </Text>
        </View>
        <Text style={[type.caption, { color: c.xpText }]}>+{state.xpEarned} XP</Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={state.messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
        <View style={[styles.footer, { borderTopColor: c.border, padding: spacing.md, backgroundColor: c.surface }]}>
          {state.phase === 'finished' ? (
            <Button3D label={`¡Completado! +${state.xpEarned} XP`} variant="success" onPress={() => exitTo(router)} />
          ) : state.phase === 'error' ? (
            <Button3D label="Reintentar" onPress={() => void send(null)} />
          ) : (
            <TaskInput
              task={state.task}
              disabled={busy}
              recording={state.phase === 'recording'}
              onText={(t) => void send({ kind: 'text', text: t }, t)}
              onGap={onGap}
              onMicDown={() => void onMicDown()}
              onMicUp={() => void onMicUp()}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2 },
  footer: { borderTopWidth: 2 },
});
