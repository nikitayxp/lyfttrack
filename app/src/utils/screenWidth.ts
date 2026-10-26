import { Platform } from 'react-native';
import { DEVICE_FRAME } from '@/constants/deviceFrame';

const DEVICE_MOCKUP_WIDTH = DEVICE_FRAME.width;
const DEVICE_MOCKUP_MIN_WINDOW_WIDTH = DEVICE_FRAME.minWindowWidth;
/** The scrollbar and the mockup border eat into the width a screen really gets. */
const WEB_CHROME_ALLOWANCE = 32;

/**
 * The width a screen actually has, which on a desktop browser is not the
 * window: the app draws inside a phone-sized frame there, so anything sizing
 * itself against `useWindowDimensions` comes out wider than the card holding
 * it and spills over the edge.
 */
export function usableScreenWidth(windowWidth: number): number {
  if (Platform.OS !== 'web') {
    return windowWidth;
  }

  const base =
    windowWidth > DEVICE_MOCKUP_MIN_WINDOW_WIDTH ? DEVICE_MOCKUP_WIDTH : windowWidth;

  return Math.max(240, base - WEB_CHROME_ALLOWANCE);
}
