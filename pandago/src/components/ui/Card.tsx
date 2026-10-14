import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { lip, useTheme } from '@/theme';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Índice para escalonar la entrada (stagger) en listas. */
  index?: number;
  tint?: string;
}

/** Tarjeta flotante: esquinas grandes, borde suave y labio 3D. Entra con fade + slide. */
export function Card({ children, style, index = 0, tint }: Props) {
  const { c, radius, spacing } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(80 * index).springify().damping(16)}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: tint ?? c.surfaceRaised,
            borderColor: c.border,
            borderBottomColor: c.border,
            borderRadius: radius.lg,
            padding: spacing.md,
            shadowColor: c.shadow,
          },
          style,
        ]}
      >
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderBottomWidth: 2 + lip,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 3,
  },
});
