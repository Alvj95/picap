import type { useRouter } from 'expo-router';

/** Cierra una pantalla modal; si se abrió por deep link (sin historial), vuelve a la Home. */
export function exitTo(router: ReturnType<typeof useRouter>) {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
