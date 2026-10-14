/**
 * Design tokens de PandaGO!
 * Paleta inspirada en el panda rojo (Bao): naranja óxido + crema + bambú.
 * Cada color semántico existe en claro y oscuro; los componentes NUNCA usan hex directos.
 */

export const palette = {
  // Marca
  ember500: '#FF6B2C', // naranja Bao (CTA primario)
  ember600: '#E5541A', // "labio" inferior del botón 3D
  ember100: '#FFE7DA',
  bamboo500: '#3CCB6F', // acierto
  bamboo600: '#2BA857',
  bamboo100: '#DDF7E6',
  cherry500: '#FF4B5C', // error / vidas
  cherry600: '#D93545',
  cherry100: '#FFE1E4',
  gold500: '#FFC233', // XP, cofres, coronas
  gold600: '#E0A100',
  sky500: '#3DA9FC', // racha de hielo, info
  sky600: '#1E88DB',
  violet500: '#8B5CF6', // ligas
  flame500: '#FF9600', // racha

  // Neutros
  ink900: '#1B1F2A',
  ink800: '#242938',
  ink700: '#2F3547',
  ink500: '#5B6277',
  ink300: '#A3A9BA',
  cloud200: '#E8EAF0',
  cloud100: '#F3F4F8',
  white: '#FFFFFF',
} as const;

export type ColorScheme = 'light' | 'dark';

type ColorRole =
  | 'background' | 'surface' | 'surfaceRaised' | 'surfaceSunken' | 'border'
  | 'textPrimary' | 'textSecondary' | 'textOnBrand'
  | 'primary' | 'primaryLip' | 'primarySoft'
  | 'success' | 'successLip' | 'successSoft'
  | 'danger' | 'dangerLip' | 'dangerSoft'
  | 'xp' | 'xpLip' | 'xpText' | 'streak' | 'league' | 'info' | 'locked' | 'lockedLip' | 'shadow';

const light: Record<ColorRole, string> = {
  background: palette.cloud100,
  surface: palette.white,
  surfaceRaised: palette.white,
  surfaceSunken: palette.cloud200,
  border: palette.cloud200,
  textPrimary: palette.ink900,
  textSecondary: palette.ink500,
  textOnBrand: palette.white,
  primary: palette.ember500,
  primaryLip: palette.ember600,
  primarySoft: palette.ember100,
  success: palette.bamboo500,
  successLip: palette.bamboo600,
  successSoft: palette.bamboo100,
  danger: palette.cherry500,
  dangerLip: palette.cherry600,
  dangerSoft: palette.cherry100,
  xp: palette.gold500,
  xpLip: palette.gold600,
  xpText: '#946500', // dorado con contraste AA (≥4.5:1) sobre fondo claro
  streak: palette.flame500,
  league: palette.violet500,
  info: palette.sky500,
  locked: palette.cloud200,
  lockedLip: '#CDD1DC',
  shadow: 'rgba(27,31,42,0.10)',
};

const dark: Record<ColorRole, string> = {
  background: '#11141C',
  surface: palette.ink900,
  surfaceRaised: palette.ink800,
  surfaceSunken: '#0B0D13',
  border: palette.ink700,
  textPrimary: '#F5F6FA',
  textSecondary: palette.ink300,
  textOnBrand: palette.white,
  primary: palette.ember500,
  primaryLip: '#B8420F',
  primarySoft: 'rgba(255,107,44,0.16)',
  success: palette.bamboo500,
  successLip: '#1F7E41',
  successSoft: 'rgba(60,203,111,0.16)',
  danger: palette.cherry500,
  dangerLip: '#A82231',
  dangerSoft: 'rgba(255,75,92,0.16)',
  xp: palette.gold500,
  xpLip: '#A87800',
  xpText: palette.gold500,
  streak: palette.flame500,
  league: palette.violet500,
  info: palette.sky500,
  locked: palette.ink700,
  lockedLip: '#1E2230',
  shadow: 'rgba(0,0,0,0.45)',
};

export const colors = { light, dark };
export type ThemeColors = Record<ColorRole, string>;

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 } as const;

export const radius = { sm: 12, md: 16, lg: 24, xl: 32, pill: 999 } as const;

/** Altura del "labio" de los botones/tarjetas 3D al estilo Duolingo. */
export const lip = 4;

export const typography = {
  // Nunito para latín (redonda y amigable) + Noto Sans SC para hanzi.
  display: { fontFamily: 'Nunito_900Black', fontSize: 28, lineHeight: 34 },
  title: { fontFamily: 'Nunito_800ExtraBold', fontSize: 20, lineHeight: 26 },
  body: { fontFamily: 'Nunito_600SemiBold', fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: 'Nunito_700Bold', fontSize: 13, lineHeight: 18 },
  hanzi: { fontFamily: 'NotoSansSC_700Bold', fontSize: 32, lineHeight: 40 },
} as const;

/** Duraciones/curvas compartidas para que todas las microinteracciones se sientan iguales. */
export const motion = {
  pressInScale: 0.96,
  spring: { damping: 14, stiffness: 220, mass: 0.8 },
  bouncy: { damping: 8, stiffness: 260, mass: 0.7 },
  fast: 140,
  base: 240,
  slow: 420,
} as const;
