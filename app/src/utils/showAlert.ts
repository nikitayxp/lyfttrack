import { Alert, Platform } from 'react-native';
import type { AppToastTone } from '@/context/ToastContext';

type ShowToastFn = (payload: { message: string; tone?: AppToastTone }) => void;

/**
 * Alert.alert() is a no-op on react-native-web — title and message just
 * vanish, so validation errors and success confirmations went unseen on web.
 * Native keeps the real Alert; web falls back to the same toast used
 * everywhere else in the app instead of window.alert, to stay on-theme.
 */
export function showAlert(
  showToast: ShowToastFn,
  title: string,
  message?: string | null,
  tone: AppToastTone = 'info'
): void {
  if (Platform.OS === 'web') {
    showToast({ message: message?.trim() ? message : title, tone });
    return;
  }

  Alert.alert(title, message ?? undefined);
}
