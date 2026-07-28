import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

export type ShareWorkoutInput = {
  title: string;
  /** Already-localised summary line, e.g. "12 sets - 6 exercises". */
  summary: string;
  url: string;
};

export type ShareOutcome = 'shared' | 'dismissed' | 'unavailable';

export function buildShareMessage(input: ShareWorkoutInput): string {
  return `${input.title}\n${input.summary}\n${input.url}`;
}

/** Whether a share sheet exists at all, so the UI can offer it or not. */
export function canOpenShareSheet(): boolean {
  if (Platform.OS !== 'web') {
    return true;
  }

  return typeof navigator !== 'undefined' && Boolean(navigator.share);
}

/**
 * Copy that works on native and on LAN http (no secure Clipboard API).
 *
 * Call this while the user gesture / share sheet is still open — closing a
 * Modal first drops focus and makes execCommand report success while leaving
 * the clipboard empty (Brave/Android web).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    // Fall through: expo-clipboard uses navigator.clipboard on web, which is
    // missing on plain http (Tailscale/LAN hostname).
  }

  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return false;
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    // Keep in-viewport and focusable — off-screen + no focus is a common
    // "returns true, copies nothing" path on mobile browsers.
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (!copied) {
      return false;
    }

    // Secure contexts can verify; LAN http cannot.
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      try {
        return (await navigator.clipboard.readText()) === text;
      } catch {
        return true;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/** Opens the platform share sheet. Only called once the user asked for it. */
export async function openShareSheet(input: ShareWorkoutInput): Promise<ShareOutcome> {
  const message = buildShareMessage(input);

  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.share) {
      return 'unavailable';
    }

    try {
      await navigator.share({
        title: input.title,
        text: `${input.title}\n${input.summary}`,
        url: input.url,
      });
      return 'shared';
    } catch (error) {
      // AbortError is the user closing the sheet, not a failure.
      return error instanceof Error && error.name === 'AbortError' ? 'dismissed' : 'unavailable';
    }
  }

  try {
    const result = await Share.share({ title: input.title, message });
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return 'unavailable';
  }
}
