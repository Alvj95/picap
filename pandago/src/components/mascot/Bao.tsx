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
import { motion } from '@/theme/tokens';
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
        // Subida rápida con timing y aterrizaje con resorte: un resorte poco amortiguado
        // para subir oscila segundos alrededor del punto alto y Bao parece "flotar".
        y.set(withSequence(withTiming(-size * 0.35, { duration: 170, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 18, stiffness: 220, mass: 1 })));
        scale.set(withSequence(withTiming(0.9, { duration: 80 }), withSpring(1.08, motion.spring), withSpring(1, motion.spring)));
        sparkle.set(withSequence(withTiming(1, { duration: 200 }), withDelay(400, withTiming(0, { duration: 300 }))));
        break;
      case 'celebrate':
        y.set(
          withRepeat(withSequence(withTiming(-size * 0.4, { duration: 200, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 18, stiffness: 220, mass: 1 })), 3),
        );
        rotate.set(withSequence(withTiming(360, { duration: 700, easing: Easing.out(Easing.back(1.5)) }), withTiming(0, { duration: 0 })));
        sparkle.set(withRepeat(withSequence(withTiming(1, { duration: 250 }), withTiming(0.4, { duration: 250 })), 6, true));
        break;
      case 'encourage':
        // Escalofrío horizontal rápido y luego se "recompone".
        rotate.set(withSequence(...[-10, 10, -8, 8, -4, 4, 0].map((deg) => withTiming(deg, { duration: 55 }))));
        scale.set(withSequence(withTiming(0.92, { duration: 120 }), withSpring(1, motion.bouncy)));
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
          <Animated.Text
            key={i}
            style={[styles.sparkle, { left: size * (SPARKLE_POS[i]?.x ?? 0), top: size * (SPARKLE_POS[i]?.y ?? 0), fontSize: Math.max(14, size * 0.2) }]}
          >
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

/** Posiciones relativas al tamaño de Bao, alrededor de la cabeza. */
const SPARKLE_POS = [
  { x: -0.12, y: 0.05 },
  { x: 0.88, y: 0.0 },
  { x: -0.18, y: 0.55 },
  { x: 0.95, y: 0.5 },
] as const;

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  sparkle: { position: 'absolute' },
});
