import { router } from 'expo-router';

/**
 * router.back() does nothing when there is no history — a link, a refresh on
 * web, or the first screen after signing in all leave the stack empty, and the
 * button reads as dead. Every back has to name where it lands instead.
 */
export function goBack(fallback = '/(tabs)') {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback as any);
}
