import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extiende app.json con valores del entorno de compilación:
 * - EXPO_BASE_URL: subruta donde se sirve la web (GitHub Pages → "/pandago").
 * - EXPO_PUBLIC_API_URL: URL del backend del tutor IA.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL ?? '' },
  extra: { ...config.extra, apiUrl: process.env.EXPO_PUBLIC_API_URL ?? config.extra?.apiUrl },
});
