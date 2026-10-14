import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { PressableScale } from './PressableScale';

interface Props<T extends string | number> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel: string;
}

/** Control segmentado con el mismo lenguaje táctil (labio + resorte) que el resto de la app. */
export function Segmented<T extends string | number>({ options, value, onChange, accessibilityLabel }: Props<T>) {
  const { c, radius, type, spacing } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={[styles.row, { backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: 4, gap: 4 }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={o.label}
            containerStyle={styles.flex}
            style={[
              styles.item,
              { borderRadius: radius.sm, paddingVertical: spacing.xs, backgroundColor: active ? c.surfaceRaised : 'transparent', borderColor: active ? c.primary : 'transparent' },
            ]}
          >
            <Text style={[type.caption, { color: active ? c.primary : c.textSecondary }]}>{o.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
  item: { alignItems: 'center', borderWidth: 2 },
});
