import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { PressableScale } from '@/components/ui';
import type { LessonNode } from '@/data/hsk/types';
import { useTheme } from '@/theme';

export type NodeState = 'done' | 'current' | 'locked';

interface Props {
  node: LessonNode;
  state: NodeState;
  color: string;
  lipColor: string;
  offsetX: number;
  onPress: () => void;
}

const SIZE = 72;

/** Nodo circular del camino. El nodo actual "flota" y muestra la etiqueta EMPEZAR. */
export function PathNode({ node, state, color, lipColor, offsetX, onPress }: Props) {
  const { c, type } = useTheme();
  const float = useSharedValue(0);

  useEffect(() => {
    if (state === 'current') {
      float.set(withRepeat(withSequence(withTiming(-6, { duration: 700 }), withTiming(0, { duration: 700 })), -1));
    } else {
      float.set(0);
    }
  }, [state, float]);

  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: float.value }] }));

  const face = state === 'locked' ? c.locked : node.kind === 'chest' && state === 'done' ? c.xp : color;
  const lip = state === 'locked' ? c.lockedLip : node.kind === 'chest' && state === 'done' ? c.xpLip : lipColor;
  const isBig = node.kind === 'boss' || node.kind === 'conversation';
  const size = isBig ? SIZE * 1.15 : SIZE;

  return (
    <View style={[styles.wrap, { transform: [{ translateX: offsetX }] }]}>
      {state === 'current' && (
        <Animated.View style={[styles.tooltip, { backgroundColor: c.surfaceRaised, borderColor: c.border }, floatStyle]}>
          <Text style={[type.caption, { color }]}>EMPEZAR</Text>
        </Animated.View>
      )}
      <PressableScale
        onPress={onPress}
        disabled={state === 'locked'}
        accessibilityRole="button"
        accessibilityLabel={`${node.title}, ${state === 'done' ? 'completada' : state === 'current' ? 'siguiente' : 'bloqueada'}`}
      >
        <View style={{ backgroundColor: lip, width: size, height: size + 6, borderRadius: size }}>
          <View style={[styles.face, { backgroundColor: face, width: size, height: size, borderRadius: size }]}>
            <Text style={[styles.icon, state === 'locked' && styles.lockedIcon]}>
              {state === 'locked' ? '🔒' : state === 'done' && node.kind === 'lesson' ? '⭐' : node.icon}
            </Text>
          </View>
        </View>
      </PressableScale>
      {(node.kind !== 'lesson' || state === 'current') && (
        <Text style={[type.caption, { color: state === 'locked' ? c.textSecondary : c.textPrimary, marginTop: 6 }]}>{node.title}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginVertical: 10 },
  face: { alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 30 },
  lockedIcon: { opacity: 0.6, fontSize: 24 },
  tooltip: { borderWidth: 2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8 },
});
