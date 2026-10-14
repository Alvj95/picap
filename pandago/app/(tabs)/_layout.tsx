import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '@/theme';

const icon = (emoji: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 26, opacity: focused ? 1 : 0.45, transform: [{ scale: focused ? 1.1 : 1 }] }}>{emoji}</Text>;
  };

export default function TabsLayout() {
  const { c, type } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textSecondary,
        tabBarLabelStyle: { fontFamily: type.caption.fontFamily, fontSize: 11 },
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, borderTopWidth: 2, height: 72, paddingTop: 6 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Aprender', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="practice" options={{ title: 'Hablar', tabBarIcon: icon('💬') }} />
      <Tabs.Screen name="leagues" options={{ title: 'Ligas', tabBarIcon: icon('🏮') }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: icon('🐼') }} />
    </Tabs>
  );
}
