import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme';

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  iconName?: keyof typeof Ionicons.glyphMap;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  compact?: boolean;
  onPress?: () => void;
}

export const KpiCard = React.memo(function KpiCard({ label, value, unit, trend, iconName, color = 'primary', compact = false, onPress }: KpiCardProps) {
  const theme = useTheme();
  const palette = theme.colors[color];

  const trendColor = trend && trend > 0
    ? theme.colors.success.main
    : trend && trend < 0
      ? theme.colors.error.main
      : theme.colors.text.disabled;

  const trendPrefix = trend && trend > 0 ? '+' : '';
  const trendIcon = trend && trend > 0 ? 'trending-up' : trend && trend < 0 ? 'trending-down' : null;

  const iconSize = compact ? 26 : 32;
  const valueSize = compact ? 22 : 26;

  return (
    <Card onPress={onPress} style={{ flex: 1, minWidth: compact ? 0 : 140, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.SPACING.sm }}>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, flexShrink: 1 }} numberOfLines={1}>
          {label}
        </Text>
        {iconName && (
          <View style={{
            width: iconSize,
            height: iconSize,
            borderRadius: theme.BORDER_RADIUS.sm,
            backgroundColor: `${palette.main}0C`,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 4,
          }}>
            <Ionicons name={iconName} size={compact ? 14 : 16} color={palette.main} />
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, flexWrap: compact ? 'wrap' : 'nowrap' }}>
        <Text style={{ ...theme.typography.display, color: theme.colors.text.primary, fontSize: valueSize }}>
          {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
        </Text>
        {unit && (
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: compact ? 10 : undefined }}>{unit}</Text>
        )}
      </View>

      {trend != null && trend !== 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: theme.SPACING.sm }}>
          {trendIcon && <Ionicons name={trendIcon as any} size={14} color={trendColor} />}
          <Text style={{ ...theme.typography.caption, color: trendColor, fontWeight: '700' }}>
            {trendPrefix}{trend}%
          </Text>
        </View>
      )}
    </Card>
  );
});
