import { useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useSettingsStore } from '@/store/useSettingsStore';
import { ThemeContext, type Theme } from './ThemeContext';
import { colors, motion, radius, spacing, typography, type ColorScheme } from './tokens';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  // Persistido: la elección del usuario sobrevive a reinicios.
  const preference = useSettingsStore((st) => st.theme);
  const setPreference = useSettingsStore((st) => st.setTheme);
  const scheme: ColorScheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<Theme>(
    () => ({ scheme, c: colors[scheme], spacing, radius, type: typography, motion, preference, setPreference }),
    [scheme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
