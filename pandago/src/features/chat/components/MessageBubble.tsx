import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Speech from 'expo-speech';
import { useTheme } from '@/theme';
import type { ChatMessage } from '../engine/orchestrator';

/** Burbuja de chat. Las del tutor: tocar = escuchar (TTS zh-CN), mantener = ver traducción. */
export function MessageBubble({ message }: { message: ChatMessage }) {
  const { c, radius, type, spacing } = useTheme();
  const [showTranslation, setShowTranslation] = useState(false);

  if (message.from === 'system') {
    return <Text style={[type.caption, { color: c.textSecondary, textAlign: 'center' }]}>{message.text}</Text>;
  }

  if (message.from === 'user') {
    const s = message.pronunciationScore;
    return (
      <Animated.View entering={FadeInUp.springify()} style={[styles.user, { backgroundColor: c.primary, borderRadius: radius.md, padding: spacing.sm }]}>
        <Text style={[type.body, { color: c.textOnBrand }]}>{message.text}</Text>
        {s !== undefined && (
          <Text style={[type.caption, { color: c.textOnBrand, opacity: 0.9 }]}>🎙️ Pronunciación {Math.round(s * 100)}%</Text>
        )}
      </Animated.View>
    );
  }

  const { reply, corrections, hint } = message.turn;
  return (
    <Animated.View entering={FadeInUp.springify()} style={{ gap: spacing.xs, maxWidth: '86%' }}>
      <Pressable
        onPress={() => Speech.speak(reply.hanzi, { language: 'zh-CN', rate: 0.85 })}
        onLongPress={() => setShowTranslation((v) => !v)}
        accessibilityHint="Toca para escuchar, mantén pulsado para ver la traducción"
        style={[styles.tutor, { backgroundColor: c.surfaceRaised, borderColor: c.border, borderRadius: radius.md, padding: spacing.sm }]}
      >
        <Text style={[type.hanzi, { color: c.textPrimary, fontSize: 24, lineHeight: 32 }]}>{reply.hanzi} 🔊</Text>
        <Text style={[type.caption, { color: c.textSecondary }]}>{reply.pinyin}</Text>
        {showTranslation && <Text style={[type.body, { color: c.textSecondary, marginTop: 4 }]}>{reply.translation}</Text>}
      </Pressable>

      {corrections.map((corr, i) => (
        <View key={i} style={[styles.correction, { backgroundColor: c.successSoft, borderColor: c.success, borderRadius: radius.sm, padding: spacing.xs }]}>
          <Text style={[type.caption, { color: c.textSecondary, textDecorationLine: 'line-through' }]}>{corr.original}</Text>
          <Text style={[type.body, { color: c.successLip }]}>✓ {corr.corrected}</Text>
          <Text style={[type.caption, { color: c.textPrimary }]}>{corr.explanation}</Text>
        </View>
      ))}

      {hint && <Text style={[type.caption, { color: c.info }]}>💡 {hint}</Text>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  user: { alignSelf: 'flex-end', maxWidth: '80%' },
  tutor: { borderWidth: 2, borderBottomWidth: 4 },
  correction: { borderWidth: 1.5 },
});
