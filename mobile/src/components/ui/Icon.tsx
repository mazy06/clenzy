import React from 'react';
import { Reicon } from '@/icons';
import { useTheme } from '@/theme';

type IconName = keyof typeof Reicon.glyphMap;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: object;
}

/**
 * Theme-aware icon wrapper around Reicon (duotone par défaut pour les noms `-outline`).
 * Defaults to text.secondary color and 24px size.
 */
export function Icon({ name, size = 24, color, style }: IconProps) {
  const theme = useTheme();
  const iconColor = color || theme.colors.text.secondary;

  return <Reicon name={name} size={size} color={iconColor} style={style} />;
}

export type { IconName };
