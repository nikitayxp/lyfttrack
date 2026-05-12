import type { TextStyle, ViewStyle } from 'react-native';
import { Platform } from 'react-native';

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
} as const;

export const Radius = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 14,
  card: 14,
  button: 12,
  input: 10,
  sheet: 20,
  pill: 999,
} as const;

export const ACTIVE_OPACITY = 0.78;

export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

export const Shadows: Record<'card' | 'elevated' | 'none', ViewStyle> = {
  card: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
    },
    android: { elevation: 3 },
    default: {},
  }) as ViewStyle,
  elevated: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
    },
    android: { elevation: 12 },
    default: {},
  }) as ViewStyle,
  none: {},
};

export const Typography: Record<
  'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'bodyBold' | 'bodySm' | 'bodySmBold' | 'label' | 'caption' | 'numeric' | 'chip',
  TextStyle
> = {
  h1: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  h2: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  h3: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  h4: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  bodyBold: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  bodySm: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  bodySmBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  numeric: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  chip: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
};
