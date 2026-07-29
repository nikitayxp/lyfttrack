import { Platform } from 'react-native';

const WEB_APP_URL_FALLBACK = 'https://lyfttrack-app.vercel.app';

function removeTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

/**
 * The link a shared workout points at.
 *
 * On web the current origin is right by construction, including preview
 * deployments. On device there is no origin, so it falls back to the deployed
 * web app rather than a deep link: the person receiving the message is opening
 * it on someone else's phone, where a lyfttrack:// URL resolves to nothing.
 */
export function buildWorkoutUrl(workoutId: string): string {
  const base =
    Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
      ? removeTrailingSlashes(window.location.origin)
      : removeTrailingSlashes(process.env.EXPO_PUBLIC_AUTH_WEB_URL?.trim() || WEB_APP_URL_FALLBACK);

  return `${base}/workout/${workoutId}`;
}
