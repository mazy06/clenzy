import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Divider } from '@/components/ui/Divider';
import { useServiceRequests } from '@/hooks/useServiceRequests';
import type { ServiceRequest } from '@/api/endpoints/serviceRequestsApi';

type FilterKey = 'all' | 'pending' | 'active' | 'done';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Toutes' },
  { key: 'pending', label: 'En attente' },
  { key: 'active', label: 'En cours' },
  { key: 'done', label: 'Terminees' },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#D97706',
  APPROVED: '#0D9488',
  DEVIS_ACCEPTED: '#C8924A',
  IN_PROGRESS: '#3B82F6',
  COMPLETED: '#059669',
  CANCELLED: '#EF4444',
  REJECTED: '#DC2626',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  APPROVED: 'Approuvee',
  DEVIS_ACCEPTED: 'Devis accepte',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminee',
  CANCELLED: 'Annulee',
  REJECTED: 'Refusee',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#6B7280',
  NORMAL: '#3B82F6',
  HIGH: '#D97706',
  CRITICAL: '#EF4444',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Basse',
  NORMAL: 'Normale',
  HIGH: 'Haute',
  CRITICAL: 'Critique',
};

const TYPE_LABELS: Record<string, string> = {
  CLEANING: 'Menage',
  EXPRESS_CLEANING: 'Menage express',
  DEEP_CLEANING: 'Nettoyage profond',
  WINDOW_CLEANING: 'Vitres',
  FLOOR_CLEANING: 'Sols',
  KITCHEN_CLEANING: 'Cuisine',
  BATHROOM_CLEANING: 'Salle de bain',
  EXTERIOR_CLEANING: 'Exterieur',
  DISINFECTION: 'Desinfection',
  PREVENTIVE_MAINTENANCE: 'Maintenance',
  EMERGENCY_REPAIR: 'Urgence',
  ELECTRICAL_REPAIR: 'Electricite',
  PLUMBING_REPAIR: 'Plomberie',
  HVAC_REPAIR: 'Climatisation',
  APPLIANCE_REPAIR: 'Electromenager',
  GARDENING: 'Jardinage',
  PEST_CONTROL: 'Desinsectisation',
  RESTORATION: 'Restauration',
  OTHER: 'Autre',
};

type IoniconsName = keyof typeof Ionicons.glyphMap;

function getTypeIcon(type: string): IoniconsName {
  if (type.includes('CLEANING') || type === 'DISINFECTION') return 'sparkles-outline';
  if (type.includes('REPAIR') || type === 'PREVENTIVE_MAINTENANCE' || type === 'EMERGENCY_REPAIR') return 'hammer-outline';
  if (type === 'GARDENING') return 'leaf-outline';
  if (type === 'PEST_CONTROL') return 'bug-outline';
  return 'ellipsis-horizontal-circle-outline';
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function InterventionsSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
      <Skeleton width="50%" height={28} />
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width={80} height={34} borderRadius={20} />
        ))}
      </View>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} height={120} borderRadius={theme.BORDER_RADIUS.lg} />
      ))}
    </View>
  );
}

