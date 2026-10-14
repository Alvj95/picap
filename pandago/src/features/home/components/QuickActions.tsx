import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/components/ui';
import { lip, useTheme } from '@/theme';

interface Action {
  key: string;
  icon: string;
  title: string;
  subtitle: string;
  tone: 'primary' | 'info' | 'success';
}

const ACTIONS: Action[] = [
  { key: 'chat', icon: '💬', title: 'Charla IA', subtitle: 'Con Bao', tone: 'primary' },
  { key: 'voice', icon: '🎙️', title: 'Pronuncia', subtitle: 'Tonos en vivo', tone: 'info' },
  { key: 'review', icon: '🧠', title: 'Repaso', subtitle: '12 palabras', tone: 'success' },
];

/** Accesos rápidos a los modos clave, con el módulo de conversación IA destacado primero. */
export function QuickActions({ onPress }: { onPress: (key: string) => void }) {
  const { c, radius, type, spacing } = useTheme();
  const tones = {
    primary: [c.primarySoft, c.primary],
    info: ['rgba(61,169,252,0.16)', c.info],
    success: [c.successSoft, c.success],
  } as const;

  return (
    <View style={[styles.row, { gap: spacing.sm }]}>
      {ACTIONS.map((a) => {
        const [bg, fg] = tones[a.tone];
        return (
          <PressableScale
            key={a.key}
            onPress={() => onPress(a.key)}
            accessibilityRole="button"
            accessibilityLabel={a.title}
            containerStyle={styles.flex}
            style={[
              styles.tile,
              { backgroundColor: bg, borderColor: fg, borderRadius: radius.lg, padding: spacing.sm },
            ]}
          >
            <Text style={styles.icon}>{a.icon}</Text>
            <Text style={[type.caption, { color: fg }]} numberOfLines={1}>
              {a.title}
            </Text>
            <Text style={[type.caption, { color: c.textSecondary, fontSize: 11 }]} numberOfLines={1}>
              {a.subtitle}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
  tile: { borderWidth: 2, borderBottomWidth: 2 + lip, alignItems: 'center' },
  icon: { fontSize: 28, marginBottom: 4 },
});
