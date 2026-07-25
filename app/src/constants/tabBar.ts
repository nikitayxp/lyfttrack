import { Platform } from 'react-native';

/** Keep tab bar + minimized workout bar in sync. */
export const WEB_MOBILE_TAB_BAR_HEIGHT = 74;
export const TAB_ICON_SIZE = 24;
export const TAB_BAR_TOP_PADDING = 8;

export function getNativeBottomInset(safeAreaBottom: number): number {
  return Math.max(safeAreaBottom, 10);
}

export function getTabBarHeight(isWeb: boolean, safeAreaBottom: number): number {
  if (isWeb) {
    return WEB_MOBILE_TAB_BAR_HEIGHT;
  }

  const nativeBottomInset = getNativeBottomInset(safeAreaBottom);
  const base = Platform.OS === 'ios' ? 72 : 64;
  return base + nativeBottomInset;
}

export function getTabBarBottomPadding(isWeb: boolean, safeAreaBottom: number): number {
  if (isWeb) {
    return 12;
  }

  return Math.max(getNativeBottomInset(safeAreaBottom) - 2, 10);
}
