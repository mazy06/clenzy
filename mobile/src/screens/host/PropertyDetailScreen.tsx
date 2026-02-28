import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Image, Pressable, RefreshControl, Platform, Linking, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useProperty } from '@/hooks/useProperties';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/theme';
import { useAlurCompliance } from '@/hooks/useRegulatory';
import { ProgressBar } from '@/components/ui/ProgressBar';

type IoniconsName = keyof typeof Ionicons.glyphMap;

/* ─── Amenity icon map ─── */
const AMENITY_MAP: Record<string, { icon: IoniconsName; label: string }> = {
  WIFI:              { icon: 'wifi-outline',           label: 'WiFi' },
  TV:                { icon: 'tv-outline',             label: 'TV' },
  AIR_CONDITIONING:  { icon: 'snow-outline',           label: 'Clim' },
  HEATING:           { icon: 'flame-outline',          label: 'Chauffage' },
  EQUIPPED_KITCHEN:  { icon: 'restaurant-outline',     label: 'Cuisine' },
  DISHWASHER:        { icon: 'water-outline',          label: 'Lave-vaisselle' },
  MICROWAVE:         { icon: 'flash-outline',          label: 'Micro-ondes' },
  OVEN:              { icon: 'bonfire-outline',         label: 'Four' },
  WASHING_MACHINE:   { icon: 'shirt-outline',          label: 'Lave-linge' },
  DRYER:             { icon: 'sunny-outline',           label: 'Seche-linge' },
  IRON:              { icon: 'thermometer-outline',     label: 'Repassage' },
  HAIR_DRYER:        { icon: 'cut-outline',             label: 'Seche-cheveux' },
  PARKING:           { icon: 'car-outline',             label: 'Parking' },
  POOL:              { icon: 'fish-outline',             label: 'Piscine' },
  JACUZZI:           { icon: 'sparkles-outline',        label: 'Jacuzzi' },
  GARDEN_TERRACE:    { icon: 'leaf-outline',            label: 'Jardin' },
  BARBECUE:          { icon: 'bonfire-outline',          label: 'Barbecue' },
  SAFE:              { icon: 'lock-closed-outline',     label: 'Coffre-fort' },
  BABY_BED:          { icon: 'bed-outline',             label: 'Lit bebe' },
  HIGH_CHAIR:        { icon: 'accessibility-outline',   label: 'Chaise haute' },
};

/* ─── OSM Tile Map helpers ─── */

const TILE_SIZE = 256;
const MAP_ZOOM = 15;
const TILE_COLS = 3;
const TILE_ROWS = 2;

/** Convert lat/lng to fractional tile coordinates at a given zoom */
function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

/**
 * Pure-RN static map: renders a grid of OSM tiles with a pin overlay.
 * No native modules required — works in Expo Go.
 */
