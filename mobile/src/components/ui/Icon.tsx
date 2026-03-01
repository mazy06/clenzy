import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface IconProps {
  name: IoniconsName;
  size?: number;
  color?: string;
  style?: object;
}

/**
 * Theme-aware icon wrapper around Ionicons.
 * Defaults to text.secondary color and 24px size.
 */
export function Icon({ name, size = 24, color, style }: IconProps) {
  const theme = useTheme();
  const iconColor = color || theme.colors.text.secondary;

  return <Ionicons name={name} size={size} color={iconColor} style={style} />;
}

export type { IoniconsName };
