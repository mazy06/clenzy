import React from 'react';
import { Badge } from '@/components/ui/Badge';
import type { ViewStyle } from 'react-native';

type StatusColor = 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'neutral';

const STATUS_MAP: Record<string, { label: string; color: StatusColor }> = {
  PENDING: { label: 'En attente', color: 'warning' },
  AWAITING_VALIDATION: { label: 'Validation', color: 'warning' },
  AWAITING_PAYMENT: { label: 'Paiement', color: 'warning' },
  IN_PROGRESS: { label: 'En cours', color: 'info' },
  COMPLETED: { label: 'Termine', color: 'success' },
  CANCELLED: { label: 'Annule', color: 'error' },
  APPROVED: { label: 'Approuve', color: 'info' },
  REJECTED: { label: 'Rejete', color: 'error' },
  SCHEDULED: { label: 'Planifie', color: 'primary' },
};

interface StatusBadgeProps {
  status: string;
  style?: ViewStyle;
}

export function StatusBadge({ status, style }: StatusBadgeProps) {
  const mapped = STATUS_MAP[status] ?? { label: status, color: 'neutral' as StatusColor };
  return <Badge label={mapped.label} color={mapped.color} variant="subtle" size="small" style={style} />;
}
