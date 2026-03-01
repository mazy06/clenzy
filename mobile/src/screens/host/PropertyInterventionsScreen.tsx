import { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useInterventions } from '@/hooks/useInterventions';
import { useProperty } from '@/hooks/useProperties';
import { InterventionCard } from '@/components/domain/InterventionCard';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/theme';

type IoniconsName = keyof typeof Ionicons.glyphMap;
type RouteParams = { PropertyInterventions: { propertyId: number } };

/* ─── Constants ─── */

const CLEANING_TYPES = new Set([
  'CLEANING', 'EXPRESS_CLEANING', 'DEEP_CLEANING', 'WINDOW_CLEANING',
  'FLOOR_CLEANING', 'KITCHEN_CLEANING', 'BATHROOM_CLEANING',
]);

const MAINTENANCE_TYPES = new Set([
  'PREVENTIVE_MAINTENANCE', 'EMERGENCY_REPAIR', 'ELECTRICAL_REPAIR',
  'PLUMBING_REPAIR', 'HVAC_REPAIR', 'APPLIANCE_REPAIR',
]);

const CLEANING_FREQ_LABELS: Record<string, string> = {
  AFTER_EACH_STAY: 'Apres chaque sejour',
  WEEKLY: 'Hebdomadaire',
  BIWEEKLY: 'Bi-mensuel',
  MONTHLY: 'Mensuel',
  ON_DEMAND: 'A la demande',
};

type TabKey = 'cleaning' | 'maintenance' | 'other';

interface TabDef {
  key: TabKey;
  label: string;
  icon: IoniconsName;
}

const TABS: TabDef[] = [
  { key: 'cleaning', label: 'Menage', icon: 'sparkles-outline' },
  { key: 'maintenance', label: 'Maintenance', icon: 'construct-outline' },
  { key: 'other', label: 'Autre', icon: 'ellipsis-horizontal-outline' },
];

/* ─── Helpers ─── */

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/* ─── Sub-components ─── */

function InfoRow({ icon, label, value, theme, valueColor }: {
  icon: IoniconsName; label: string; value: string; theme: ReturnType<typeof useTheme>; valueColor?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
      <Ionicons name={icon} size={16} color={theme.colors.text.disabled} style={{ marginRight: theme.SPACING.md, width: 20 }} />
      <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, flex: 1 }}>{label}</Text>
      <Text style={{ ...theme.typography.body2, color: valueColor || theme.colors.text.primary, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

function CleaningTaskRow({ icon, label, active, detail, theme }: {
  icon: IoniconsName; label: string; active: boolean; detail?: string; theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, opacity: active ? 1 : 0.45 }}>
      <View style={{
        width: 28, height: 28, borderRadius: theme.BORDER_RADIUS.sm,
        backgroundColor: active ? `${theme.colors.success.main}0C` : theme.colors.background.surface,
        alignItems: 'center', justifyContent: 'center', marginRight: theme.SPACING.md,
      }}>
        <Ionicons name={icon} size={14} color={active ? theme.colors.success.main : theme.colors.text.disabled} />
      </View>
      <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, flex: 1 }}>{label}</Text>
      {active ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {detail && <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>{detail}</Text>}
          <Ionicons name="checkmark-circle" size={16} color={theme.colors.success.main} />
        </View>
      ) : (
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Non inclus</Text>
      )}
    </View>
  );
}

function InterventionsSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} height={80} borderRadius={theme.BORDER_RADIUS.lg} />
      ))}
    </View>
  );
}

/* ─── Cleaning Config Section ─── */

