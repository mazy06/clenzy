import { useColorScheme } from 'react-native';
import { colors, darkColors, type ColorPalette } from './colors';
import { typography, type TypographyVariant } from './typography';
import { spacing, SPACING, TOUCH_TARGET, BORDER_RADIUS } from './spacing';
import { shadows } from './shadows';
import { useSettingsStore } from '@/store/settingsStore';
import { baitlyLight, baitlyDark } from '@/design-system/theme';

export interface Theme {
  colors: ColorPalette;
  typography: typeof typography;
  spacing: typeof spacing;
  SPACING: typeof SPACING;
  TOUCH_TARGET: typeof TOUCH_TARGET;
  BORDER_RADIUS: typeof BORDER_RADIUS;
  shadows: typeof shadows;
  isDark: boolean;
}

export function useTheme(): Theme {
  const colorScheme = useColorScheme();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const isDark = themeMode === 'system' ? colorScheme === 'dark' : themeMode === 'dark';
  const base = isDark ? darkColors : colors;
  const baitly = isDark ? baitlyDark : baitlyLight;
  const palette: ColorPalette = {
    ...base,
    primary: { ...base.primary, main: baitly.primary, contrastText: baitly.onPrimary },
    success: { ...base.success, main: baitly.success, contrastText: baitly.background },
    warning: { ...base.warning, main: baitly.warning, contrastText: baitly.background },
    error: { ...base.error, main: baitly.danger, contrastText: baitly.background },
    background: { default: baitly.background, paper: baitly.surface, surface: baitly.muted },
    text: { primary: baitly.ink, secondary: baitly.secondary, disabled: baitly.secondary, inverse: baitly.onPrimary },
    border: { light: baitly.border, main: baitly.border, dark: baitly.secondary },
  };

  return {
    colors: palette,
    typography,
    spacing,
    SPACING,
    TOUCH_TARGET,
    BORDER_RADIUS,
    shadows,
    isDark,
  };
}

export { colors, darkColors, typography, spacing, SPACING, TOUCH_TARGET, BORDER_RADIUS, shadows };
export type { ColorPalette, TypographyVariant };
