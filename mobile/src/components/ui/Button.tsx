import React from 'react';
import { Pressable, Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '@/theme';

type ButtonVariant = 'contained' | 'outlined' | 'text' | 'soft';
type ButtonSize = 'small' | 'medium' | 'large';
type ButtonColor = 'primary' | 'secondary' | 'success' | 'error' | 'warning';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  color?: ButtonColor;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'contained',
  size = 'medium',
  color = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const theme = useTheme();
  const palette = theme.colors[color];

  const sizeStyles = {
    small: { paddingVertical: 8, paddingHorizontal: 16, minHeight: 36 },
    medium: { paddingVertical: 12, paddingHorizontal: 24, minHeight: 48 },
    large: { paddingVertical: 16, paddingHorizontal: 28, minHeight: 56 },
  };

  const textSizes = {
    small: theme.typography.buttonSmall,
    medium: theme.typography.button,
    large: { ...theme.typography.button, fontSize: 16 },
  };

  const radiusMap = {
    small: theme.BORDER_RADIUS.sm,
    medium: theme.BORDER_RADIUS.md,
    large: theme.BORDER_RADIUS.md,
  };

  const getContainerStyle = (pressed: boolean): ViewStyle => {
    const base: ViewStyle = {
      ...sizeStyles[size],
      borderRadius: radiusMap[size],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
      transform: pressed && !disabled ? [{ scale: 0.97 }] : [],
    };

    if (fullWidth) base.width = '100%';

    switch (variant) {
      case 'contained':
        return { ...base, backgroundColor: palette.main, ...theme.shadows.xs };
      case 'soft':
        return { ...base, backgroundColor: `${palette.main}14` };
      case 'outlined':
        return { ...base, borderWidth: 1.5, borderColor: palette.main, backgroundColor: 'transparent' };
      case 'text':
        return { ...base, backgroundColor: 'transparent' };
    }
  };

  const getTextStyle = (): TextStyle => {
    const base = textSizes[size];
    switch (variant) {
      case 'contained':
        return { ...base, color: palette.contrastText };
      case 'soft':
        return { ...base, color: palette.main };
      case 'outlined':
      case 'text':
        return { ...base, color: palette.main };
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [getContainerStyle(pressed), style]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'contained' ? palette.contrastText : palette.main}
        />
      ) : (
        <>
          {icon}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
