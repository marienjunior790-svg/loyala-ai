/** Loyala design tokens — Blueprint mobile-first, dark mode */
export const colors = {
  background: '#0A0A0A',
  surface: '#141414',
  surfaceLight: '#1E1E1E',
  primary: '#00C853',
  primaryDark: '#00A844',
  navy: '#1B3A5C',
  accent: '#0066FF',
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#666666',
  border: '#2A2A2A',
  error: '#FF4444',
  warning: '#FFAA00',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

export const touchTarget = 44;
