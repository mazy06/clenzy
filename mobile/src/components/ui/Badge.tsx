import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

type BadgeVariant = 'filled' | 'outlined' | 'subtle';
type BadgeColor = 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  color?: BadgeColor;
  variant?: BadgeVariant;
  size?: 'small' | 'medium';
  /** Affiche un dot colore a gauche du label */
  dot?: boolean;
  style?: ViewStyle;
}

export function Badge({
  label,
  color = 'primary',
  variant = 'subtle',
  size = 'medium',
  dot = false,
  style,
}: BadgeProps) {
  const theme = useTheme();
  const palette = theme.colors[color];
  const isSmall = size === 'small';

  const getContainerStyle = (): ViewStyle => {
    const base: ViewStyle = {
      borderRadius: theme.BORDER_RADIUS.full,
      paddingHorizontal: isSmall ? 8 : 10,
      paddingVertical: isSmall ? 2 : 4,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    };

    switch (variant) {
      case 'filled':
        return { ...base, backgroundColor: palette.main };
      case 'outlined':
        return { ...base, borderWidth: 1, borderColor: palette.main, backgroundColor: 'transparent' };
      case 'subtle':
        return { ...base, backgroundColor: `${palette.main}14` };
    }
  };

  const getTextColor = (): string => {
    switch (variant) {
      case 'filled':
        return palette.contrastText;
      case 'outlined':
      case 'subtle':
        return palette.dark;
    }
  };

  return (
    <View style={[getContainerStyle(), style]} accessibilityLabel={label} accessibilityRole="text">
      {dot && (
        <View style={{
          width: isSmall ? 5 : 6,
          height: isSmall ? 5 : 6,
          borderRadius: 3,
          backgroundColor: variant === 'filled' ? palette.contrastText : palette.main,
        }} />
      )}
      <Text
        style={{
          color: getTextColor(),
          fontSize: isSmall ? 10 : 12,
          fontWeight: '600',
          lineHeight: isSmall ? 14 : 16,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
