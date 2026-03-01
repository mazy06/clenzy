import React from 'react';
import { Pressable, Text, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Chip({ label, selected = false, onPress, style }: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        {
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: theme.BORDER_RADIUS.full,
          backgroundColor: selected ? theme.colors.primary.main : theme.colors.background.paper,
          borderWidth: selected ? 0 : 1,
          borderColor: theme.colors.border.main,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          ...theme.typography.body2,
          fontWeight: selected ? '600' : '400',
          color: selected ? theme.colors.primary.contrastText : theme.colors.text.secondary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
