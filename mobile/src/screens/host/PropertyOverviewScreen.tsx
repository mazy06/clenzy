import { useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useProperty } from '@/hooks/useProperties';
import { Accordion } from '@/components/ui/Accordion';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/theme';

type IoniconsName = keyof typeof Ionicons.glyphMap;
type RouteParams = { PropertyOverview: { propertyId: number } };

/* ─── Amenity Config ─── */

interface AmenityDef {
  icon: IoniconsName;
  label: string;
  category: 'comfort' | 'kitchen' | 'appliances' | 'outdoor' | 'family';
}

const AMENITY_MAP: Record<string, AmenityDef> = {
  WIFI:              { icon: 'wifi-outline',         label: 'WiFi',              category: 'comfort' },
  TV:                { icon: 'tv-outline',           label: 'TV',                category: 'comfort' },
  AIR_CONDITIONING:  { icon: 'snow-outline',         label: 'Climatisation',     category: 'comfort' },
  HEATING:           { icon: 'flame-outline',        label: 'Chauffage',         category: 'comfort' },
  EQUIPPED_KITCHEN:  { icon: 'restaurant-outline',   label: 'Cuisine equipee',   category: 'kitchen' },
  DISHWASHER:        { icon: 'water-outline',        label: 'Lave-vaisselle',    category: 'kitchen' },
  MICROWAVE:         { icon: 'flash-outline',        label: 'Micro-ondes',       category: 'kitchen' },
  OVEN:              { icon: 'bonfire-outline',       label: 'Four',              category: 'kitchen' },
  WASHING_MACHINE:   { icon: 'shirt-outline',        label: 'Lave-linge',        category: 'appliances' },
  DRYER:             { icon: 'sunny-outline',         label: 'Seche-linge',       category: 'appliances' },
  IRON:              { icon: 'thermometer-outline',   label: 'Fer a repasser',    category: 'appliances' },
  HAIR_DRYER:        { icon: 'cut-outline',           label: 'Seche-cheveux',     category: 'appliances' },
  PARKING:           { icon: 'car-outline',           label: 'Parking',           category: 'outdoor' },
  POOL:              { icon: 'fish-outline',           label: 'Piscine',           category: 'outdoor' },
  JACUZZI:           { icon: 'sparkles-outline',      label: 'Jacuzzi',           category: 'outdoor' },
  GARDEN_TERRACE:    { icon: 'leaf-outline',          label: 'Jardin / Terrasse', category: 'outdoor' },
  BARBECUE:          { icon: 'bonfire-outline',       label: 'Barbecue',          category: 'outdoor' },
  SAFE:              { icon: 'lock-closed-outline',   label: 'Coffre-fort',       category: 'family' },
  BABY_BED:          { icon: 'bed-outline',           label: 'Lit bebe',          category: 'family' },
  HIGH_CHAIR:        { icon: 'accessibility-outline', label: 'Chaise haute',      category: 'family' },
};

const CATEGORY_CONFIG: Record<string, { label: string; colorKey: 'primary' | 'success' | 'info' | 'warning' | 'secondary' }> = {
  comfort:    { label: 'Confort',              colorKey: 'primary' },
  kitchen:    { label: 'Cuisine',              colorKey: 'success' },
  appliances: { label: 'Electromenager',       colorKey: 'info' },
  outdoor:    { label: 'Exterieur',            colorKey: 'warning' },
  family:     { label: 'Securite & Famille',   colorKey: 'secondary' },
};

const CATEGORY_ORDER = ['comfort', 'kitchen', 'appliances', 'outdoor', 'family'] as const;

/* ─── Sub-components ─── */

function AmenityTile({ def, color, theme }: {
  def: AmenityDef; color: string; theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{
      width: '31%',
      alignItems: 'center',
      paddingVertical: theme.SPACING.md,
      paddingHorizontal: 4,
    }}>
      <View style={{
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: `${color}10`,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 8,
      }}>
        <Ionicons name={def.icon} size={20} color={color} />
      </View>
      <Text style={{
        ...theme.typography.caption,
        color: theme.colors.text.primary,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 16,
      }} numberOfLines={2}>
        {def.label}
      </Text>
    </View>
  );
}

