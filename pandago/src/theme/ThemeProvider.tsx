import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { colors, motion, radius, spacing, typography, type ColorScheme, type ThemeColors } from './tokens';

type Preference = ColorScheme | 'system';

interface Theme {
  scheme: ColorScheme;
  c: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  type: typeof typography;
  motion: typeof motion;
  preference: Preference;
  setPreference: (p: Preference) => void;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<Preference>('system');
  const scheme: ColorScheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<Theme>(
    () => ({ scheme, c: colors[scheme], spacing, radius, type: typography, motion, preference, setPreference }),
    [scheme, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return theme;
}
