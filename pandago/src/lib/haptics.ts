import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store/useSettingsStore';

/** Respeta el ajuste del usuario sin que cada pantalla tenga que comprobarlo. */
const enabled = () => useSettingsStore.getState().haptics;
const guard =
  <A extends unknown[]>(fn: (...a: A) => Promise<void>) =>
  async (...a: A) => {
    if (enabled()) await fn(...a);
  };

/**
 * Vocabulario háptico único de la app. Las pantallas piden *intenciones*
 * ("correct", "wrong") y no estilos de vibración concretos.
 */
export const feedback = {
  tap: guard(() => Haptics.selectionAsync()),
  press: guard(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  correct: guard(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  wrong: guard(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  levelUp: guard(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }),
};
