export type Palette = {
  text: string;
  background: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  bgPrimary: string;
  bgAlt: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentSoft: string;
  inputBackground: string;
  inputBorder: string;
  tabBarBackground: string;
  overlay: string;
  success: string;
  warning: string;
  error: string;
};

const heavyPalette: Palette = {
  text: '#FFFFFF',
  background: '#000000',
  tint: '#3B82F6',
  icon: '#A1A1AA',
  tabIconDefault: '#71717A',
  tabIconSelected: '#3B82F6',
  textPrimary: '#FFFFFF',
  textSecondary: '#D4D4D8',
  textMuted: '#A1A1AA',
  bgPrimary: '#000000',
  bgAlt: '#000000',
  surface: '#111111',
  surfaceAlt: '#18181B',
  border: '#27272A',
  borderStrong: '#3F3F46',
  accent: '#3B82F6',
  accentSoft: '#172554',
  inputBackground: '#111111',
  inputBorder: '#27272A',
  tabBarBackground: '#000000',
  overlay: 'rgba(0, 0, 0, 0.88)',
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
};

export const Colors: { light: Palette; dark: Palette } = {
  // Keep light available for compatibility while enforcing Heavy OLED visuals app-wide.
  light: heavyPalette,
  dark: heavyPalette,
};
