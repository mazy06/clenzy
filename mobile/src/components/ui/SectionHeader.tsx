import React from 'react';
import { View, Text, Pressable, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface SectionHeaderProps {
  title: string;
  iconName?: IoniconsName;
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
          <View style={{
            width: 28,
            height: 28,
            borderRadius: theme.BORDER_RADIUS.sm,
            backgroundColor: `${theme.colors.primary.main}0A`,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons name={iconName} size={16} color={theme.colors.primary.main} />
          </View>
        )}
        <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary }}>{title}</Text>
      </View>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ ...theme.typography.body2, color: theme.colors.primary.main, fontWeight: '600' }}>
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
