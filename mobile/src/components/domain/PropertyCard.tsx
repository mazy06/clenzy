import React from 'react';
import { View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/theme';
import type { Property } from '@/api/endpoints/propertiesApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;

const PROPERTY_TYPE_ICON: Record<string, IoniconsName> = {
  APARTMENT: 'business-outline',
  HOUSE: 'home-outline',
  STUDIO: 'cube-outline',
  VILLA: 'leaf-outline',
  LOFT: 'grid-outline',
  GUEST_ROOM: 'bed-outline',
  COTTAGE: 'trail-sign-outline',
  CHALET: 'snow-outline',
  BOAT: 'boat-outline',
  OTHER: 'ellipsis-horizontal-circle-outline',
};

function getPropertyIcon(type?: string): IoniconsName {
  if (!type) return 'home-outline';
  return PROPERTY_TYPE_ICON[type.toUpperCase()] ?? 'home-outline';
}

const STATUS_CONFIG: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'info' }> = {
  ACTIVE: { label: 'Actif', color: 'success' },
  INACTIVE: { label: 'Inactif', color: 'error' },
  MAINTENANCE: { label: 'Maintenance', color: 'warning' },
  PENDING: { label: 'En attente', color: 'info' },
};

interface PropertyCardProps {
  property: Property;
  onPress?: () => void;
}

export const PropertyCard = React.memo(function PropertyCard({ property, onPress }: PropertyCardProps) {
  const theme = useTheme();
  const statusConf = STATUS_CONFIG[property.status] ?? { label: property.status, color: 'info' as const };

  return (
    <Card onPress={onPress} style={{ marginBottom: theme.SPACING.md }}>
      <View style={{ flexDirection: 'row' }}>
        {/* Thumbnail 80x80 */}
        {property.photos?.[0] ? (
          <Image
            source={{ uri: property.photos[0] }}
            style={{
              width: 80,
              height: 80,
              borderRadius: theme.BORDER_RADIUS.md,
              marginRight: theme.SPACING.md,
            }}
          />
        ) : (
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: theme.BORDER_RADIUS.md,
              marginRight: theme.SPACING.md,
              backgroundColor: `${theme.colors.primary.main}08`,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name={getPropertyIcon(property.type)} size={28} color={theme.colors.primary.light} />
          </View>
        )}

        {/* Info */}
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, flex: 1, marginRight: theme.SPACING.sm }} numberOfLines={1}>
              {property.name}
            </Text>
            <Badge label={statusConf.label} color={statusConf.color} size="small" dot />
          </View>

          {property.address && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
              <Ionicons name="location-outline" size={12} color={theme.colors.text.secondary} />
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, flex: 1 }} numberOfLines={1}>
                {property.address}{property.city ? `, ${property.city}` : ''}
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.lg }}>
            {property.bedroomCount != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="bed-outline" size={13} color={theme.colors.text.disabled} />
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
                  {property.bedroomCount}
                </Text>
              </View>
            )}
            {property.maxGuests != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="people-outline" size={13} color={theme.colors.text.disabled} />
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
                  {property.maxGuests}
                </Text>
              </View>
            )}
            {property.nightlyPrice != null && (
              <Text style={{ ...theme.typography.body2, color: theme.colors.primary.main, fontWeight: '700' }}>
                {property.nightlyPrice}€
                <Text style={{ fontWeight: '400', color: theme.colors.text.disabled }}>/nuit</Text>
              </Text>
            )}
          </View>
        </View>
      </View>
    </Card>
  );
});
