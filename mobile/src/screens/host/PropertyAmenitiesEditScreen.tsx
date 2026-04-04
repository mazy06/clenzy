import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useProperty, useUpdatePropertyAmenities } from '@/hooks/useProperties';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/theme';

type IoniconsName = keyof typeof Ionicons.glyphMap;
type RouteParams = { PropertyAmenitiesEdit: { propertyId: number } };

interface AmenityDef {
  icon: IoniconsName;
  label: string;
  category: 'comfort' | 'kitchen' | 'appliances' | 'outdoor' | 'family';
}

const AMENITY_MAP: Record<string, AmenityDef> = {
  WIFI:              { icon: 'wifi-outline',           label: 'WiFi',              category: 'comfort' },
  TV:                { icon: 'tv-outline',             label: 'TV',                category: 'comfort' },
  AIR_CONDITIONING:  { icon: 'snow-outline',           label: 'Climatisation',     category: 'comfort' },
  HEATING:           { icon: 'flame-outline',          label: 'Chauffage',         category: 'comfort' },
  EQUIPPED_KITCHEN:  { icon: 'restaurant-outline',     label: 'Cuisine equipee',   category: 'kitchen' },
  DISHWASHER:        { icon: 'water-outline',          label: 'Lave-vaisselle',    category: 'kitchen' },
  MICROWAVE:         { icon: 'flash-outline',          label: 'Micro-ondes',       category: 'kitchen' },
  OVEN:              { icon: 'bonfire-outline',        label: 'Four',              category: 'kitchen' },
  WASHING_MACHINE:   { icon: 'shirt-outline',          label: 'Lave-linge',        category: 'appliances' },
  DRYER:             { icon: 'sunny-outline',          label: 'Seche-linge',       category: 'appliances' },
  IRON:              { icon: 'thermometer-outline',    label: 'Fer a repasser',    category: 'appliances' },
  HAIR_DRYER:        { icon: 'cut-outline',            label: 'Seche-cheveux',     category: 'appliances' },
  PARKING:           { icon: 'car-outline',            label: 'Parking',           category: 'outdoor' },
  POOL:              { icon: 'fish-outline',           label: 'Piscine',           category: 'outdoor' },
  JACUZZI:           { icon: 'sparkles-outline',       label: 'Jacuzzi',           category: 'outdoor' },
  GARDEN_TERRACE:    { icon: 'leaf-outline',           label: 'Jardin / Terrasse', category: 'outdoor' },
  BARBECUE:          { icon: 'bonfire-outline',        label: 'Barbecue',          category: 'outdoor' },
  SAFE:              { icon: 'lock-closed-outline',    label: 'Coffre-fort',       category: 'family' },
  BABY_BED:          { icon: 'bed-outline',            label: 'Lit bebe',          category: 'family' },
  HIGH_CHAIR:        { icon: 'accessibility-outline',  label: 'Chaise haute',      category: 'family' },
};

const CATEGORY_CONFIG: Record<string, { label: string; colorKey: 'primary' | 'success' | 'info' | 'warning' | 'secondary' }> = {
  comfort:    { label: 'Confort',              colorKey: 'primary' },
  kitchen:    { label: 'Cuisine',              colorKey: 'success' },
  appliances: { label: 'Electromenager',       colorKey: 'info' },
  outdoor:    { label: 'Exterieur',            colorKey: 'warning' },
  family:     { label: 'Securite & Famille',   colorKey: 'secondary' },
};

const CATEGORY_ORDER = ['comfort', 'kitchen', 'appliances', 'outdoor', 'family'] as const;

