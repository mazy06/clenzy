import { useColorScheme } from 'react-native';
import { colors, darkColors, type ColorPalette } from './colors';
import { typography, type TypographyVariant } from './typography';
import { spacing, SPACING, TOUCH_TARGET, BORDER_RADIUS } from './spacing';
import { shadows } from './shadows';
import { useSettingsStore } from '@/store/settingsStore';

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

  return {
    colors: isDark ? darkColors : colors,
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
