import type { ClenzyTheme } from './types';

/** Parse hex color to RGB components */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return null;
  return { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) };
}

/** Darken a hex color by a percentage (0-1) */
function darken(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.max(0, Math.round(rgb.r * (1 - amount)));
  const g = Math.max(0, Math.round(rgb.g * (1 - amount)));
  const b = Math.max(0, Math.round(rgb.b * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Lighten a hex color towards white */
function lighten(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * amount));
  const g = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * amount));
  const b = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Convert hex to rgba string */
function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0,0,0,${alpha})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

/** Scale a border-radius value */
function scaleRadius(base: string, factor: number): string {
  const px = parseFloat(base);
  if (isNaN(px)) return base;
  return `${Math.round(px * factor)}px`;
}

/** Default theme tokens */
const DEFAULTS: Required<ClenzyTheme> = {
  primaryColor: '#635BFF',
  primaryHoverColor: '#4B44CC',
  primaryLightColor: '#F6F5FF',
  backgroundColor: '#FFFFFF',
  surfaceColor: '#F7F7F8',
  borderColor: '#E3E3E8',
  textColor: '#1A1A2E',
  textSecondaryColor: '#6B7280',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  borderRadius: '8px',
  shadow: '0 4px 12px rgba(0,0,0,0.08)',
};

/** Generate CSS custom properties string from theme config */
export function generateThemeCSS(theme?: ClenzyTheme): string {
  const t = { ...DEFAULTS, ...theme };

  // Auto-derive colors if not explicitly set
  if (theme?.primaryColor && !theme.primaryHoverColor) {
    t.primaryHoverColor = darken(t.primaryColor, 0.15);
  }
  if (theme?.primaryColor && !theme.primaryLightColor) {
    t.primaryLightColor = lighten(t.primaryColor, 0.92);
  }

  const focusShadow = `0 0 0 3px ${hexToRgba(t.primaryColor, 0.15)}`;
  const radiusSm = scaleRadius(t.borderRadius, 0.75);
  const radiusLg = scaleRadius(t.borderRadius, 1.5);

  return `:host {
  --cb-color-primary: ${t.primaryColor};
  --cb-color-primary-hover: ${t.primaryHoverColor};
  --cb-color-primary-light: ${t.primaryLightColor};
  --cb-color-bg: ${t.backgroundColor};
  --cb-color-surface: ${t.surfaceColor};
  --cb-color-border: ${t.borderColor};
  --cb-color-border-focus: ${t.primaryColor};
  --cb-color-text: ${t.textColor};
  --cb-color-text-secondary: ${t.textSecondaryColor};
  --cb-color-text-muted: #9CA3AF;
  --cb-color-success: #10B981;
  --cb-color-error: #EF4444;
  --cb-color-warning: #F59E0B;

  --cb-font-family: ${t.fontFamily};
  --cb-font-size-xs: 0.75rem;
  --cb-font-size-sm: 0.8125rem;
  --cb-font-size-base: 0.875rem;
  --cb-font-size-md: 1rem;
  --cb-font-size-lg: 1.25rem;
  --cb-font-size-xl: 1.5rem;
  --cb-font-weight-normal: 400;
  --cb-font-weight-medium: 500;
  --cb-font-weight-semibold: 600;
  --cb-line-height: 1.5;

  --cb-space-1: 4px;
  --cb-space-2: 8px;
  --cb-space-3: 12px;
  --cb-space-4: 16px;
  --cb-space-5: 20px;
  --cb-space-6: 24px;
  --cb-space-8: 32px;
  --cb-space-10: 40px;
  --cb-space-12: 48px;

  --cb-radius-sm: ${radiusSm};
  --cb-radius-md: ${t.borderRadius};
  --cb-radius-lg: ${radiusLg};
  --cb-radius-full: 9999px;

  --cb-shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --cb-shadow-md: ${t.shadow};
  --cb-shadow-lg: 0 8px 30px rgba(0,0,0,0.12);
  --cb-shadow-focus: ${focusShadow};

  --cb-transition-fast: 100ms ease;
  --cb-transition-base: 150ms ease;
  --cb-transition-slow: 250ms ease-out;
}`;
}

export { DEFAULTS as defaultTheme };