function OsmTileMap({
  latitude,
  longitude,
  width,
  height,
  onPress,
  theme,
}: {
  latitude: number;
  longitude: number;
  width: number;
  height: number;
  onPress?: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const tileData = useMemo(() => {
    const { x: fracX, y: fracY } = latLngToTile(latitude, longitude, MAP_ZOOM);
    const centerTileX = Math.floor(fracX);
    const centerTileY = Math.floor(fracY);

    // How many pixels the tile grid is (TILE_COLS * TILE_SIZE x TILE_ROWS * TILE_SIZE)
    const gridW = TILE_COLS * TILE_SIZE;
    const gridH = TILE_ROWS * TILE_SIZE;

    // Pixel position of the coordinate within the center tile
    const pixelInTileX = (fracX - centerTileX) * TILE_SIZE;
    const pixelInTileY = (fracY - centerTileY) * TILE_SIZE;

    // Offset of center tile origin relative to grid origin
    const centerColOffset = Math.floor(TILE_COLS / 2);
    const centerRowOffset = Math.floor(TILE_ROWS / 2);

    // Absolute pixel position of the coordinate within the grid
    const pinGridX = centerColOffset * TILE_SIZE + pixelInTileX;
    const pinGridY = centerRowOffset * TILE_SIZE + pixelInTileY;

    // We want the pin to be at the center of the visible area
    const offsetX = pinGridX - width / 2;
    const offsetY = pinGridY - height / 2;

    // Build tile array
    const tiles: { key: string; url: string; left: number; top: number }[] = [];
    for (let row = 0; row < TILE_ROWS; row++) {
      for (let col = 0; col < TILE_COLS; col++) {
        const tileX = centerTileX - centerColOffset + col;
        const tileY = centerTileY - centerRowOffset + row;
        tiles.push({
          key: `${tileX}-${tileY}`,
          url: `https://tile.openstreetmap.org/${MAP_ZOOM}/${tileX}/${tileY}.png`,
          left: col * TILE_SIZE - offsetX,
          top: row * TILE_SIZE - offsetY,
        });
      }
    }

    return { tiles, pinX: width / 2, pinY: height / 2 };
  }, [latitude, longitude, width, height]);

  return (
    <Pressable onPress={onPress} style={{ width, height, overflow: 'hidden', backgroundColor: theme.colors.background.surface }}>
      {/* Tile grid */}
      {tileData.tiles.map((t) => (
        <Image
          key={t.key}
          source={{ uri: t.url, headers: { 'User-Agent': 'ClenzyMobile/1.0' } }}
          style={{
            position: 'absolute',
            left: t.left,
            top: t.top,
            width: TILE_SIZE,
            height: TILE_SIZE,
          }}
        />
      ))}

      {/* Pin marker */}
      <View
        style={{
          position: 'absolute',
          left: tileData.pinX - 16,
          top: tileData.pinY - 38,
          alignItems: 'center',
        }}
        pointerEvents="none"
      >
        <Ionicons name="location" size={36} color={theme.colors.error.main} />
      </View>

      {/* "Open in Maps" badge */}
      <View
        style={{
          position: 'absolute',
          bottom: 10,
          right: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: theme.colors.background.paper,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: theme.BORDER_RADIUS.full,
          ...theme.shadows.md,
        }}
        pointerEvents="none"
      >
        <Ionicons name="navigate-outline" size={14} color={theme.colors.primary.main} />
        <Text style={{ ...theme.typography.caption, color: theme.colors.primary.main, fontWeight: '600' }}>
          Ouvrir dans Maps
        </Text>
      </View>

      {/* OSM attribution */}
      <View
        style={{
          position: 'absolute',
          bottom: 2,
          left: 4,
          backgroundColor: 'rgba(255,255,255,0.7)',
          paddingHorizontal: 4,
          paddingVertical: 1,
          borderRadius: 2,
        }}
        pointerEvents="none"
      >
        <Text style={{ fontSize: 8, color: '#555' }}>{'\u00A9'} OpenStreetMap</Text>
      </View>
    </Pressable>
  );
}

type PropertiesStackParamList = {
  PropertyList: undefined;
  PropertyDetail: { propertyId: number };
  PropertyOverview: { propertyId: number };
  PropertyInterventions: { propertyId: number };
  PropertyChannels: { propertyId: number };
  PropertyInstructions: { propertyId: number };
};

type RouteParams = { PropertyDetail: { propertyId: number } };
type NavProp = NativeStackNavigationProp<PropertiesStackParamList, 'PropertyDetail'>;

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  APARTMENT: 'Appartement', HOUSE: 'Maison', STUDIO: 'Studio', VILLA: 'Villa',
  LOFT: 'Loft', GUEST_ROOM: "Chambre d'hote", COTTAGE: 'Gite rural',
  CHALET: 'Chalet', BOAT: 'Bateau', OTHER: 'Autre',
};

const STATUS_MAP: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'info' }> = {
  ACTIVE: { label: 'Actif', color: 'success' },
  INACTIVE: { label: 'Inactif', color: 'warning' },
  UNDER_MAINTENANCE: { label: 'Maintenance', color: 'error' },
  ARCHIVED: { label: 'Archive', color: 'info' },
};

/* ─── Sub-components ─── */

function StatItem({ icon, label, value, theme }: {
  icon: IoniconsName; label: string; value: string; theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: theme.SPACING.md }}>
      <Ionicons name={icon} size={18} color={theme.colors.primary.main} style={{ marginBottom: 6 }} />
      <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: 2 }}>{value}</Text>
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>{label}</Text>
    </View>
  );
}

