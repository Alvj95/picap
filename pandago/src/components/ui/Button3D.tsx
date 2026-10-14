import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { feedback } from '@/lib/haptics';
import { lip, useTheme } from '@/theme';

type Variant = 'primary' | 'success' | 'danger' | 'ghost';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
}

/**
 * Botón "táctil" con labio inferior: al presionar, la cara baja `lip` px y
 * tapa el labio, imitando una tecla física (patrón Duolingo).
 */
export function Button3D({ label, onPress, variant = 'primary', disabled }: Props) {
  const { c, radius, type } = useTheme();
  const pressed = useSharedValue(0);

  const tone = {
    primary: { face: c.primary, lip: c.primaryLip, text: c.textOnBrand },
    success: { face: c.success, lip: c.successLip, text: c.textOnBrand },
    danger: { face: c.danger, lip: c.dangerLip, text: c.textOnBrand },
    ghost: { face: c.surface, lip: c.border, text: c.textSecondary },
  }[disabled ? 'ghost' : variant];

  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pressed.value * lip }] }));

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={() => {
        pressed.set(withTiming(1, { duration: 70 }));
        void feedback.press();
      }}
      onPressOut={() => {
        pressed.set(withTiming(0, { duration: 110 }));
      }}
      onPress={onPress}
    >
      <View style={[styles.lip, { backgroundColor: tone.lip, borderRadius: radius.md }]}>
        <Animated.View style={[styles.face, { backgroundColor: tone.face, borderRadius: radius.md }, faceStyle]}>
          <Text style={[type.title, styles.label, { color: tone.text }]}>{label}</Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lip: { paddingBottom: lip },
  face: { height: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, marginTop: 0 },
  label: { fontSize: 16, letterSpacing: 0.8, textTransform: 'uppercase' },
});
