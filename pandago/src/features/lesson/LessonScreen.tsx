import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { exitTo } from '@/lib/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button3D } from '@/components/ui';
import { levelDifficulty } from '@/features/learning/adaptive/learnerModel';
import type { HskLevel, LessonNode } from '@/data/hsk/types';
import { feedback } from '@/lib/haptics';
import { useLearnerStore } from '@/store/useLearnerStore';
import { MAX_HEARTS, useProgressStore } from '@/store/useProgressStore';
import { useTheme } from '@/theme';
import { FeedbackBanner } from './components/FeedbackBanner';
import { LessonComplete, OutOfHearts } from './components/LessonEnd';
import { LessonHeader } from './components/LessonHeader';
import { MatchPairs } from './components/MatchPairs';
import { MultipleChoice } from './components/MultipleChoice';
import { SentenceOrder } from './components/SentenceOrder';
import { StrokeWriting } from './components/StrokeWriting';
import { grade } from './engine/exerciseFactory';
import { initLesson, lessonReducer, progressOf, summarize } from './engine/lessonReducer';
import type { Answer, Exercise } from './engine/types';

const REFILL_COST = 350;

interface Props {
  exercises: Exercise[];
  /** Nodo del camino que se completa al terminar (ausente en repasos). */
  node?: LessonNode;
  level: HskLevel;
  /** Los repasos no cuestan vidas (se practica sin presión). */
  costsHearts?: boolean;
}

export function LessonScreen({ exercises, node, level, costsHearts = true }: Props) {
  const { c, type, spacing } = useTheme();
  const router = useRouter();
  const progress = useProgressStore();
  const record = useLearnerStore((s) => s.record);
  const [state, dispatch] = useReducer(lessonReducer, undefined, () => initLesson(exercises, progress.hearts));
  const [choice, setChoice] = useState<number | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const rewarded = useRef(false);

  const ex = state.queue[state.index];
  const revealed = state.phase === 'feedback';

  const submit = useCallback(
    (answer: Answer) => {
      if (!ex || state.phase !== 'answering') return;
      const result = grade(ex, answer);
      void (result.correct ? feedback.correct() : feedback.wrong());
      for (const o of result.observations) record({ ...o, difficulty: levelDifficulty(level) });
      if (!result.correct && costsHearts) progress.loseHeart();
      dispatch({ type: 'graded', result, costsHeart: costsHearts });
    },
    [ex, state.phase, record, level, costsHearts, progress],
  );

  const summary = useMemo(() => (state.phase === 'complete' ? summarize(state) : null), [state]);

  useEffect(() => {
    if (!summary || rewarded.current) return;
    rewarded.current = true;
    progress.awardXp(summary.xp);
    if (node) progress.completeNode(node);
    void feedback.levelUp();
  }, [summary, node, progress]);

  const noHearts = state.phase === 'out_of_hearts' || (costsHearts && state.hearts === 0 && state.phase === 'answering');
  if (noHearts) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: c.background }]}>
        <OutOfHearts
          gems={progress.gems}
          cost={REFILL_COST}
          onQuit={() => exitTo(router)}
          onPractice={() => router.replace('/chat')}
          onRefill={() => {
            if (!progress.spendGems(REFILL_COST)) return;
            progress.refillHearts();
            dispatch({ type: 'refill', hearts: MAX_HEARTS });
          }}
        />
      </SafeAreaView>
    );
  }

  if (summary) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: c.background }]}>
        <LessonComplete summary={summary} onContinue={() => exitTo(router)} />
      </SafeAreaView>
    );
  }

  if (!ex) return null;

  const canCheck = (ex.kind === 'multiple_choice' && choice !== null) || (ex.kind === 'sentence_order' && order.length > 0);
  const selfGraded = ex.kind === 'match_pairs' || ex.kind === 'stroke_writing';

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.background }]}>
      <LessonHeader progress={progressOf(state)} hearts={costsHearts ? state.hearts : null} combo={state.combo} onClose={() => exitTo(router)} />

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, flexGrow: 1 }} scrollEnabled={ex.kind !== 'stroke_writing'}>
        <Text style={[type.display, { color: c.textPrimary, fontSize: 24 }]}>{ex.instruction}</Text>
        {state.retried.has(ex.id) && state.phase === 'answering' && (
          <Text style={[type.caption, { color: c.streak }]}>↻ ERROR ANTERIOR</Text>
        )}

        {ex.kind === 'multiple_choice' && <MultipleChoice key={ex.id + state.index} exercise={ex} selected={choice} revealed={revealed} onSelect={setChoice} />}
        {ex.kind === 'sentence_order' && (
          <SentenceOrder key={ex.id + state.index} exercise={ex} picked={order} revealed={revealed} correct={state.last?.correct ?? null} onChange={setOrder} />
        )}
        {ex.kind === 'match_pairs' && <MatchPairs key={ex.id + state.index} exercise={ex} onComplete={(score) => submit({ kind: 'self_graded', score })} />}
        {ex.kind === 'stroke_writing' && <StrokeWriting key={ex.id + state.index} exercise={ex} onComplete={(score) => submit({ kind: 'self_graded', score })} />}
      </ScrollView>

      {revealed && state.last ? (
        <FeedbackBanner correct={state.last.correct} solution={state.last.solution} combo={state.combo} onContinue={() => {
            // La selección local se limpia al pasar al siguiente ejercicio.
            setChoice(null);
            setOrder([]);
            dispatch({ type: 'continue' });
          }} />
      ) : (
        !selfGraded && (
          <View style={[styles.footer, { borderTopColor: c.border, padding: spacing.md }]}>
            <Button3D
              label="Comprobar"
              variant="success"
              disabled={!canCheck}
              onPress={() =>
                submit(
                  ex.kind === 'multiple_choice'
                    ? { kind: 'choice', index: choice ?? -1 }
                    : { kind: 'order', tokens: order.map((i) => (ex.kind === 'sentence_order' ? ex.bank[i] ?? '' : '')) },
                )
              }
            />
          </View>
        )
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { borderTopWidth: 2 },
});
