import React from 'react';
import { Badge } from '@/components/ui/Badge';
import type { ViewStyle } from 'react-native';

type StatusColor = 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'neutral';

const STATUS_MAP: Record<string, { label: string; color: StatusColor }> = {
  PENDING: { label: 'En attente', color: 'warning' },
  AWAITING_VALIDATION: { label: 'Validation', color: 'warning' },
  AWAITING_PAYMENT: { label: 'Paiement', color: 'warning' },
  IN_PROGRESS: { label: 'En cours', color: 'info' },
  COMPLETED: { label: 'Terminée', color: 'success' },
  RESOLVED: { label: 'Résolu', color: 'success' },
  CANCELLED: { label: 'Annulée', color: 'error' },
  APPROVED: { label: 'Approuvée', color: 'info' },
  REJECTED: { label: 'Rejetée', color: 'error' },
  SCHEDULED: { label: 'Planifiée', color: 'primary' },
};

interface StatusBadgeProps {
  status: string;
  style?: ViewStyle;
}

export function StatusBadge({ status, style }: StatusBadgeProps) {
  const mapped = STATUS_MAP[status] ?? { label: status, color: 'neutral' as StatusColor };
  return <Badge label={mapped.label} color={mapped.color} variant="subtle" size="small" style={style} />;
}
