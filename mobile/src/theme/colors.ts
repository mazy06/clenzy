/**
 * Palette Clenzy Premium — Design System v2
 *
 * Philosophie :
 * - Bleu-gris Clenzy comme couleur principale → identite visuelle logo
 * - Dore sparkle comme accent secondaire → elegance, premium
 * - Echelle de gris Slate neutre → lisibilite maximale
 * - Couleurs semantiques vives mais non agressives
 * - Opacites calibrees pour les surfaces subtiles
 */

export const colors = {
  primary: {
    main: '#4A7C8E',
    light: '#6DA3B4',
    dark: '#3D6B7A',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#C8924A',
    light: '#D4A65A',
    dark: '#A07438',
    contrastText: '#FFFFFF',
  },
  success: {
    main: '#059669',
    light: '#34D399',
    dark: '#047857',
    contrastText: '#FFFFFF',
  },
  warning: {
    main: '#D97706',
    light: '#FBBF24',
    dark: '#B45309',
    contrastText: '#FFFFFF',
  },
  error: {
    main: '#DC2626',
    light: '#F87171',
    dark: '#B91C1C',
    contrastText: '#FFFFFF',
  },
  info: {
    main: '#2563EB',
    light: '#60A5FA',
    dark: '#1D4ED8',
    contrastText: '#FFFFFF',
  },
  neutral: {
    main: '#64748B',
    light: '#94A3B8',
    dark: '#475569',
    contrastText: '#FFFFFF',
  },
  grey: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
  background: {
    default: '#F8FAFC',
    paper: '#FFFFFF',
    surface: '#F1F5F9',
  },
  text: {
    primary: '#0F172A',
    secondary: '#64748B',
    disabled: '#94A3B8',
    inverse: '#FFFFFF',
  },
  border: {
    light: '#F1F5F9',
    main: '#E2E8F0',
    dark: '#CBD5E1',
  },
} as const;

export const darkColors = {
  primary: {
    main: '#6DA3B4',
    light: '#89BCC9',
    dark: '#4A7C8E',
    contrastText: '#0F172A',
  },
  secondary: {
    main: '#D4A65A',
    light: '#E8C19A',
    dark: '#C8924A',
    contrastText: '#0F172A',
  },
  success: {
    main: '#34D399',
    light: '#6EE7B7',
    dark: '#10B981',
    contrastText: '#0F172A',
  },
  warning: {
    main: '#FBBF24',
    light: '#FDE68A',
    dark: '#F59E0B',
    contrastText: '#0F172A',
  },
  error: {
    main: '#F87171',
    light: '#FCA5A5',
    dark: '#EF4444',
    contrastText: '#0F172A',
  },
  info: {
    main: '#60A5FA',
    light: '#93C5FD',
    dark: '#3B82F6',
    contrastText: '#0F172A',
  },
  neutral: {
    main: '#94A3B8',
    light: '#CBD5E1',
    dark: '#64748B',
    contrastText: '#0F172A',
  },
  grey: {
    50: '#0F172A',
    100: '#1E293B',
    200: '#334155',
    300: '#475569',
    400: '#64748B',
    500: '#94A3B8',
    600: '#CBD5E1',
    700: '#E2E8F0',
    800: '#F1F5F9',
    900: '#F8FAFC',
  },
  background: {
    default: '#0F172A',
    paper: '#1E293B',
    surface: '#162032',
  },
  text: {
    primary: '#F1F5F9',
    secondary: '#94A3B8',
    disabled: '#475569',
    inverse: '#0F172A',
  },
  border: {
    light: '#1E293B',
    main: '#334155',
    dark: '#475569',
  },
} as const;

interface ColorVariant {
  main: string;
  light: string;
  dark: string;
  contrastText: string;
}

export interface ColorPalette {
  primary: ColorVariant;
  secondary: ColorVariant;
  success: ColorVariant;
  warning: ColorVariant;
  error: ColorVariant;
  info: ColorVariant;
  neutral: ColorVariant;
  grey: Record<number, string>;
  background: { default: string; paper: string; surface: string };
  text: { primary: string; secondary: string; disabled: string; inverse: string };
  border: { light: string; main: string; dark: string };
}
