import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaoBubble } from '@/components/mascot';
import { Button3D } from '@/components/ui';
import { useTheme } from '@/theme';

export function ComingSoon({ title }: { title: string }) {
  const { c, type, spacing } = useTheme();
  const router = useRouter();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.background, padding: spacing.md, gap: spacing.lg }]}>
      <Text style={[type.display, { color: c.textPrimary }]}>{title}</Text>
      <View style={styles.flex}>
        <BaoBubble message="¡Estoy preparando esta sección! Vuelve pronto 🎋" mood="thinking" />
      </View>
      {router.canGoBack() && <Button3D label="Volver" variant="ghost" onPress={() => router.back()} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
