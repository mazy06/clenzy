import type { BaitlyTheme } from './types';

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
const DEFAULTS: Required<BaitlyTheme> = {
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
  fontSize: '14px',
  density: 'normal',
  buttonStyle: 'filled',
};

/** Generate CSS custom properties string from theme config */
export function generateThemeCSS(theme?: BaitlyTheme): string {
  const t = { ...DEFAULTS, ...theme };

  // Auto-derive colors if not explicitly set
  if (theme?.primaryColor && !theme.primaryHoverColor) {
    t.primaryHoverColor = darken(t.primaryColor, 0.15);
  }
  if (theme?.primaryColor && !theme.primaryLightColor) {
    t.primaryLightColor = lighten(t.primaryColor, 0.92);
  }

  // Échelle typo dérivée d'une taille de base + facteur de densité + style de bouton.
  const basePx = parseFloat(t.fontSize) || 14;
  const fs = (factor: number) => `${(basePx * factor).toFixed(1)}px`;
  const spaceFactor = t.density === 'compact' ? 0.82 : t.density === 'spacious' ? 1.22 : 1;
  const sp = (n: number) => `${Math.round(4 * n * spaceFactor)}px`;
  const filledBtn = t.buttonStyle !== 'outlined';
  const btnBg = filledBtn ? t.primaryColor : 'transparent';
  const btnBgHover = filledBtn ? t.primaryHoverColor : hexToRgba(t.primaryColor, 0.08);
  const btnColor = filledBtn ? '#fff' : t.primaryColor;
  const btnBorder = filledBtn ? '1.5px solid transparent' : `1.5px solid ${t.primaryColor}`;

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
  --cb-font-size-xs: ${fs(0.82)};
  --cb-font-size-sm: ${fs(0.9)};
  --cb-font-size-base: ${fs(1)};
  --cb-font-size-md: ${fs(1.14)};
  --cb-font-size-lg: ${fs(1.43)};
  --cb-font-size-xl: ${fs(1.7)};
  --cb-font-weight-normal: 400;
  --cb-font-weight-medium: 500;
  --cb-font-weight-semibold: 600;
  --cb-line-height: 1.5;

  --cb-space-1: ${sp(1)};
  --cb-space-2: ${sp(2)};
  --cb-space-3: ${sp(3)};
  --cb-space-4: ${sp(4)};
  --cb-space-5: ${sp(5)};
  --cb-space-6: ${sp(6)};
  --cb-space-8: ${sp(8)};
  --cb-space-10: ${sp(10)};
  --cb-space-12: ${sp(12)};

  --cb-radius-sm: ${radiusSm};
  --cb-radius-md: ${t.borderRadius};
  --cb-radius-lg: ${radiusLg};
  --cb-radius-full: 9999px;

  --cb-shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --cb-shadow-md: ${t.shadow};
  --cb-shadow-lg: 0 8px 30px rgba(0,0,0,0.12);
  --cb-shadow-focus: ${focusShadow};

  --cb-btn-bg: ${btnBg};
  --cb-btn-bg-hover: ${btnBgHover};
  --cb-btn-color: ${btnColor};
  --cb-btn-border: ${btnBorder};

  --cb-transition-fast: 100ms ease;
  --cb-transition-base: 150ms ease;
  --cb-transition-slow: 250ms ease-out;
}`;
}

export { DEFAULTS as defaultTheme };