/* ─── Cleaning Notes (expandable) ─── */

function CleaningNotesSection({ notes, theme }: { notes?: string; theme: ReturnType<typeof useTheme> }) {
  const [expanded, setExpanded] = useState(false);
  const placeholder = !notes;
  const displayText = notes ?? 'Aucune note de menage';
  const isLong = (notes?.split('\n').length ?? 0) > 3 || (notes?.length ?? 0) > 200;

  return (
    <Accordion
      title="Notes de menage"
      iconName="document-text-outline"
      iconColor={theme.colors.info.main}
      defaultOpen
      style={{ marginBottom: theme.SPACING.sm }}
    >
      <Text
        style={{
          ...theme.typography.body2,
          color: placeholder ? theme.colors.text.disabled : theme.colors.text.secondary,
          fontStyle: placeholder ? 'italic' : 'normal',
          lineHeight: 22,
        }}
        numberOfLines={!expanded && isLong ? 3 : undefined}
      >
        {displayText}
      </Text>
      {isLong && (
        <Pressable onPress={() => setExpanded((v) => !v)} style={{ marginTop: theme.SPACING.sm }}>
          <Text style={{ ...theme.typography.caption, color: theme.colors.primary.main, fontWeight: '600' }}>
            {expanded ? 'Voir moins' : 'Voir plus'}
          </Text>
        </Pressable>
      )}
    </Accordion>
  );
}

/* ─── Cleaning Config Info Item ─── */

function ConfigItem({ icon, label, value, color, theme }: {
  icon: IoniconsName; label: string; value: string; color: string; theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: theme.SPACING.sm, paddingHorizontal: theme.SPACING.md,
      backgroundColor: `${color}06`, borderRadius: theme.BORDER_RADIUS.md,
    }}>
      <View style={{
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: `${color}10`, alignItems: 'center', justifyContent: 'center',
        marginRight: theme.SPACING.md,
      }}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, flex: 1 }}>{label}</Text>
      <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

/* ─── Service Chip (non-interactive) ─── */

function ServiceChip({ label, active, theme }: {
  label: string; active: boolean; theme: ReturnType<typeof useTheme>;
}) {
  const bg = active ? `${theme.colors.success.main}14` : `${theme.colors.text.disabled}0A`;
  const fg = active ? theme.colors.success.main : theme.colors.text.disabled;
  return (
    <View style={{
      paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: theme.BORDER_RADIUS.full,
      backgroundColor: bg,
      borderWidth: 1,
      borderColor: active ? `${theme.colors.success.main}30` : theme.colors.border.main,
    }}>
      <Text style={{ ...theme.typography.caption, color: fg, fontWeight: active ? '600' : '400' }}>
        {label}
      </Text>
    </View>
  );
}

/* ─── Main Screen ─── */

