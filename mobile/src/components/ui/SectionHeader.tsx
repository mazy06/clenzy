import React from 'react';
import { View, Text, Pressable, ViewStyle } from 'react-native';
import { Reicon } from '@/icons';
import { useTheme } from '@/theme';

type IconName = keyof typeof Reicon.glyphMap;

interface SectionHeaderProps {
  title: string;
  iconName?: IconName;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function SectionHeader({ title, iconName, actionLabel, onAction, style }: SectionHeaderProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.SPACING.md,
          marginTop: theme.SPACING.sm,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {iconName && (
          <Reicon name={iconName} size={18} color={theme.colors.text.secondary} />
        )}
        <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary }}>{title}</Text>
      </View>
      {actionLabel && onAction && (
        <Pressable accessibilityRole="button" onPress={onAction} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ ...theme.typography.body2, color: theme.colors.primary.main, fontWeight: '600' }}>
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
