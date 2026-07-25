/**
 * Keep MinimizedWorkoutBar offset aligned with React Navigation's default
 * bottom tab bar: UIKit content height (49) + safe-area bottom inset.
 *
 * Do not also force height/paddingBottom in tabBarStyle — BottomTabBar already
 * applies insets.bottom. Extra padding was leaving a dead strip under the icons.
 */
export const TAB_ICON_SIZE = 24;
/** Matches @react-navigation/bottom-tabs TABBAR_HEIGHT_UIKIT */
export const TAB_BAR_CONTENT_HEIGHT = 49;

export function getTabBarHeight(_isWeb: boolean, safeAreaBottom: number): number {
  return TAB_BAR_CONTENT_HEIGHT + Math.max(0, safeAreaBottom);
}
