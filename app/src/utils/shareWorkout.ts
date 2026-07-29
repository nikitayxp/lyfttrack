import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';

export type ShareWorkoutInput = {
  title: string;
  /** Already-localised summary line, e.g. "12 sets - 6 exercises". */
  summary: string;
  url: string;
};

export function buildShareMessage(input: ShareWorkoutInput): string {
  return `${input.title}\n${input.summary}\n${input.url}`;
}

function copyViaDomEvent(text: string): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  let wrote = false;

  const onCopy = (event: ClipboardEvent) => {
    event.preventDefault();
    event.clipboardData?.setData('text/plain', text);
    wrote = Boolean(event.clipboardData);
  };

  document.addEventListener('copy', onCopy);
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2px';
    textarea.style.height = '2px';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.opacity = '0';

    const modalRoot =
      document.querySelector('[aria-modal="true"]') ??
      document.querySelector('[role="dialog"]') ??
      document.body;

    modalRoot.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    const triggered = document.execCommand('copy');
    modalRoot.removeChild(textarea);

    return triggered && wrote;
  } catch {
    return false;
  } finally {
    document.removeEventListener('copy', onCopy);
  }
}

/**
 * Prefer the DOM copy path on web — Clipboard API often pops a second system
 * toast (Brave/Chrome). Native uses expo-clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (copyViaDomEvent(text)) {
      return true;
    }

    try {
      await Clipboard.setStringAsync(text);
      return true;
    } catch {
      return false;
    }
  }

  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}