export function InterventionsListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<FilterKey>('all');

  const { data, isLoading, isRefetching, refetch } = useServiceRequests({ size: '500' });
  const allRequests: ServiceRequest[] = data?.content ?? [];

  const filtered = useMemo(() => {
    let list = [...allRequests];

    switch (filter) {
      case 'pending':
        list = list.filter((sr) => sr.status === 'PENDING' || sr.status === 'APPROVED' || sr.status === 'DEVIS_ACCEPTED');
        break;
      case 'active':
        list = list.filter((sr) => sr.status === 'IN_PROGRESS');
        break;
      case 'done':
        list = list.filter((sr) => sr.status === 'COMPLETED' || sr.status === 'CANCELLED' || sr.status === 'REJECTED');
        break;
    }

    // Most recent first
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list;
  }, [allRequests, filter]);

  // Stats
  const stats = useMemo(() => {
    const pending = allRequests.filter(
      (sr) => sr.status === 'PENDING' || sr.status === 'APPROVED' || sr.status === 'DEVIS_ACCEPTED',
    ).length;
    const active = allRequests.filter((sr) => sr.status === 'IN_PROGRESS').length;
    const done = allRequests.filter(
      (sr) => sr.status === 'COMPLETED' || sr.status === 'CANCELLED' || sr.status === 'REJECTED',
    ).length;
    const totalCost = allRequests
      .filter((sr) => sr.status !== 'CANCELLED' && sr.status !== 'REJECTED')
      .reduce((sum, sr) => sum + (sr.estimatedCost ?? 0), 0);
    return { total: allRequests.length, pending, active, done, totalCost };
  }, [allRequests]);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <InterventionsSkeleton theme={theme} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.SPACING.lg,
        paddingTop: theme.SPACING.lg,
        paddingBottom: theme.SPACING.md,
      }}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={{
            width: 36,
            height: 36,
            borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: theme.colors.background.paper,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: theme.SPACING.md,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, flex: 1 }}>
          Interventions
        </Text>
      </View>

      {/* Stats row */}
      <View style={{
        flexDirection: 'row',
        paddingHorizontal: theme.SPACING.lg,
        gap: theme.SPACING.sm,
        marginBottom: theme.SPACING.md,
      }}>
        <View style={{
          flex: 1,
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.lg,
          padding: theme.SPACING.md,
          alignItems: 'center',
          ...theme.shadows.sm,
        }}>
          <Text style={{ ...theme.typography.h3, color: theme.colors.primary.main }}>{stats.total}</Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>Total</Text>
        </View>
        <View style={{
          flex: 1,
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.lg,
          padding: theme.SPACING.md,
          alignItems: 'center',
          ...theme.shadows.sm,
        }}>
          <Text style={{ ...theme.typography.h3, color: '#D97706' }}>{stats.pending}</Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>En attente</Text>
        </View>
        <View style={{
          flex: 1,
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.lg,
          padding: theme.SPACING.md,
          alignItems: 'center',
          ...theme.shadows.sm,
        }}>
          <Text style={{ ...theme.typography.h3, color: '#3B82F6' }}>{stats.active}</Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>En cours</Text>
        </View>
        <View style={{
          flex: 1,
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.lg,
          padding: theme.SPACING.md,
          alignItems: 'center',
          ...theme.shadows.sm,
        }}>
          <Text style={{ ...theme.typography.h3, color: '#059669' }}>{stats.done}</Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>Terminees</Text>
        </View>
      </View>

      {/* Filter chips */}
      <View style={{
        flexDirection: 'row',
        paddingHorizontal: theme.SPACING.lg,
        gap: theme.SPACING.sm,
        marginBottom: theme.SPACING.md,
      }}>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </View>

      {/* List */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.SPACING.lg,
          paddingBottom: 120,
        }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />
        }
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader
          title={`${filtered.length} intervention${filtered.length > 1 ? 's' : ''}`}
          iconName="construct-outline"
        />

        {filtered.length === 0 ? (
          <EmptyState
            iconName="construct-outline"
            title="Aucune intervention"
            description={
              filter === 'pending'
                ? 'Aucune intervention en attente'
                : filter === 'active'
                  ? 'Aucune intervention en cours'
                  : filter === 'done'
                    ? 'Aucune intervention terminee'
                    : 'Aucune intervention trouvee'
            }
            compact
          />
        ) : (
          filtered.map((sr) => {
            const statusColor = STATUS_COLORS[sr.status] ?? theme.colors.text.disabled;
            const statusLabel = STATUS_LABELS[sr.status] ?? sr.status;
            const priorityColor = PRIORITY_COLORS[sr.priority] ?? theme.colors.text.disabled;
            const priorityLabel = PRIORITY_LABELS[sr.priority] ?? sr.priority;
            const typeLabel = TYPE_LABELS[sr.serviceType] ?? sr.serviceType;
            const typeIcon = getTypeIcon(sr.serviceType);

            return (
              <Card key={sr.id} style={{ marginBottom: theme.SPACING.md }}>
                {/* Top row: type icon + title + status badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.SPACING.sm }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: theme.BORDER_RADIUS.md,
                    backgroundColor: `${statusColor}14`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: theme.SPACING.sm,
                  }}>
                    <Ionicons name={typeIcon} size={18} color={statusColor} />
                  </View>
                  <View style={{ flex: 1, marginRight: theme.SPACING.sm }}>
                    <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary }} numberOfLines={1}>
                      {sr.title || typeLabel}
                    </Text>
                    {sr.propertyName && (
                      <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 }} numberOfLines={1}>
                        {sr.propertyName}
                      </Text>
                    )}
                  </View>
                  <View style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: theme.BORDER_RADIUS.full,
                    backgroundColor: `${statusColor}18`,
                  }}>
                    <Text style={{ ...theme.typography.caption, color: statusColor, fontWeight: '700', fontSize: 11 }}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>

                {/* Info row */}
                <View style={{
                  flexDirection: 'row',
                  backgroundColor: theme.colors.background.surface,
                  borderRadius: theme.BORDER_RADIUS.sm,
                  padding: theme.SPACING.sm,
                  marginBottom: sr.description ? theme.SPACING.sm : 0,
                }}>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, fontSize: 10 }}>Type</Text>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.primary, fontWeight: '600', marginTop: 2 }} numberOfLines={1}>
                      {typeLabel}
                    </Text>
                  </View>

                  <View style={{ width: 1, backgroundColor: theme.colors.border.light, marginHorizontal: theme.SPACING.sm }} />

                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, fontSize: 10 }}>Priorite</Text>
                    <Text style={{ ...theme.typography.caption, color: priorityColor, fontWeight: '600', marginTop: 2 }}>
                      {priorityLabel}
                    </Text>
                  </View>

                  <View style={{ width: 1, backgroundColor: theme.colors.border.light, marginHorizontal: theme.SPACING.sm }} />

                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, fontSize: 10 }}>Date</Text>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.primary, fontWeight: '600', marginTop: 2 }} numberOfLines={1}>
                      {sr.desiredDate ? formatDate(sr.desiredDate) : formatDate(sr.createdAt)}
                    </Text>
                  </View>
                </View>

                {/* Description */}
                {sr.description ? (
                  <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: theme.SPACING.xs }} numberOfLines={2}>
                    {sr.description}
                  </Text>
                ) : null}

                {/* Cost row */}
                {(sr.estimatedCost != null || sr.actualCost != null) && (
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: theme.SPACING.sm }}>
                    {sr.actualCost != null ? (
                      <Text style={{ ...theme.typography.h5, color: theme.colors.success.main }}>
                        {sr.actualCost.toFixed(0)}€
                      </Text>
                    ) : sr.estimatedCost != null ? (
                      <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
                        ~{sr.estimatedCost.toFixed(0)}€ estime
                      </Text>
                    ) : null}
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
