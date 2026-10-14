import { useEffect, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { PressableScale } from './PressableScale';

interface Props {
  icon: string;
  value: number | string;
  color: string;
  label: string;
  onPress?: () => void;
}

/** Indicador compacto (racha, vidas, gemas). Hace "pop" cada vez que cambia su valor. */
export function StatPill({ icon, value, color, label, onPress }: Props) {
  const { type } = useTheme();
  const scale = useSharedValue(1);
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current !== value) {
      scale.set(withSequence(withTiming(1.35, { duration: 120 }), withSpring(1, { damping: 18, stiffness: 260, mass: 1 })));
      previous.current = value;
    }
  }, [value, scale]);

  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${label}: ${value}`} style={styles.pill}>
      <Animated.Text style={[styles.icon, pop]}>{icon}</Animated.Text>
      <Text style={[type.title, { color }]}>{value}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6 },
  icon: { fontSize: 22 },
});
