import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '@/theme';

interface Props {
  /** 0..1 */
  progress: number;
  color?: string;
  height?: number;
}

/** Barra de progreso con relleno animado por resorte y brillo superior. */
export function ProgressBar({ progress, color, height = 14 }: Props) {
  const { c, motion } = useTheme();
  const value = useSharedValue(0);

  useEffect(() => {
    value.set(withSpring(Math.min(1, Math.max(0, progress)), motion.spring));
  }, [progress, value, motion.spring]);

  const fill = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={[styles.track, { height, borderRadius: height, backgroundColor: c.surfaceSunken }]}
    >
      <Animated.View style={[styles.fill, { borderRadius: height, backgroundColor: color ?? c.success }, fill]}>
        <View style={[styles.shine, { borderRadius: height }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
  shine: { position: 'absolute', top: 3, left: 8, right: 8, height: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
});
