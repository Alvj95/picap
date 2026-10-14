import * as Haptics from 'expo-haptics';

/**
 * Vocabulario háptico único de la app. Las pantallas piden *intenciones*
 * ("correct", "wrong") y no estilos de vibración concretos.
 */
export const feedback = {
  tap: () => Haptics.selectionAsync(),
  press: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  correct: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  wrong: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  levelUp: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
};
