import React from 'react';
import { View, Text } from 'react-native';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { useTheme } from '@/theme';
import type { ServiceRequest } from '@/api/endpoints/serviceRequestsApi';

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

interface ServiceRequestCardProps {
  request: ServiceRequest;
  onPress?: () => void;
}

export const ServiceRequestCard = React.memo(function ServiceRequestCard({ request, onPress }: ServiceRequestCardProps) {
  const theme = useTheme();

  return (
    <Card onPress={onPress} style={{ marginBottom: theme.SPACING.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.SPACING.xs }}>
        <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, flex: 1, marginRight: theme.SPACING.sm }} numberOfLines={2}>
          {request.title}
        </Text>
        <PriorityBadge priority={request.priority} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.xs, marginBottom: theme.SPACING.xs }}>
        <StatusBadge status={request.status} />
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
          {request.serviceType}
        </Text>
      </View>

      {request.propertyName && (
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }} numberOfLines={1}>
          {request.propertyName}
        </Text>
      )}

      {request.desiredDate && (
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginTop: 4 }}>
          Souhaitee le {formatDate(request.desiredDate)}
        </Text>
      )}
    </Card>
  );
});