export function PropertyOverviewScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'PropertyOverview'>>();
  const { propertyId } = route.params;

  const { data: property, isLoading, isRefetching, refetch, isError } = useProperty(propertyId);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
          <Skeleton height={20} width="40%" />
          <Skeleton height={56} borderRadius={theme.BORDER_RADIUS.lg} />
          <Skeleton height={56} borderRadius={theme.BORDER_RADIUS.lg} />
          <Skeleton height={200} borderRadius={theme.BORDER_RADIUS.lg} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !property) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <EmptyState iconName="warning-outline" title="Erreur" actionLabel="Retour" onAction={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  // Group amenities by category
  const amenities = property.amenities ?? [];
  const grouped: Record<string, AmenityDef[]> = {};
  for (const a of amenities) {
    const def = AMENITY_MAP[a];
    if (def) {
      (grouped[def.category] ??= []).push(def);
    }
  }
  const hasAmenities = amenities.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: theme.SPACING.lg, paddingVertical: theme.SPACING.md,
        borderBottomWidth: 1, borderBottomColor: theme.colors.border.light,
        backgroundColor: theme.colors.background.paper,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{ marginRight: theme.SPACING.md }}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, flex: 1 }} numberOfLines={1}>
          Vue d'ensemble
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
      >
        {/* Description */}
        {property.description ? (
          <Accordion title="Description du logement" iconName="document-text-outline" iconColor={theme.colors.info.main} defaultOpen style={{ marginBottom: theme.SPACING.sm }}>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, lineHeight: 22 }}>
              {property.description}
            </Text>
          </Accordion>
        ) : null}

        {/* Tarification */}
        <Accordion title="Tarification" iconName="pricetag-outline" iconColor={theme.colors.primary.main} defaultOpen style={{ marginBottom: theme.SPACING.lg }}>
          {property.nightlyPrice != null && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingVertical: theme.SPACING.md, paddingHorizontal: theme.SPACING.md,
              backgroundColor: `${theme.colors.primary.main}06`, borderRadius: theme.BORDER_RADIUS.md,
              marginBottom: theme.SPACING.sm,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm }}>
                <Ionicons name="moon-outline" size={18} color={theme.colors.primary.main} />
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary }}>Prix par nuit</Text>
              </View>
              <Text style={{ ...theme.typography.h3, color: theme.colors.primary.main }}>{property.nightlyPrice}{'\u20AC'}</Text>
            </View>
          )}
          {property.cleaningBasePrice != null && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingVertical: theme.SPACING.md, paddingHorizontal: theme.SPACING.md,
              backgroundColor: `${theme.colors.secondary.main}06`, borderRadius: theme.BORDER_RADIUS.md,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm }}>
                <Ionicons name="sparkles-outline" size={18} color={theme.colors.secondary.main} />
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary }}>Tarif menage</Text>
              </View>
              <Text style={{ ...theme.typography.h3, color: theme.colors.secondary.main }}>{property.cleaningBasePrice}{'\u20AC'}</Text>
            </View>
          )}
          {property.nightlyPrice == null && property.cleaningBasePrice == null && (
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.disabled, fontStyle: 'italic' }}>Aucun tarif renseigne</Text>
          )}
        </Accordion>

        {/* Configuration menage */}
        {(() => {
          const configItems: { icon: IoniconsName; label: string; value: string; color: string }[] = [];
          if (property.numberOfFloors != null)
            configItems.push({ icon: 'layers-outline', label: 'Nombre d\'etages', value: `${property.numberOfFloors}`, color: theme.colors.info.main });
          if (property.cleaningDurationMinutes != null)
            configItems.push({ icon: 'time-outline', label: 'Duree estimee', value: `${property.cleaningDurationMinutes} min`, color: theme.colors.primary.main });
          if (property.cleaningBasePrice != null)
            configItems.push({ icon: 'cash-outline', label: 'Prix de base', value: `${property.cleaningBasePrice}\u20AC`, color: theme.colors.secondary.main });

          const booleanChips: { label: string; active: boolean }[] = [];
          if (property.hasExterior != null)
            booleanChips.push({ label: `Exterieur : ${property.hasExterior ? 'Oui' : 'Non'}`, active: property.hasExterior });
          if (property.hasLaundry != null)
            booleanChips.push({ label: `Buanderie : ${property.hasLaundry ? 'Oui' : 'Non'}`, active: property.hasLaundry });

          if (configItems.length === 0 && booleanChips.length === 0) return null;

          return (
            <Accordion
              title="Configuration menage"
              iconName="settings-outline"
              iconColor={theme.colors.secondary.main}
              defaultOpen
              style={{ marginBottom: theme.SPACING.sm }}
            >
              <View style={{ gap: theme.SPACING.sm }}>
                {configItems.map((item) => (
                  <ConfigItem key={item.label} icon={item.icon} label={item.label} value={item.value} color={item.color} theme={theme} />
                ))}
                {booleanChips.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.SPACING.sm, marginTop: configItems.length > 0 ? theme.SPACING.xs : 0 }}>
                    {booleanChips.map((chip) => (
                      <ServiceChip key={chip.label} label={chip.label} active={chip.active} theme={theme} />
                    ))}
                  </View>
                )}
              </View>
            </Accordion>
          );
        })()}

        {/* Prestations a la carte */}
        {(() => {
          const services: { label: string; active: boolean }[] = [];
          if (property.windowCount != null && property.windowCount > 0)
            services.push({ label: `${property.windowCount} fenetre${property.windowCount > 1 ? 's' : ''}`, active: true });
          if (property.frenchDoorCount != null && property.frenchDoorCount > 0)
            services.push({ label: `${property.frenchDoorCount} porte-fenetre${property.frenchDoorCount > 1 ? 's' : ''}`, active: true });
          if (property.slidingDoorCount != null && property.slidingDoorCount > 0)
            services.push({ label: `${property.slidingDoorCount} baie${property.slidingDoorCount > 1 ? 's' : ''} vitree${property.slidingDoorCount > 1 ? 's' : ''}`, active: true });
          if (property.hasIroning)
            services.push({ label: 'Repassage', active: true });
          if (property.hasDeepKitchen)
            services.push({ label: 'Nettoyage cuisine', active: true });
          if (property.hasDisinfection)
            services.push({ label: 'Desinfection', active: true });

          if (services.length === 0) return null;

          return (
            <Accordion
              title="Prestations a la carte"
              iconName="list-outline"
              iconColor={theme.colors.warning.main}
              badge={`${services.length}`}
              defaultOpen
              style={{ marginBottom: theme.SPACING.sm }}
            >
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.SPACING.sm }}>
                {services.map((s) => (
                  <ServiceChip key={s.label} label={s.label} active={s.active} theme={theme} />
                ))}
              </View>
            </Accordion>
          );
        })()}

        {/* Notes de menage */}
        <CleaningNotesSection notes={property.cleaningNotes} theme={theme} />

        {/* ═══════════════════════════════════════════════
            EQUIPEMENTS — Grid with icons, grouped by category
           ═══════════════════════════════════════════════ */}

        {/* Section header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.SPACING.md, marginBottom: theme.SPACING.lg }}>
          <View style={{
            width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: `${theme.colors.info.main}0C`,
            alignItems: 'center', justifyContent: 'center',
            marginRight: theme.SPACING.md,
          }}>
            <Ionicons name="wifi-outline" size={18} color={theme.colors.info.main} />
          </View>
          <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary, flex: 1 }}>Equipements</Text>
          {hasAmenities && (
            <View style={{
              paddingHorizontal: 10, paddingVertical: 3,
              borderRadius: theme.BORDER_RADIUS.full,
              backgroundColor: `${theme.colors.info.main}0C`,
            }}>
              <Text style={{ ...theme.typography.caption, color: theme.colors.info.main, fontWeight: '700' }}>
                {amenities.length}
              </Text>
            </View>
          )}
        </View>

        {hasAmenities ? (
          CATEGORY_ORDER.map((catKey) => {
            const items = grouped[catKey];
            if (!items || items.length === 0) return null;
            const cat = CATEGORY_CONFIG[catKey];
            const color = theme.colors[cat.colorKey].main;

            return (
              <Card key={catKey} variant="filled" style={{ marginBottom: theme.SPACING.md }}>
                {/* Category header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.SPACING.sm }}>
                  <View style={{
                    width: 6, height: 6, borderRadius: 3,
                    backgroundColor: color,
                  }} />
                  <Text style={{ ...theme.typography.overline, color: theme.colors.text.disabled }}>
                    {cat.label.toUpperCase()}
                  </Text>
                </View>

                {/* Amenity tiles grid */}
                <View style={{
                  flexDirection: 'row', flexWrap: 'wrap',
                  justifyContent: 'flex-start',
                  gap: theme.SPACING.xs,
                }}>
                  {items.map((def) => (
                    <AmenityTile key={def.label} def={def} color={color} theme={theme} />
                  ))}
                </View>
              </Card>
            );
          })
        ) : (
          <Card variant="filled" style={{ alignItems: 'center', paddingVertical: theme.SPACING.xl }}>
            <Ionicons name="wifi-outline" size={32} color={theme.colors.text.disabled} style={{ marginBottom: theme.SPACING.sm }} />
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.disabled, fontStyle: 'italic' }}>
              Aucun equipement renseigne
            </Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