interface MenuTileProps {
  icon: IoniconsName;
  label: string;
  subtitle: string;
  color: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}

function MenuTile({ icon, label, subtitle, color, onPress, theme }: MenuTileProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: pressed ? theme.colors.background.surface : theme.colors.background.paper,
        borderRadius: theme.BORDER_RADIUS.lg,
        padding: theme.SPACING.lg,
        alignItems: 'center',
        ...theme.shadows.sm,
      })}
    >
      <View style={{
        width: 48, height: 48, borderRadius: theme.BORDER_RADIUS.md,
        backgroundColor: `${color}0C`,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: theme.SPACING.sm,
      }}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '600', textAlign: 'center' }}>
        {label}
      </Text>
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, textAlign: 'center', marginTop: 2 }}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

function AlurBadge({ propertyId, theme }: { propertyId: number; theme: ReturnType<typeof useTheme> }) {
  const { data: alur, isLoading } = useAlurCompliance(propertyId);

  if (isLoading || !alur) return null;

  const pct = Math.min(100, (alur.daysRented / alur.maxDays) * 100);
  const isWarning = alur.daysRemaining <= 20 && alur.daysRemaining > 0;
  const isDanger = alur.daysRemaining <= 0 || !alur.isCompliant;

  const barColor: 'success' | 'warning' | 'error' = isDanger ? 'error' : isWarning ? 'warning' : 'success';
  const textColor = isDanger ? theme.colors.error.main : isWarning ? theme.colors.warning.main : theme.colors.success.main;
  const bgColor = isDanger ? `${theme.colors.error.main}10` : isWarning ? `${theme.colors.warning.main}10` : `${theme.colors.success.main}10`;

  return (
    <View style={{
      marginBottom: theme.SPACING.md,
      padding: theme.SPACING.md,
      backgroundColor: bgColor,
      borderRadius: theme.BORDER_RADIUS.lg,
      borderWidth: isDanger ? 1.5 : 0,
      borderColor: isDanger ? theme.colors.error.main : 'transparent',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons
            name={isDanger ? 'warning' : isWarning ? 'alert-circle-outline' : 'shield-checkmark-outline'}
            size={18}
            color={textColor}
          />
          <Text style={{ ...theme.typography.body2, fontWeight: '700', color: textColor }}>
            Conformite ALUR
          </Text>
        </View>
        <Text style={{ ...theme.typography.h4, fontWeight: '800', color: textColor }}>
          {alur.daysRemaining}j
        </Text>
      </View>

      <ProgressBar progress={pct} color={barColor} height={8} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
          {alur.daysRented} / {alur.maxDays} jours loues
        </Text>
        <Text style={{ ...theme.typography.caption, color: textColor, fontWeight: '600' }}>
          {alur.daysRemaining} jours restants
        </Text>
      </View>

      {alur.alertMessage && (
        <Text style={{ ...theme.typography.caption, color: textColor, marginTop: 6, fontStyle: 'italic' }}>
          {alur.alertMessage}
        </Text>
      )}
    </View>
  );
}

function DetailSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
      <Skeleton height={200} borderRadius={theme.BORDER_RADIUS.lg} />
      <Skeleton height={28} width="60%" />
      <Skeleton height={16} width="85%" />
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginTop: theme.SPACING.sm }}>
        <Skeleton height={80} style={{ flex: 1 }} borderRadius={theme.BORDER_RADIUS.md} />
        <Skeleton height={80} style={{ flex: 1 }} borderRadius={theme.BORDER_RADIUS.md} />
        <Skeleton height={80} style={{ flex: 1 }} borderRadius={theme.BORDER_RADIUS.md} />
      </View>
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginTop: theme.SPACING.lg }}>
        <Skeleton height={110} style={{ flex: 1 }} borderRadius={theme.BORDER_RADIUS.lg} />
        <Skeleton height={110} style={{ flex: 1 }} borderRadius={theme.BORDER_RADIUS.lg} />
      </View>
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
        <Skeleton height={110} style={{ flex: 1 }} borderRadius={theme.BORDER_RADIUS.lg} />
        <Skeleton height={110} style={{ flex: 1 }} borderRadius={theme.BORDER_RADIUS.lg} />
      </View>
    </View>
  );
}

