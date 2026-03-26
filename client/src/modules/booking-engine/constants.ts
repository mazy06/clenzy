import type { DesignTokens } from '../../services/api/bookingEngineApi';
import { CURRENCY_OPTIONS as CURRENCY_OPTIONS_PMS } from '../../utils/currencyUtils';
import { DEFAULT_DESIGN_TOKENS } from './hooks/useBookingEngineForm';

// ─── Language / Currency / Font Options ─────────────────────────────────────

export const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];

/** Currencies managed by the PMS — imported from shared utils. */
export const CURRENCY_OPTIONS = CURRENCY_OPTIONS_PMS.map((c) => ({
  value: c.code,
  label: `${c.code} — ${c.label.replace(/ \(.*\)$/, '')}`,
}));

export const FONT_OPTIONS = [
  { value: '', label: 'Par défaut (système)' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Nunito', label: 'Nunito' },
];

// ─── Design Presets ─────────────────────────────────────────────────────────

export interface DesignPreset {
  id: string;
  i18nKey: string;
  tokens: DesignTokens;
  primaryColor: string;
  fontFamily: string;
  /** 3 preview colors for the card swatch */
  swatch: [string, string, string];
}

export const DESIGN_PRESETS: DesignPreset[] = [
  {
    id: 'safari-lodge',
    i18nKey: 'safariLodge',
    primaryColor: '#B2974A',
    fontFamily: 'Poppins',
    swatch: ['#B2974A', '#49554C', '#F2F1EB'],
    tokens: { ...DEFAULT_DESIGN_TOKENS },
  },
  {
    id: 'stripe-minimal',
    i18nKey: 'stripeMinimal',
    primaryColor: '#635BFF',
    fontFamily: 'Inter',
    swatch: ['#635BFF', '#1A1A2E', '#F7F7F8'],
    tokens: {
      primaryColor: '#635BFF',
      secondaryColor: '#1A1A2E',
      accentColor: '#635BFF',
      backgroundColor: '#FFFFFF',
      surfaceColor: '#F7F7F8',
      textColor: '#1A1A2E',
      textSecondaryColor: '#6B7280',
      headingFontFamily: 'Inter, -apple-system, sans-serif',
      bodyFontFamily: 'Inter, -apple-system, sans-serif',
      baseFontSize: '14px',
      headingFontWeight: '600',
      borderRadius: '8px',
      buttonBorderRadius: '8px',
      cardBorderRadius: '12px',
      spacing: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      cardShadow: '0 1px 2px rgba(0,0,0,0.05)',
      buttonStyle: 'filled',
      buttonTextTransform: 'none',
      borderColor: '#E3E3E8',
      dividerColor: '#E3E3E8',
    },
  },
  {
    id: 'ocean-breeze',
    i18nKey: 'oceanBreeze',
    primaryColor: '#0EA5E9',
    fontFamily: 'Nunito',
    swatch: ['#0EA5E9', '#0F172A', '#F0F9FF'],
    tokens: {
      primaryColor: '#0EA5E9',
      secondaryColor: '#0F172A',
      accentColor: '#06B6D4',
      backgroundColor: '#F0F9FF',
      surfaceColor: '#FFFFFF',
      textColor: '#0F172A',
      textSecondaryColor: '#64748B',
      headingFontFamily: 'Nunito, sans-serif',
      bodyFontFamily: 'Nunito, sans-serif',
      baseFontSize: '15px',
      headingFontWeight: '700',
      borderRadius: '12px',
      buttonBorderRadius: '24px',
      cardBorderRadius: '16px',
      spacing: '8px',
      boxShadow: '0 4px 20px rgba(14,165,233,0.1)',
      cardShadow: '0 2px 8px rgba(0,0,0,0.04)',
      buttonStyle: 'filled',
      buttonTextTransform: 'none',
      borderColor: '#BAE6FD',
      dividerColor: '#E0F2FE',
    },
  },
  {
    id: 'urban-chic',
    i18nKey: 'urbanChic',
    primaryColor: '#D4AF37',
    fontFamily: 'Montserrat',
    swatch: ['#D4AF37', '#1C1C1E', '#2C2C2E'],
    tokens: {
      primaryColor: '#D4AF37',
      secondaryColor: '#F5F5F5',
      accentColor: '#D4AF37',
      backgroundColor: '#1C1C1E',
      surfaceColor: '#2C2C2E',
      textColor: '#F5F5F5',
      textSecondaryColor: '#A0A0A0',
      headingFontFamily: 'Montserrat, sans-serif',
      bodyFontFamily: 'Montserrat, sans-serif',
      baseFontSize: '14px',
      headingFontWeight: '600',
      borderRadius: '4px',
      buttonBorderRadius: '2px',
      cardBorderRadius: '4px',
      spacing: '8px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      cardShadow: '0 2px 8px rgba(0,0,0,0.3)',
      buttonStyle: 'filled',
      buttonTextTransform: 'uppercase',
      borderColor: '#3A3A3C',
      dividerColor: '#3A3A3C',
    },
  },
  {
    id: 'provencal',
    i18nKey: 'provencal',
    primaryColor: '#7C3AED',
    fontFamily: 'Lato',
    swatch: ['#7C3AED', '#92400E', '#FDF8F0'],
    tokens: {
      primaryColor: '#7C3AED',
      secondaryColor: '#92400E',
      accentColor: '#D97706',
      backgroundColor: '#FDF8F0',
      surfaceColor: '#FFFFFF',
      textColor: '#44403C',
      textSecondaryColor: '#78716C',
      headingFontFamily: 'Lato, sans-serif',
      bodyFontFamily: 'Lato, sans-serif',
      baseFontSize: '15px',
      headingFontWeight: '700',
      borderRadius: '8px',
      buttonBorderRadius: '8px',
      cardBorderRadius: '12px',
      spacing: '8px',
      boxShadow: '0 4px 16px rgba(124,58,237,0.08)',
      cardShadow: '0 1px 4px rgba(0,0,0,0.06)',
      buttonStyle: 'filled',
      buttonTextTransform: 'capitalize',
      borderColor: '#E7E5E4',
      dividerColor: '#E7E5E4',
    },
  },
  {
    id: 'nordic',
    i18nKey: 'nordic',
    primaryColor: '#374151',
    fontFamily: 'Inter',
    swatch: ['#374151', '#6B7280', '#F9FAFB'],
    tokens: {
      primaryColor: '#374151',
      secondaryColor: '#9CA3AF',
      accentColor: '#6B7280',
      backgroundColor: '#F9FAFB',
      surfaceColor: '#FFFFFF',
      textColor: '#111827',
      textSecondaryColor: '#6B7280',
      headingFontFamily: 'Inter, -apple-system, sans-serif',
      bodyFontFamily: 'Inter, -apple-system, sans-serif',
      baseFontSize: '14px',
      headingFontWeight: '500',
      borderRadius: '6px',
      buttonBorderRadius: '6px',
      cardBorderRadius: '8px',
      spacing: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      cardShadow: 'none',
      buttonStyle: 'filled',
      buttonTextTransform: 'none',
      borderColor: '#E5E7EB',
      dividerColor: '#F3F4F6',
    },
  },
];
