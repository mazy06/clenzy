import React from 'react';
import { View, Pressable, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  noPadding?: boolean;
  elevated?: boolean;
  variant?: 'default' | 'outlined' | 'filled';
}

export function Card({ children, onPress, style, noPadding = false, elevated = false, variant = 'default' }: CardProps) {
  const theme = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: variant === 'filled' ? theme.colors.background.surface : theme.colors.background.paper,
    borderRadius: theme.BORDER_RADIUS.lg,
    padding: noPadding ? 0 : theme.SPACING.lg,
    ...(variant === 'outlined'
      ? { borderWidth: 1, borderColor: theme.colors.border.main }
      : elevated ? theme.shadows.lg : theme.shadows.sm),
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] }, style]}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
}
