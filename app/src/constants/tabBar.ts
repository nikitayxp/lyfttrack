/**
 * YouTube / Material-style bottom nav: compact icon+label row (~56),
 * plus real safe-area inset only (no fake empty strip under labels).
 *
 * On web, browser chrome is padded at the root via visualViewport — not inside this bar.
 */
export const TAB_ICON_SIZE = 24;
/** Material bottom navigation content row (matches YouTube-like density). */
export const TAB_BAR_ROW_HEIGHT = 56;
export const TAB_BAR_TOP_PADDING = 0;

export function getTabBarBottomPadding(isWeb: boolean, safeAreaBottom: number): number {
  if (isWeb) {
    return 0;
  }

  return Math.max(0, safeAreaBottom);
}

export function getTabBarHeight(isWeb: boolean, safeAreaBottom: number): number {
  return TAB_BAR_ROW_HEIGHT + getTabBarBottomPadding(isWeb, safeAreaBottom);
}
