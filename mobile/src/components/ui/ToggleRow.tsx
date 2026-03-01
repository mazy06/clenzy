import React from 'react';
import { View, Text, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  iconName?: IoniconsName;
  iconColor?: string;
}

export function ToggleRow({ label, description, value, onValueChange, disabled, iconName, iconColor }: ToggleRowProps) {
  const theme = useTheme();
  const resolvedColor = iconColor || theme.colors.primary.main;

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      opacity: disabled ? 0.5 : 1,
    }}>
      {iconName && (
        <View style={{
          width: 36,
          height: 36,
          borderRadius: theme.BORDER_RADIUS.sm,
          backgroundColor: `${resolvedColor}0C`,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: theme.SPACING.md,
        }}>
          <Ionicons name={iconName} size={18} color={resolvedColor} />
        </View>
      )}

      <View style={{ flex: 1, marginRight: theme.SPACING.md }}>
        <Text style={{
          ...theme.typography.body2,
          color: theme.colors.text.primary,
          fontWeight: '500',
        }}>
          {label}
        </Text>
        {description && (
          <Text style={{
            ...theme.typography.caption,
            color: theme.colors.text.secondary,
            marginTop: 2,
            lineHeight: 16,
          }}>
            {description}
          </Text>
        )}
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: theme.colors.border.main,
          true: `${theme.colors.primary.main}80`,
        }}
        thumbColor={value ? theme.colors.primary.main : theme.colors.grey[300]}
        ios_backgroundColor={theme.colors.border.main}
      />
    </View>
  );
}
