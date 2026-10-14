import { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { PressableScale } from '@/components/ui';
import { lip, useTheme } from '@/theme';

export type TileState = 'idle' | 'selected' | 'correct' | 'wrong' | 'disabled';

interface Props {
  label: string;
  sub?: string;
  state: TileState;
  onPress: () => void;
  hanzi?: boolean;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

/** Ficha/tarjeta seleccionable con labio 3D. En "wrong" tiembla; en "correct" da un pequeño salto. */
export function ChoiceTile({ label, sub, state, onPress, hanzi, style, containerStyle }: Props) {
  const { c, radius, type } = useTheme();
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  useEffect(() => {
    if (state === 'wrong') x.set(withSequence(...[-8, 8, -6, 6, 0].map((v) => withTiming(v, { duration: 50 }))));
    if (state === 'correct') y.set(withSequence(withTiming(-6, { duration: 120 }), withTiming(0, { duration: 160 })));
  }, [state, x, y]);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: y.get() }] }));

  const tone = {
    idle: { bg: c.surfaceRaised, border: c.border, fg: c.textPrimary },
    selected: { bg: c.primarySoft, border: c.primary, fg: c.primary },
    correct: { bg: c.successSoft, border: c.success, fg: c.successLip },
    wrong: { bg: c.dangerSoft, border: c.danger, fg: c.danger },
    disabled: { bg: c.surfaceSunken, border: c.border, fg: c.textSecondary },
  }[state];

  return (
    <Animated.View style={[motion, containerStyle]}>
      <PressableScale
        onPress={onPress}
        disabled={state === 'disabled' || state === 'correct'}
        accessibilityRole="button"
        accessibilityState={{ selected: state === 'selected' }}
        accessibilityLabel={sub ? `${label}, ${sub}` : label}
        style={[styles.tile, { backgroundColor: tone.bg, borderColor: tone.border, borderRadius: radius.md }, style]}
      >
        <View style={styles.center}>
          <Text style={[hanzi ? type.hanzi : type.body, { color: tone.fg, fontSize: hanzi ? 24 : 17, lineHeight: hanzi ? 32 : 22, textAlign: 'center' }]}>
            {label}
          </Text>
          {sub ? <Text style={[type.caption, { color: c.textSecondary }]}>{sub}</Text> : null}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: { borderWidth: 2, borderBottomWidth: 2 + lip, paddingVertical: 12, paddingHorizontal: 14, justifyContent: 'center' },
  center: { alignItems: 'center' },
});