function AmenityCheckbox({
  amenityKey,
  def,
  checked,
  onToggle,
  theme,
}: {
  amenityKey: string;
  def: AmenityDef;
  checked: boolean;
  onToggle: (key: string) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const catColor = theme.colors[CATEGORY_CONFIG[def.category].colorKey].main;

  return (
    <Pressable
      onPress={() => onToggle(amenityKey)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm,
        paddingVertical: theme.SPACING.sm, paddingHorizontal: theme.SPACING.md,
        borderRadius: theme.BORDER_RADIUS.md, marginBottom: theme.SPACING.xs,
        backgroundColor: checked ? `${catColor}14` : 'transparent',
        borderWidth: 1.5,
        borderColor: checked ? catColor : theme.colors.border.light,
      }}
    >
      <View style={{
        width: 22, height: 22, borderRadius: theme.BORDER_RADIUS.sm,
        borderWidth: 2, borderColor: checked ? catColor : theme.colors.border.main,
        backgroundColor: checked ? catColor : 'transparent',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
      <Ionicons name={def.icon} size={18} color={checked ? catColor : theme.colors.text.secondary} />
      <Text style={{
        ...theme.typography.body2,
        color: checked ? theme.colors.text.primary : theme.colors.text.secondary,
        fontWeight: checked ? '600' : '400', flex: 1,
      }}>
        {def.label}
      </Text>
    </Pressable>
  );
}

export function PropertyAmenitiesEditScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'PropertyAmenitiesEdit'>>();
  const { propertyId } = route.params;

  const { data: property, isLoading } = useProperty(propertyId);
  const updateMutation = useUpdatePropertyAmenities();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (property?.amenities) {
      setSelected(new Set(property.amenities));
    }
  }, [property]);

  const handleToggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    updateMutation.mutate(
      { propertyId, amenities: Array.from(selected) },
      {
        onSuccess: () => {
          Alert.alert('Succes', 'Equipements mis a jour.');
          navigation.goBack();
        },
        onError: () => {
          Alert.alert('Erreur', 'Impossible de mettre a jour les equipements.');
        },
      },
    );
  }, [selected, propertyId, updateMutation, navigation]);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }}>
        <View style={{ padding: theme.SPACING.lg }}>
          <Skeleton width="50%" height={24} />
          <View style={{ height: theme.SPACING.xl }} />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={44} style={{ marginBottom: theme.SPACING.sm }} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  // Group amenities by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    config: CATEGORY_CONFIG[cat],
    amenities: Object.entries(AMENITY_MAP).filter(([, def]) => def.category === cat),
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.SPACING.lg,
        paddingVertical: theme.SPACING.md, gap: theme.SPACING.md,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, flex: 1 }}>
          Equipements
        </Text>
        <Text style={{ ...theme.typography.caption, color: theme.colors.primary.main, fontWeight: '600' }}>
          {selected.size} selectionne{selected.size > 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}
      >
        {grouped.map(({ category, config, amenities }) => (
          <Card key={category} style={{ marginBottom: theme.SPACING.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginBottom: theme.SPACING.md }}>
              <View style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: theme.colors[config.colorKey].main,
              }} />
              <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary, fontWeight: '600' }}>
                {config.label}
              </Text>
            </View>
            {amenities.map(([key, def]) => (
              <AmenityCheckbox
                key={key}
                amenityKey={key}
                def={def}
                checked={selected.has(key)}
                onToggle={handleToggle}
                theme={theme}
              />
            ))}
          </Card>
        ))}
      </ScrollView>

      {/* Floating save button */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: theme.SPACING.lg, paddingBottom: Platform.OS === 'ios' ? 34 : theme.SPACING.lg,
        backgroundColor: theme.colors.background.default,
        borderTopWidth: 1, borderTopColor: theme.colors.border.light,
        ...theme.shadows.md,
      }}>
        <Button
          title="Enregistrer"
          onPress={handleSave}
          loading={updateMutation.isPending}
          disabled={!hasChanges || updateMutation.isPending}
          fullWidth
          icon={<Ionicons name="checkmark" size={20} color={theme.colors.primary.contrastText} />}
        />
      </View>
    </SafeAreaView>
  );
}