function CleaningConfigSection({ theme, property }: {
  theme: ReturnType<typeof useTheme>;
  property: {
    cleaningFrequency?: string;
    cleaningDurationMinutes?: number;
    cleaningBasePrice?: number;
    numberOfFloors?: number;
    hasExterior?: boolean;
    hasLaundry?: boolean;
    windowCount?: number;
    frenchDoorCount?: number;
    slidingDoorCount?: number;
    hasIroning?: boolean;
    hasDeepKitchen?: boolean;
    hasDisinfection?: boolean;
    cleaningNotes?: string;
  };
}) {
  const freqLabel = CLEANING_FREQ_LABELS[property.cleaningFrequency ?? ''] ?? property.cleaningFrequency;
  const totalWindows = (property.windowCount ?? 0) + (property.frenchDoorCount ?? 0) + (property.slidingDoorCount ?? 0);

  return (
    <Card style={{ marginBottom: theme.SPACING.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
        <View style={{
          width: 32, height: 32, borderRadius: theme.BORDER_RADIUS.sm,
          backgroundColor: `${theme.colors.secondary.main}0C`,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="sparkles-outline" size={16} color={theme.colors.secondary.main} />
        </View>
        <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary, fontWeight: '600', flex: 1 }}>
          Consignes de menage
        </Text>
        {freqLabel ? (
          <View style={{
            paddingHorizontal: 8, paddingVertical: 3,
            borderRadius: theme.BORDER_RADIUS.full,
            backgroundColor: `${theme.colors.secondary.main}0C`,
          }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.secondary.main, fontWeight: '700' }}>
              {freqLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Summary cards */}
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
        <View style={{
          flex: 1, backgroundColor: `${theme.colors.secondary.main}08`, borderRadius: theme.BORDER_RADIUS.md,
          paddingVertical: theme.SPACING.md, paddingHorizontal: theme.SPACING.sm, alignItems: 'center',
        }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${theme.colors.secondary.main}15`, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Ionicons name="repeat-outline" size={18} color={theme.colors.secondary.main} />
          </View>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, textAlign: 'center', fontWeight: '600' }}>Frequence</Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.secondary.main, textAlign: 'center', marginTop: 2, fontWeight: '700' }}>{freqLabel ?? 'Non defini'}</Text>
        </View>
        <View style={{
          flex: 1, backgroundColor: `${theme.colors.info.main}08`, borderRadius: theme.BORDER_RADIUS.md,
          paddingVertical: theme.SPACING.md, paddingHorizontal: theme.SPACING.sm, alignItems: 'center',
        }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${theme.colors.info.main}15`, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Ionicons name="time-outline" size={18} color={theme.colors.info.main} />
          </View>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, textAlign: 'center', fontWeight: '600' }}>Duree</Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.info.main, textAlign: 'center', marginTop: 2, fontWeight: '700' }}>
            {property.cleaningDurationMinutes ? formatDuration(property.cleaningDurationMinutes) : 'Auto'}
          </Text>
        </View>
        <View style={{
          flex: 1, backgroundColor: `${theme.colors.success.main}08`, borderRadius: theme.BORDER_RADIUS.md,
          paddingVertical: theme.SPACING.md, paddingHorizontal: theme.SPACING.sm, alignItems: 'center',
        }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${theme.colors.success.main}15`, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Ionicons name="cash-outline" size={18} color={theme.colors.success.main} />
          </View>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, textAlign: 'center', fontWeight: '600' }}>Tarif</Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.success.main, textAlign: 'center', marginTop: 2, fontWeight: '700' }}>
            {property.cleaningBasePrice != null ? `${property.cleaningBasePrice}\u20AC` : 'N/A'}
          </Text>
        </View>
      </View>

      {/* Property characteristics */}
      <Text style={{ ...theme.typography.overline, color: theme.colors.text.disabled, marginBottom: theme.SPACING.sm }}>CARACTERISTIQUES DU LOGEMENT</Text>
      <InfoRow icon="layers-outline" label="Etages" value={property.numberOfFloors ? String(property.numberOfFloors) : '1'} theme={theme} />
      <InfoRow icon="leaf-outline" label="Exterieur" value={property.hasExterior ? 'Oui' : 'Non'} theme={theme} valueColor={property.hasExterior ? theme.colors.success.main : undefined} />
      <InfoRow icon="shirt-outline" label="Buanderie" value={property.hasLaundry !== false ? 'Oui' : 'Non'} theme={theme} valueColor={property.hasLaundry !== false ? theme.colors.success.main : undefined} />

      <View style={{ height: 1, backgroundColor: theme.colors.border.light, marginVertical: theme.SPACING.md }} />

      {/* Extra services */}
      <Text style={{ ...theme.typography.overline, color: theme.colors.text.disabled, marginBottom: theme.SPACING.sm }}>PRESTATIONS EXTRA</Text>
      <CleaningTaskRow icon="grid-outline" label="Nettoyage des vitres" active={totalWindows > 0}
        detail={totalWindows > 0 ? `${property.windowCount ?? 0} fen., ${property.frenchDoorCount ?? 0} p-fen., ${property.slidingDoorCount ?? 0} baies` : undefined} theme={theme} />
      <CleaningTaskRow icon="shirt-outline" label="Repassage" active={!!property.hasIroning} theme={theme} />
      <CleaningTaskRow icon="restaurant-outline" label="Cuisine en profondeur" active={!!property.hasDeepKitchen} theme={theme} />
      <CleaningTaskRow icon="shield-checkmark-outline" label="Desinfection" active={!!property.hasDisinfection} theme={theme} />

      {/* Cleaning notes */}
      {property.cleaningNotes ? (
        <>
          <View style={{ height: 1, backgroundColor: theme.colors.border.light, marginVertical: theme.SPACING.md }} />
          <View style={{
            flexDirection: 'row', gap: theme.SPACING.sm, alignItems: 'flex-start',
            padding: theme.SPACING.md, backgroundColor: `${theme.colors.warning.main}08`,
            borderRadius: theme.BORDER_RADIUS.md, borderLeftWidth: 3, borderLeftColor: theme.colors.warning.main,
          }}>
            <Ionicons name="alert-circle-outline" size={16} color={theme.colors.warning.main} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...theme.typography.caption, color: theme.colors.warning.dark, fontWeight: '700', marginBottom: 4 }}>Notes de menage</Text>
              <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, lineHeight: 20 }}>{property.cleaningNotes}</Text>
            </View>
          </View>
        </>
      ) : null}
    </Card>
  );
}

/* ─── Main Screen ─── */

export function PropertyInterventionsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'PropertyInterventions'>>();
  const { propertyId } = route.params;

  const [activeTab, setActiveTab] = useState<TabKey>('cleaning');

  const { data: property } = useProperty(propertyId);
  const { data, isLoading, isRefetching, refetch } = useInterventions({ propertyId, size: 50, sort: 'createdAt,desc' });
  const interventions = data?.content ?? [];

  const grouped = useMemo(() => {
    const cleaning = interventions.filter((i) => CLEANING_TYPES.has(i.type));
    const maintenance = interventions.filter((i) => MAINTENANCE_TYPES.has(i.type));
    const other = interventions.filter((i) => !CLEANING_TYPES.has(i.type) && !MAINTENANCE_TYPES.has(i.type));
    return { cleaning, maintenance, other };
  }, [interventions]);

  const activeInterventions = grouped[activeTab];

  const counts = useMemo(() => ({
    cleaning: grouped.cleaning.length,
    maintenance: grouped.maintenance.length,
    other: grouped.other.length,
  }), [grouped]);

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
        <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, flex: 1 }}>Interventions</Text>
        {interventions.length > 0 && (
          <View style={{
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.BORDER_RADIUS.full,
            backgroundColor: `${theme.colors.primary.main}0C`,
          }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.primary.main, fontWeight: '700' }}>{interventions.length}</Text>
          </View>
        )}
      </View>

      {/* Tab bar */}
      <View style={{
        flexDirection: 'row',
        paddingHorizontal: theme.SPACING.lg,
        paddingTop: theme.SPACING.md,
        paddingBottom: theme.SPACING.sm,
        backgroundColor: theme.colors.background.paper,
        gap: theme.SPACING.sm,
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = counts[tab.key];
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: theme.SPACING.sm,
                borderRadius: theme.BORDER_RADIUS.md,
                backgroundColor: isActive ? `${theme.colors.primary.main}10` : 'transparent',
                borderWidth: isActive ? 0 : 1,
                borderColor: theme.colors.border.light,
              }}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={isActive ? theme.colors.primary.main : theme.colors.text.disabled}
              />
              <Text style={{
                ...theme.typography.caption,
                color: isActive ? theme.colors.primary.main : theme.colors.text.secondary,
                fontWeight: isActive ? '700' : '500',
              }}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View style={{
                  minWidth: 18, height: 18, borderRadius: 9,
                  backgroundColor: isActive ? theme.colors.primary.main : theme.colors.text.disabled,
                  alignItems: 'center', justifyContent: 'center',
                  paddingHorizontal: 4,
                }}>
                  <Text style={{ fontSize: 10, color: '#FFFFFF', fontWeight: '700' }}>{count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      {isLoading ? (
        <InterventionsSkeleton theme={theme} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
        >
          {/* Cleaning config section — only in Menage tab */}
          {activeTab === 'cleaning' && property && (
            <CleaningConfigSection theme={theme} property={property} />
          )}

          {/* Intervention list */}
          {activeInterventions.length === 0 ? (
            <EmptyState
              iconName={activeTab === 'cleaning' ? 'sparkles-outline' : activeTab === 'maintenance' ? 'construct-outline' : 'apps-outline'}
              title={
                activeTab === 'cleaning'
                  ? 'Aucune intervention menage'
                  : activeTab === 'maintenance'
                    ? 'Aucune intervention maintenance'
                    : 'Aucune autre intervention'
              }
              description={
                activeTab === 'cleaning'
                  ? 'Pas encore d\'intervention de menage pour cette propriete'
                  : activeTab === 'maintenance'
                    ? 'Pas encore d\'intervention de maintenance pour cette propriete'
                    : 'Pas d\'autre type d\'intervention pour cette propriete'
              }
            />
          ) : (
            <>
              <Text style={{
                ...theme.typography.overline, color: theme.colors.text.disabled,
                marginBottom: theme.SPACING.md,
              }}>
                {activeTab === 'cleaning' ? 'HISTORIQUE MENAGES' : activeTab === 'maintenance' ? 'HISTORIQUE MAINTENANCE' : 'AUTRES INTERVENTIONS'}
                {' '}({activeInterventions.length})
              </Text>
              {activeInterventions.map((item) => (
                <InterventionCard key={item.id} intervention={item} />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
