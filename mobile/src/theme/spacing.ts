/**
 * Spacing system — base 4px (grille 8pt stricte)
 * Adapte pour mobile (touch targets Apple HIG / Material Design)
 */

const BASE = 4;

export const spacing = (factor: number): number => factor * BASE;

export const SPACING = {
  xs: spacing(1),    // 4
  sm: spacing(2),    // 8
  md: spacing(3),    // 12
  lg: spacing(4),    // 16
  xl: spacing(5),    // 20
  '2xl': spacing(6), // 24
  '3xl': spacing(8), // 32
  '4xl': spacing(10), // 40
  '5xl': spacing(12), // 48
  '6xl': spacing(16), // 64
} as const;

/** Minimum touch target sizes (Apple HIG / Material Design) */
export const TOUCH_TARGET = {
  minHeight: 44,
  minWidth: 44,
} as const;

export const BORDER_RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;
