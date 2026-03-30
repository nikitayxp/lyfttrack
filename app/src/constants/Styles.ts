import type { TextStyle } from 'react-native';

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
  sm: 8,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const Typography: Record<
  'h1' | 'h2' | 'h3' | 'body' | 'bodyBold' | 'label' | 'caption',
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
  label: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
};
