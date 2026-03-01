import React, { useState } from 'react';
import { View, TextInput, Text, TextInputProps, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  helperText,
  containerStyle,
  ...props
}: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.error.main
    : focused
    ? theme.colors.primary.main
    : theme.colors.border.main;

  return (
    <View style={containerStyle}>
      {label && (
        <Text
          style={{
            ...theme.typography.body2,
            fontWeight: '500',
            color: error ? theme.colors.error.main : focused ? theme.colors.primary.main : theme.colors.text.primary,
            marginBottom: 8,
          }}
        >
          {label}
        </Text>
      )}
      <TextInput
        {...props}
        accessibilityLabel={label || props.placeholder}
        accessibilityHint={helperText}
        accessibilityState={{ disabled: props.editable === false }}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        placeholderTextColor={theme.colors.text.disabled}
        style={{
          ...theme.typography.body1,
          color: theme.colors.text.primary,
          backgroundColor: theme.colors.background.surface,
          borderWidth: 1.5,
          borderColor,
          borderRadius: theme.BORDER_RADIUS.md,
          paddingHorizontal: 16,
          paddingVertical: 14,
          minHeight: theme.TOUCH_TARGET.minHeight,
        }}
      />
      {(error || helperText) && (
        <Text
          style={{
            ...theme.typography.caption,
            color: error ? theme.colors.error.main : theme.colors.text.secondary,
            marginTop: 6,
          }}
        >
          {error || helperText}
        </Text>
      )}
    </View>
  );
}
