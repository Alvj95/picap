import { createContext, useContext } from 'react';
import type { ThemePreference } from '@/store/useSettingsStore';
import type { ColorScheme, motion, radius, spacing, ThemeColors, typography } from './tokens';

export interface Theme {
  scheme: ColorScheme;
  c: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  type: typeof typography;
  motion: typeof motion;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

export const ThemeContext = createContext<Theme | null>(null);

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return theme;
}
