import { Platform, Share } from 'react-native';

export type ShareWorkoutInput = {
  title: string;
  /** Already-localised summary line, e.g. "12 sets · 6 exercises". */
  summary: string;
  url: string;
};

export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'unavailable';

export function buildShareMessage(input: ShareWorkoutInput): string {
  return `${input.title}\n${input.summary}\n${input.url}`;
}

/**
 * One entry point for the three ways a platform will let us share.
 *
 * React Native's Share is not implemented on web, so calling it there fails
 * silently and the button looks broken. Web goes through the Web Share API when
 * the browser has it — it is missing on desktop Firefox and on any page not
 * served over https — and falls back to the clipboard, which is a worse but
 * honest outcome the caller can report.
 */
export async function shareWorkout(input: ShareWorkoutInput): Promise<ShareOutcome> {
  const message = buildShareMessage(input);

  if (Platform.OS === 'web') {
    const nav = typeof navigator === 'undefined' ? undefined : navigator;

    if (nav?.share) {
      try {
        await nav.share({ title: input.title, text: `${input.title}\n${input.summary}`, url: input.url });
        return 'shared';
      } catch (error) {
        // AbortError is the user closing the sheet, not a failure.
        if (error instanceof Error && error.name === 'AbortError') {
          return 'dismissed';
        }
      }
    }

    if (nav?.clipboard?.writeText) {
      try {
        await nav.clipboard.writeText(message);
        return 'copied';
      } catch {
        return 'unavailable';
      }
    }

    return 'unavailable';
  }

  try {
    const result = await Share.share({ title: input.title, message });
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return 'unavailable';
  }
}
