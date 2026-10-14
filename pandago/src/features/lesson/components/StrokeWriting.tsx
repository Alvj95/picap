import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { G, Line, Path, Polyline } from 'react-native-svg';
import strokeData from '@/data/strokes/hsk1.strokes.json';
import { feedback } from '@/lib/haptics';
import { useTheme } from '@/theme';
import type { Exercise } from '../engine/types';
import { checkStroke, toScreen, writingScore, type Point, type StrokeData } from '../engine/strokeMatcher';

type SW = Extract<Exercise, { kind: 'stroke_writing' }>;

const DATA = strokeData as unknown as Record<string, StrokeData>;
const BOX = 1024;
/** Los contornos de Make Me a Hanzi tienen el eje Y hacia arriba. */
const FLIP = 'translate(0, 900) scale(1, -1)';
const HINT_AFTER = 2; // fallos en el mismo trazo antes de mostrar la pista animada

/**
 * Escritura guiada: el usuario traza sobre una cuadrícula 米; cada trazo se
 * valida contra la mediana esperada (forma, sentido y orden). Los trazos
 * correctos se "rellenan" con color; tras 2 fallos se ilumina el trazo que toca.
 */
export function StrokeWriting({ exercise, onComplete }: { exercise: SW; onComplete: (score: number) => void }) {
  const { c, type, spacing, radius } = useTheme();
  const data = DATA[exercise.char];
  const [size, setSize] = useState(0);
  const [done, setDone] = useState(0);
  const [drawing, setDrawing] = useState<Point[]>([]);
  /** Copia síncrona del trazo: el estado es para pintar, el ref para evaluar. */
  const points = useRef<Point[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const missesOnStroke = useRef(0);
  const totalMistakes = useRef(0);
  const hints = useRef(0);
  const finished = useRef(false);
  const hintPulse = useSharedValue(0);

  const showHint = missesOnStroke.current >= HINT_AFTER;
  useEffect(() => {
    hintPulse.set(showHint ? withRepeat(withSequence(withTiming(1, { duration: 450 }), withTiming(0.25, { duration: 450 })), -1) : 0);
  }, [showHint, done, hintPulse]);
  const hintStyle = useAnimatedStyle(() => ({ opacity: hintPulse.get() }));

  const total = data?.strokes.length ?? 0;
  useEffect(() => {
    if (data && done === total && !finished.current) {
      finished.current = true;
      onComplete(writingScore(total, totalMistakes.current, hints.current));
    }
  }, [done, total, data, onComplete]);

  const toBox = (x: number, y: number): Point => [(x / size) * BOX, (y / size) * BOX];

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onBegin((e) => {
          points.current = [toBox(e.x, e.y)];
          setDrawing(points.current);
        })
        .onUpdate((e) => {
          points.current = [...points.current, toBox(e.x, e.y)];
          setDrawing(points.current);
        })
        .onEnd(() => {
          const stroke = points.current;
          points.current = [];
          setDrawing([]);
          if (!data || done >= total || stroke.length < 2) return;
          const verdict = checkStroke(stroke, data, done);
          if (verdict.ok) {
            void feedback.correct();
            missesOnStroke.current = 0;
            setMessage(null);
            setDone((n) => n + 1);
          } else {
            void feedback.wrong();
            totalMistakes.current += 1;
            missesOnStroke.current += 1;
            if (missesOnStroke.current === HINT_AFTER) hints.current += 1;
            setMessage(verdict.reason === 'order' ? 'Ese trazo va después 😉 Sigue el orden.' : '¡Casi! Fíjate en la dirección del trazo.');
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size, data, done, total],
  );

  if (!data) return <Text style={[type.body, { color: c.danger }]}>Faltan datos de trazos para {exercise.char}</Text>;

  const hintMedian = data.medians[done];

  return (
    <View style={{ gap: spacing.md, alignItems: 'center' }}>
      <Text style={[type.title, { color: c.textPrimary }]}>
        {exercise.pinyin} · «{exercise.meaning}»
      </Text>
      {exercise.word.length > 1 && (
        <Text style={[type.body, { color: c.textSecondary }]}>
          Carácter {exercise.position + 1} de{' '}
          {[...exercise.word].map((ch, i) => (
            <Text key={i} style={[type.hanzi, { fontSize: 20, color: i === exercise.position ? c.primary : c.textSecondary, textDecorationLine: i === exercise.position ? 'underline' : 'none' }]}>
              {ch}
            </Text>
          ))}
        </Text>
      )}

      <GestureDetector gesture={gesture}>
        <View
          onLayout={(e: LayoutChangeEvent) => setSize(e.nativeEvent.layout.width)}
          style={[styles.canvas, { backgroundColor: c.surfaceRaised, borderColor: c.border, borderRadius: radius.lg }]}
          accessibilityLabel={`Lienzo para escribir ${exercise.char}. Trazo ${done + 1} de ${total}`}
        >
          {size > 0 && (
            <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
              {/* Cuadrícula 米字格 */}
              <G stroke={c.border} strokeWidth={4} strokeDasharray="24 18">
                <Line x1={0} y1={BOX / 2} x2={BOX} y2={BOX / 2} />
                <Line x1={BOX / 2} y1={0} x2={BOX / 2} y2={BOX} />
                <Line x1={0} y1={0} x2={BOX} y2={BOX} />
                <Line x1={BOX} y1={0} x2={0} y2={BOX} />
              </G>
              {/* Silueta tenue del carácter y trazos ya completados en color */}
              <G transform={FLIP}>
                {data.strokes.map((d, i) => (
                  <Path key={i} d={d} fill={i < done ? c.primary : c.surfaceSunken} />
                ))}
              </G>
              {/* Trazo en curso del usuario */}
              {drawing.length > 1 && (
                <Polyline
                  points={drawing.map(([x, y]) => `${x},${y}`).join(' ')}
                  fill="none"
                  stroke={c.textPrimary}
                  strokeWidth={42}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.75}
                />
              )}
            </Svg>
          )}
          {/* Pista: el trazo esperado parpadea con su dirección (punto de inicio) */}
          {size > 0 && hintMedian && showHint && (
            <Animated.View style={[StyleSheet.absoluteFill, hintStyle]} pointerEvents="none">
              <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
                <G transform={FLIP}>
                  <Path d={data.strokes[done] ?? ''} fill={c.info} />
                </G>
                <Polyline points={toScreen(hintMedian).map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={c.info} strokeWidth={10} strokeDasharray="30 20" />
              </Svg>
            </Animated.View>
          )}
        </View>
      </GestureDetector>

      <Text style={[type.caption, { color: c.textSecondary }]}>
        Trazo {Math.min(done + 1, total)} de {total}
      </Text>
      {message && (
        <Animated.Text key={message + totalMistakes.current} entering={FadeIn} style={[type.body, { color: c.danger, textAlign: 'center' }]}>
          {message}
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { width: '86%', aspectRatio: 1, borderWidth: 2, overflow: 'hidden' },
});
