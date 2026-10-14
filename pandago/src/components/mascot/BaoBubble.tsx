import { StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { Bao } from './Bao';
import type { BaoMood } from './types';

interface Props {
  message: string;
  mood?: BaoMood;
  /** Línea opcional en hanzi + pinyin bajo el mensaje. */
  hanzi?: string;
  pinyin?: string;
}

/** Bao + bocadillo de diálogo. Se usa en Home (tip del día), lecciones y chat. */
export function BaoBubble({ message, mood = 'talking', hanzi, pinyin }: Props) {
  const { c, radius, type, spacing } = useTheme();
  return (
    <View style={[styles.row, { gap: spacing.sm }]}>
      <Bao mood={mood} size={72} />
      <Animated.View
        key={message}
        entering={ZoomIn.springify().damping(14)}
        style={[styles.bubble, { backgroundColor: c.surfaceRaised, borderColor: c.border, borderRadius: radius.md, padding: spacing.sm }]}
      >
        <View style={[styles.tail, { borderRightColor: c.border }]} />
        <Text style={[type.body, { color: c.textPrimary }]}>{message}</Text>
        {hanzi && (
          <Text style={[type.hanzi, { color: c.primary, fontSize: 22, lineHeight: 28, marginTop: 4 }]}>
            {hanzi} <Text style={[type.caption, { color: c.textSecondary }]}>{pinyin}</Text>
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  bubble: { flex: 1, borderWidth: 2 },
  tail: {
    position: 'absolute',
    left: -10,
    top: '50%',
    marginTop: -8,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
});