/* ─── Main Screen ─── */

export function PropertyDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp<RouteParams, 'PropertyDetail'>>();
  const { propertyId } = route.params;

  const { data: property, isLoading, isError, error, isRefetching, refetch } = useProperty(propertyId);

  // Geocode address when lat/lng not available
  const [geocoded, setGeocoded] = useState<{ latitude: number; longitude: number } | null>(null);

  const fullAddress = property
    ? [property.address, property.postalCode, property.city].filter(Boolean).join(', ')
    : '';

  useEffect(() => {
    if (!property) return;
    if (property.latitude != null && property.longitude != null) return;
    if (!fullAddress && !property.city) return;

    let cancelled = false;

    async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: query, format: 'json', limit: '1' })}`,
          { headers: { 'User-Agent': 'ClenzyMobile/1.0' } },
        );
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
      } catch { /* silent */ }
      return null;
    }

    (async () => {
      // 1. Try full address
      if (fullAddress) {
        const result = await geocode(fullAddress);
        if (!cancelled && result) {
          setGeocoded({ latitude: result.lat, longitude: result.lon });
          return;
        }
      }
      // 2. Fallback: city only
      if (property.city) {
        const cityQuery = [property.postalCode, property.city, property.country].filter(Boolean).join(', ');
        const result = await geocode(cityQuery);
        if (!cancelled && result) {
          setGeocoded({ latitude: result.lat, longitude: result.lon });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [property?.id, fullAddress, property?.city]);

  // Resolved coords: from property or geocoded
  const coords = (property?.latitude != null && property?.longitude != null)
    ? { latitude: property.latitude, longitude: property.longitude }
    : geocoded;

  const openInMaps = useCallback(() => {
    if (coords) {
      const label = encodeURIComponent(property?.name || fullAddress);
      const url = Platform.select({
        ios: `maps:0,0?q=${coords.latitude},${coords.longitude}(${label})`,
        android: `geo:0,0?q=${coords.latitude},${coords.longitude}(${label})`,
      }) ?? `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`;
      Linking.openURL(url);
    } else if (fullAddress) {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`);
    }
  }, [coords, property?.name, fullAddress]);

  const { width: mapWidth } = useWindowDimensions();

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <DetailSkeleton theme={theme} />
      </SafeAreaView>
    );
  }

  if (isError || !property) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <EmptyState
          iconName="warning-outline"
          title="Propriete introuvable"
          description={error ? (error instanceof Error ? error.message : JSON.stringify(error)) : undefined}
          actionLabel="Retour"
          onAction={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  const statusInfo = STATUS_MAP[property.status] ?? { label: property.status, color: 'info' as const };
  const typeLabel = PROPERTY_TYPE_LABELS[property.type] ?? property.type;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
      >
        {/* Back button */}
        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            position: 'absolute', top: theme.SPACING.md, left: theme.SPACING.md, zIndex: 10,
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: theme.colors.background.paper,
            alignItems: 'center', justifyContent: 'center',
            ...theme.shadows.md,
          }}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.text.primary} />
        </Pressable>

        {/* Hero */}
        {property.photos?.[0] ? (
          <Image
            source={{ uri: property.photos[0] }}
            style={{ width: '100%', height: 220, backgroundColor: theme.colors.background.surface }}
          />
        ) : coords ? (
          <OsmTileMap
            latitude={coords.latitude}
            longitude={coords.longitude}
            width={mapWidth}
            height={200}
            onPress={openInMaps}
            theme={theme}
          />
        ) : (
          <View style={{
            width: '100%', height: 180,
            backgroundColor: `${theme.colors.primary.main}08`,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="home-outline" size={48} color={theme.colors.primary.light} />
          </View>
        )}

        <View style={{ padding: theme.SPACING.lg }}>
          {/* Name + Status + Type */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.SPACING.xs }}>
            <View style={{ flex: 1, marginRight: theme.SPACING.sm }}>
              <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary }}>{property.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 3,
                  borderRadius: theme.BORDER_RADIUS.sm,
                  backgroundColor: `${theme.colors.primary.main}0C`,
                }}>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.primary.main, fontWeight: '600' }}>{typeLabel}</Text>
                </View>
                {fullAddress ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1 }}>
                    <Ionicons name="location-outline" size={13} color={theme.colors.text.secondary} />
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }} numberOfLines={1}>
                      {fullAddress}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Badge label={statusInfo.label} color={statusInfo.color} dot />
          </View>

          {/* Stats row */}
          <Card variant="filled" style={{ marginBottom: theme.SPACING.xl, marginTop: theme.SPACING.md }}>
            <View style={{ flexDirection: 'row' }}>
              {property.bedroomCount != null && <StatItem icon="bed-outline" label="Chambres" value={String(property.bedroomCount)} theme={theme} />}
              {property.bathroomCount != null && <StatItem icon="water-outline" label="SDB" value={String(property.bathroomCount)} theme={theme} />}
              {property.maxGuests != null && <StatItem icon="people-outline" label="Voyageurs" value={String(property.maxGuests)} theme={theme} />}
              {property.squareMeters != null && <StatItem icon="resize-outline" label="Surface" value={`${property.squareMeters}m\u00B2`} theme={theme} />}
            </View>
          </Card>

          {/* ALUR Compliance badge */}
          <AlurBadge propertyId={propertyId} theme={theme} />

          {/* ═══════════════════════════════════════════════
              NAVIGATION MENU — 2x2 grid
             ═══════════════════════════════════════════════ */}

          <View style={{ gap: theme.SPACING.sm }}>
            <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
              <MenuTile
                icon="layers-outline"
                label="Vue d'ensemble"
                subtitle="Infos, tarifs, menage"
                color={theme.colors.primary.main}
                onPress={() => navigation.navigate('PropertyOverview', { propertyId })}
                theme={theme}
              />
              <MenuTile
                icon="construct-outline"
                label="Interventions"
                subtitle="Historique & suivi"
                color={theme.colors.secondary.main}
                onPress={() => navigation.navigate('PropertyInterventions', { propertyId })}
                theme={theme}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
              <MenuTile
                icon="git-network-outline"
                label="Channels"
                subtitle="Airbnb, integrations"
                color={theme.colors.warning.main}
                onPress={() => navigation.navigate('PropertyChannels', { propertyId })}
                theme={theme}
              />
              <MenuTile
                icon="book-outline"
                label="Instructions"
                subtitle="Consignes voyageurs"
                color={theme.colors.info.main}
                onPress={() => navigation.navigate('PropertyInstructions', { propertyId })}
                theme={theme}
              />
            </View>
          </View>

          {/* Amenities / Equipements */}
          {property.amenities && property.amenities.filter((a: string) => AMENITY_MAP[a]).length > 0 && (
            <Card
              variant="filled"
              style={{ marginTop: theme.SPACING.xl }}
              onPress={() => navigation.navigate('PropertyOverview', { propertyId })}
            >
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                {property.amenities
                  .filter((a: string) => AMENITY_MAP[a])
                  .slice(0, 8)
                  .map((a: string) => {
                    const def = AMENITY_MAP[a];
                    return (
                      <View key={a} style={{ width: '25%', alignItems: 'center', paddingVertical: theme.SPACING.sm }}>
                        <View style={{
                          width: 40, height: 40, borderRadius: 20,
                          backgroundColor: `${theme.colors.primary.main}10`,
                          alignItems: 'center', justifyContent: 'center',
                          marginBottom: 6,
                        }}>
                          <Ionicons name={def.icon} size={18} color={theme.colors.primary.main} />
                        </View>
                        <Text
                          style={{ ...theme.typography.caption, color: theme.colors.text.secondary, textAlign: 'center', lineHeight: 14, fontSize: 10 }}
                          numberOfLines={1}
                        >
                          {def.label}
                        </Text>
                      </View>
                    );
                  })}
              </View>
              {property.amenities.filter((a: string) => AMENITY_MAP[a]).length > 8 && (
                <Text style={{ ...theme.typography.caption, color: theme.colors.primary.main, textAlign: 'center', marginTop: theme.SPACING.xs }}>
                  +{property.amenities.filter((a: string) => AMENITY_MAP[a]).length - 8} autres
                </Text>
              )}
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
