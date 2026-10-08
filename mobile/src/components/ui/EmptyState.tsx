import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { Reicon } from '@/icons';
import { useTheme } from '@/theme';
import { Button } from './Button';

type IconName = keyof typeof Reicon.glyphMap;

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  iconName?: IconName;
  style?: ViewStyle;
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  iconName,
  style,
  compact = false,
}: EmptyStateProps) {
  const theme = useTheme();

  const renderIcon = () => {
    if (icon) return <View style={{ marginBottom: theme.SPACING.lg }}>{icon}</View>;
    if (iconName) {
      return (
        <View
          style={{
            width: compact ? 56 : 72,
            height: compact ? 56 : 72,
            borderRadius: compact ? 28 : 36,
            backgroundColor: `${theme.colors.primary.main}08`,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: theme.SPACING.lg,
          }}
        >
          <Reicon name={iconName} size={compact ? 24 : 28} color={theme.colors.primary.light} />
        </View>
      );
    }
    return null;
  };

  return (
    <View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: theme.SPACING['3xl'],
          paddingVertical: compact ? theme.SPACING.xl : theme.SPACING['4xl'],
        },
        style,
      ]}
    >
      {renderIcon()}
      <Text
        style={{
          ...theme.typography.h4,
          color: theme.colors.text.primary,
          textAlign: 'center',
          marginBottom: theme.SPACING.xs,
        }}
      >
        {title}
      </Text>
      {description && (
        <Text
          style={{
            ...theme.typography.body2,
            color: theme.colors.text.secondary,
            textAlign: 'center',
            marginBottom: theme.SPACING.xl,
          }}
        >
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} variant="soft" />
      )}
    </View>
  );
}
