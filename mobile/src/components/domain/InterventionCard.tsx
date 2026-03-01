import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { useTheme } from '@/theme';
import type { Intervention } from '@/api/endpoints/interventionsApi';

function formatTime(dateString?: string): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    const h = d.getHours();
    const m = d.getMinutes();
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  } catch {
    return '';
  }
}

function formatDuration(hours?: number): string {
  if (!hours || hours <= 0) return '';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, '0')}`;
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: '#DC2626',
  HIGH: '#D97706',
  NORMAL: '#4A7C8E',
  LOW: '#64748B',
};

interface InterventionCardProps {
  intervention: Intervention;
  onPress?: () => void;
}

export const InterventionCard = React.memo(function InterventionCard({ intervention, onPress }: InterventionCardProps) {
  const theme = useTheme();
  const accentColor = PRIORITY_COLORS[intervention.priority] ?? theme.colors.primary.main;

  return (
    <Card onPress={onPress} style={{ marginBottom: theme.SPACING.md, overflow: 'hidden' }}>
      {/* Accent bar */}
      <View style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: accentColor,
        borderTopLeftRadius: theme.BORDER_RADIUS.lg,
        borderBottomLeftRadius: theme.BORDER_RADIUS.lg,
      }} />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: theme.SPACING.sm }}>
        <Text
          style={{ ...theme.typography.h5, color: theme.colors.text.primary, flex: 1, marginRight: theme.SPACING.sm }}
          numberOfLines={2}
        >
          {intervention.title || intervention.type}
        </Text>
        <PriorityBadge priority={intervention.priority} />
      </View>

      {/* Status row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginBottom: theme.SPACING.sm }}>
        <StatusBadge status={intervention.status} />
        {intervention.isUrgent && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            backgroundColor: `${theme.colors.error.main}10`,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: theme.BORDER_RADIUS.full,
          }}>
            <Ionicons name="flash" size={10} color={theme.colors.error.main} />
            <Text style={{ fontSize: 10, color: theme.colors.error.main, fontWeight: '700' }}>URGENT</Text>
          </View>
        )}
      </View>

      {/* Property */}
      {intervention.propertyName && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Ionicons name="home-outline" size={13} color={theme.colors.text.secondary} />
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }} numberOfLines={1}>
            {intervention.propertyName}
          </Text>
        </View>
      )}

      {/* Bottom metadata */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.SPACING.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="time-outline" size={13} color={theme.colors.text.disabled} />
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
            {formatTime(intervention.startTime) || formatTime(intervention.createdAt)}
          </Text>
        </View>
        {intervention.estimatedDurationHours != null && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="hourglass-outline" size={13} color={theme.colors.text.disabled} />
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
              {formatDuration(intervention.estimatedDurationHours)}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
});
