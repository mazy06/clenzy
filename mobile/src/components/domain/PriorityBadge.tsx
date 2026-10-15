import React from 'react';
import { Badge } from '@/components/ui/Badge';
import type { ViewStyle } from 'react-native';

type BadgeColor = 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'neutral';

const PRIORITY_MAP: Record<string, { label: string; color: BadgeColor }> = {
  LOW: { label: 'Basse', color: 'success' },
  NORMAL: { label: 'Normale', color: 'info' },
  HIGH: { label: 'Élevée', color: 'warning' },
  CRITICAL: { label: 'Critique', color: 'error' },
};

interface PriorityBadgeProps {
  priority: string;
  style?: ViewStyle;
}

export function PriorityBadge({ priority, style }: PriorityBadgeProps) {
  const mapped = PRIORITY_MAP[priority] ?? { label: priority, color: 'neutral' as BadgeColor };
  return <Badge label={mapped.label} color={mapped.color} variant="subtle" size="small" style={style} />;
}
