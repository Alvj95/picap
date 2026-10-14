import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BaoFace } from './BaoFace';
import type { BaoMood } from './types';

interface Props {
  mood?: BaoMood;
  size?: number;
}

/**
 * Bao animado. Cada mood es una coreografía de 3 valores compartidos
 * (y, rotación, escala) + una capa de destellos. Todo corre en el hilo UI.
 */
export function Bao({ mood = 'idle', size = 96 }: Props) {
  const y = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);
  const sparkle = useSharedValue(0);

  useEffect(() => {
    [y, rotate, scale, sparkle].forEach((v) => cancelAnimation(v));
    y.set(0);
    rotate.set(0);
    scale.set(1);
    sparkle.set(0);

    switch (mood) {
      case 'idle':
        // Respiración: escala sutil en bucle.
        scale.set(withRepeat(withTiming(1.04, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true));
        break;
      case 'talking':
        y.set(withRepeat(withSequence(withTiming(-3, { duration: 120 }), withTiming(0, { duration: 120 })), -1));
        break;
      case 'thinking':
        rotate.set(withRepeat(withTiming(-8, { duration: 600, easing: Easing.inOut(Easing.quad) }), -1, true));
        break;
      case 'happy':
        y.set(withSequence(withSpring(-size * 0.35, { damping: 6, stiffness: 260 }), withSpring(0, { damping: 9 })));
        scale.set(withSequence(withTiming(0.9, { duration: 80 }), withSpring(1.08), withSpring(1)));
        sparkle.set(withSequence(withTiming(1, { duration: 200 }), withDelay(400, withTiming(0, { duration: 300 }))));
        break;
      case 'celebrate':
        y.set(withRepeat(withSequence(withSpring(-size * 0.4, { damping: 5, stiffness: 240 }), withSpring(0, { damping: 8 })), 3));
        rotate.set(withSequence(withTiming(360, { duration: 700, easing: Easing.out(Easing.back(1.5)) }), withTiming(0, { duration: 0 })));
        sparkle.set(withRepeat(withSequence(withTiming(1, { duration: 250 }), withTiming(0.4, { duration: 250 })), 6, true));
        break;
      case 'encourage':
        // Escalofrío horizontal rápido y luego se "recompone".
        rotate.set(withSequence(...[-10, 10, -8, 8, -4, 4, 0].map((deg) => withTiming(deg, { duration: 55 }))));
        scale.set(withSequence(withTiming(0.92, { duration: 120 }), withSpring(1, { damping: 7 })));
        break;
    }
  }, [mood, size, y, rotate, scale, sparkle]);

  const body = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { rotate: `${rotate.value}deg` }, { scale: scale.value }],
  }));
  const sparkles = useAnimatedStyle(() => ({ opacity: sparkle.value, transform: [{ scale: 0.6 + sparkle.value * 0.6 }] }));

  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel={`Bao, el panda rojo (${mood})`}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, sparkles]} pointerEvents="none">
        {['✨', '⭐', '✨', '💫'].map((s, i) => (
          <Animated.Text key={i} style={[styles.sparkle, SPARKLE_POS[i]]}>
            {s}
          </Animated.Text>
        ))}
      </Animated.View>
      <Animated.View style={body}>
        <BaoFace mood={mood} size={size} />
      </Animated.View>
    </View>
  );
}

const SPARKLE_POS = [
  { top: -6, left: -4 },
  { top: 4, right: -10 },
  { bottom: 6, left: -12 },
  { bottom: -4, right: -2 },
] as const;

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  sparkle: { position: 'absolute', fontSize: 18 },
});
