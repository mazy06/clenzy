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
  const [focused, setFocused] = React.useState(false);

  const cardStyle: ViewStyle = {
    backgroundColor: variant === 'filled' ? theme.colors.background.surface : theme.colors.background.paper,
    borderRadius: 20,
    padding: noPadding ? 0 : theme.SPACING.md,
    ...(variant === 'outlined'
      ? { borderWidth: 1, borderColor: theme.colors.border.main }
      : elevated ? theme.shadows.sm : {}),
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={({ pressed }) => [cardStyle, pressed && { backgroundColor: theme.colors.background.surface }, style,
          focused && { borderWidth: 1, borderColor: theme.colors.primary.main }]}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
}
