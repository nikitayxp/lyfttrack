import { Platform } from 'react-native';

type Palette = {
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

const lightPalette: Palette = {
  text: '#101828',
  background: '#F8FAFC',
  tint: '#007AFF',
  icon: '#64748B',
  tabIconDefault: '#64748B',
  tabIconSelected: '#007AFF',
  textPrimary: '#101828',
  textSecondary: '#344054',
  textMuted: '#667085',
  bgPrimary: '#F8FAFC',
  bgAlt: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  border: '#D0D5DD',
  borderStrong: '#98A2B3',
  accent: '#007AFF',
  accentSoft: '#DCEBFF',
  inputBackground: '#FFFFFF',
  inputBorder: '#D0D5DD',
  tabBarBackground: '#FFFFFF',
  overlay: 'rgba(7, 18, 37, 0.5)',
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
};

const darkPalette: Palette = {
  text: '#FFFFFF',
  background: '#050A12',
  tint: '#007AFF',
  icon: '#8FA1BF',
  tabIconDefault: '#8FA1BF',
  tabIconSelected: '#007AFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#C5CFDF',
  textMuted: '#8A97AD',
  bgPrimary: '#050A12',
  bgAlt: '#050A12',
  surface: '#111827',
  surfaceAlt: '#1F2937',
  border: '#1F2A3D',
  borderStrong: '#2B3950',
  accent: '#007AFF',
  accentSoft: '#12335E',
  inputBackground: '#111827',
  inputBorder: '#2B3950',
  tabBarBackground: '#050A12',
  overlay: 'rgba(0, 0, 0, 0.75)',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
};

export const Colors = {
  light: lightPalette,
  dark: darkPalette,
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
