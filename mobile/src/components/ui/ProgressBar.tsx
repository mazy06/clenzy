import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

interface ProgressBarProps {
  progress: number; // 0-100
  color?: 'primary' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  height?: number;
  style?: ViewStyle;
}

export function ProgressBar({
  progress,
  color = 'primary',
  showLabel = false,
  height = 6,
  style,
}: ProgressBarProps) {
  const theme = useTheme();
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const barColor = theme.colors[color].main;

  return (
    <View style={style}>
      {showLabel && (
        <Text
          style={{
            ...theme.typography.caption,
            color: theme.colors.text.secondary,
            marginBottom: 6,
            textAlign: 'right',
            fontWeight: '600',
          }}
        >
          {Math.round(clampedProgress)}%
        </Text>
      )}
      <View
        style={{
          height,
          borderRadius: height,
          backgroundColor: `${barColor}18`,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${clampedProgress}%`,
            borderRadius: height,
            backgroundColor: barColor,
          }}
        />
      </View>
    </View>
  );
}
