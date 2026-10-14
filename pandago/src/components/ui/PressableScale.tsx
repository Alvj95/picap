import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { feedback } from '@/lib/haptics';
import { motion } from '@/theme';

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  /** Estilo de layout del contenedor táctil (p.ej. `flex: 1` dentro de una fila). */
  containerStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** Escala al presionar (por defecto la del sistema de motion). */
  scaleTo?: number;
  haptic?: boolean;
}

/** Primitiva base de toda interacción táctil: encoge con resorte + haptic ligero. */
export function PressableScale({ style, containerStyle, children, scaleTo = motion.pressInScale, haptic = true, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      {...rest}
      style={containerStyle}
      onPressIn={(e) => {
        scale.set(withSpring(scaleTo, motion.spring));
        if (haptic) void feedback.press();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, motion.bouncy));
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[animated, style]}>{children}</Animated.View>
    </Pressable>
  );
}
