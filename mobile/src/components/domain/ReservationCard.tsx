import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/theme';
import type { Reservation } from '@/api/endpoints/reservationsApi';

const STATUS_CONFIG: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'info' }> = {
  CONFIRMED: { label: 'Confirmee', color: 'success' },
  PENDING: { label: 'En attente', color: 'warning' },
  CANCELLED: { label: 'Annulee', color: 'error' },
  CHECKED_IN: { label: 'En cours', color: 'info' },
  CHECKED_OUT: { label: 'Terminee', color: 'success' },
};

function formatShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

function nightCount(checkIn: string, checkOut: string): number {
  try {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  } catch {
    return 0;
  }
}

interface ReservationCardProps {
  reservation: Reservation;
  onPress?: () => void;
}

export const ReservationCard = React.memo(function ReservationCard({ reservation, onPress }: ReservationCardProps) {
  const theme = useTheme();
  const statusConf = STATUS_CONFIG[reservation.status] ?? { label: reservation.status, color: 'info' as const };
  const nights = nightCount(reservation.checkIn, reservation.checkOut);

  return (
    <Card onPress={onPress} style={{ marginBottom: theme.SPACING.md }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.SPACING.sm }}>
        <View style={{ flex: 1, marginRight: theme.SPACING.sm }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary }} numberOfLines={1}>
            {reservation.guestName || 'Voyageur'}
          </Text>
          {reservation.propertyName && (
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 }} numberOfLines={1}>
              {reservation.propertyName}
            </Text>
          )}
        </View>
        <Badge label={statusConf.label} color={statusConf.color} size="small" dot />
      </View>

      {/* Dates timeline */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.background.surface,
        borderRadius: theme.BORDER_RADIUS.sm,
        padding: theme.SPACING.sm,
        marginBottom: theme.SPACING.sm,
      }}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Arrivee</Text>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginTop: 2 }}>
            {formatShortDate(reservation.checkIn)}
          </Text>
        </View>

        <View style={{ alignItems: 'center', paddingHorizontal: theme.SPACING.md }}>
          <View style={{
            backgroundColor: `${theme.colors.primary.main}14`,
            borderRadius: theme.BORDER_RADIUS.full,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.primary.main, fontWeight: '700' }}>
              {nights}N
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Depart</Text>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginTop: 2 }}>
            {formatShortDate(reservation.checkOut)}
          </Text>
        </View>
      </View>

      {/* Footer */}
      {(reservation.totalPrice != null || reservation.source) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {reservation.totalPrice != null && (
            <Text style={{ ...theme.typography.h5, color: theme.colors.success.main }}>
              {reservation.totalPrice.toFixed(0)}€
            </Text>
          )}
          {reservation.source && (
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
              {reservation.sourceName || reservation.source}
            </Text>
          )}
        </View>
      )}
    </Card>
  );
});
