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
 * Copy that also works where the async Clipboard API does not.
 *
 * navigator.clipboard only exists in a secure context, so it is missing over
 * plain http — which is exactly how the app is reached on a LAN address during
 * development, and where the previous version silently gave up. The deprecated
 * execCommand path still works there, so it is kept as the fallback rather than
 * reporting failure.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (Platform.OS !== 'web') {
    return false;
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or blocked: fall through to the legacy path.
    }
  }

  if (typeof document === 'undefined') {
    return false;
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);

    return copied;
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
