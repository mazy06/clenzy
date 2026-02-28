import { useState, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useDashboardKpis } from '@/hooks/useKpi';
import { useProperties } from '@/hooks/useProperties';
import { useReservations } from '@/hooks/useReservations';
import { useInterventions } from '@/hooks/useInterventions';
import { useServiceRequests } from '@/hooks/useServiceRequests';
import { useAuthStore } from '@/store/authStore';
import { KpiCard } from '@/components/domain/KpiCard';
import { ReservationCard } from '@/components/domain/ReservationCard';
import { InterventionCard } from '@/components/domain/InterventionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useTheme } from '@/theme';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon apres-midi';
  return 'Bonsoir';
}

function getFirstName(user: any): string {
  if (user?.firstName) return user.firstName;
  if (user?.fullName) return user.fullName.split(' ')[0];
  if (user?.username) return user.username;
  return '';
}

type IoniconsName = keyof typeof Ionicons.glyphMap;

const QUICK_ACTIONS: Array<{ label: string; icon: IoniconsName; tab: string; color: string }> = [
  { label: 'Bruit', icon: 'volume-high-outline', tab: 'NoiseMonitoring', color: '#4A7C8E' },
  { label: 'Avis', icon: 'star-outline', tab: 'Reviews', color: '#C8924A' },
  { label: 'Tarifs', icon: 'pricetag-outline', tab: 'Pricing', color: '#D97706' },
  { label: 'Analytics', icon: 'analytics-outline', tab: 'Analytics', color: '#059669' },
];

type PeriodFilter = 'today' | 'week';

function DashboardSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
      <Skeleton width="60%" height={28} />
      <Skeleton width="40%" height={16} />
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginTop: theme.SPACING.md }}>
        <Skeleton width="48%" height={100} borderRadius={theme.BORDER_RADIUS.lg} />
        <Skeleton width="48%" height={100} borderRadius={theme.BORDER_RADIUS.lg} />
      </View>
      <Skeleton height={80} borderRadius={theme.BORDER_RADIUS.lg} style={{ marginTop: theme.SPACING.md }} />
      <Skeleton height={80} borderRadius={theme.BORDER_RADIUS.lg} />
    </View>
  );
}

export function DashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const { data: kpis, isLoading: kpiLoading, isRefetching, refetch } = useDashboardKpis();
  const { data: propertiesData } = useProperties();
  const firstName = getFirstName(user);

  const propertyCount = propertiesData?.content?.length ?? 0;

  // Active interventions count (pending + in_progress) for KPI card
  const { data: serviceRequestsData } = useServiceRequests({ size: '100' });
  const activeInterventions = (serviceRequestsData?.content ?? []).filter(
    (sr: any) => sr.status === 'PENDING' || sr.status === 'IN_PROGRESS',
  ).length;

  // Date range
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  // Upcoming reservations (next 7 days)
  const { data: reservationsData } = useReservations({ startDate: today, endDate: nextWeek, size: '20' });
  const allReservations = reservationsData?.content ?? [];

  // Upcoming interventions (next 7 days, non-completed)
  const { data: interventionsData } = useInterventions({ startDate: today, endDate: nextWeek, size: 20, sort: 'startTime,asc' });
  const allInterventions = useMemo(() =>
    (interventionsData?.content ?? []).filter((i) => i.status !== 'COMPLETED'),
    [interventionsData],
  );

  // Period filter
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('week');

  const filteredReservations = useMemo(() => {
    if (periodFilter === 'today') {
      return allReservations.filter((r) => r.checkIn === today);
    }
    return allReservations;
  }, [periodFilter, allReservations, today]);

  const filteredInterventions = useMemo(() => {
    if (periodFilter === 'today') {
      return allInterventions.filter((i) => {
        const scheduled = i.scheduledDate?.split('T')[0];
        const start = i.startTime?.split('T')[0];
        return scheduled === today || start === today;
      });
    }
    return allInterventions;
  }, [periodFilter, allInterventions, today]);

  const hasUpcoming = filteredReservations.length > 0 || filteredInterventions.length > 0;

  if (kpiLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <DashboardSkeleton theme={theme} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Greeting */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING['2xl'], paddingBottom: theme.SPACING.lg }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginBottom: 4 }}>
              {getGreeting()}{firstName ? `, ${firstName}` : ''}
            </Text>
            <Text style={{ ...theme.typography.h1, color: theme.colors.text.primary }}>
              Dashboard
            </Text>
          </View>
          <NotificationBell />
        </View>

        {/* Quick actions */}
        <View style={{
          flexDirection: 'row',
          paddingHorizontal: theme.SPACING.lg,
          gap: theme.SPACING.sm,
          marginBottom: theme.SPACING['2xl'],
        }}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.tab}
              onPress={() => navigation.navigate(action.tab)}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                paddingVertical: theme.SPACING.md,
                borderRadius: theme.BORDER_RADIUS.lg,
                backgroundColor: theme.colors.background.paper,
                opacity: pressed ? 0.85 : 1,
                ...theme.shadows.sm,
              })}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: theme.BORDER_RADIUS.md,
                backgroundColor: `${action.color}0C`,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8,
              }}>
                <Ionicons name={action.icon} size={20} color={action.color} />
              </View>
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* KPIs summary */}
        <View style={{ paddingHorizontal: theme.SPACING.lg }}>
          <SectionHeader title="Vue d'ensemble" iconName="analytics-outline" />

          {kpis && kpis.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
              {kpis.map((kpi, idx) => (
                <KpiCard
                  key={idx}
                  label={kpi.label}
                  value={kpi.value}
                  unit={kpi.unit}
                  trend={kpi.trend}
                />
              ))}
            </View>
          ) : (
            <View style={{
              flexDirection: 'row',
              gap: theme.SPACING.sm,
              marginBottom: theme.SPACING.lg,
            }}>
              <KpiCard label="Proprietes" value={propertyCount} iconName="home-outline" compact onPress={() => navigation.navigate('Properties' as any)} />
              <KpiCard label="Reservations" value={allReservations.length} unit="cette sem." iconName="calendar-outline" color="secondary" compact onPress={() => navigation.navigate('ReservationsList')} />
              <KpiCard label="Interventions" value={activeInterventions} unit="en cours" iconName="construct-outline" color="warning" compact onPress={() => navigation.navigate('InterventionsList')} />
            </View>
          )}

          {/* Upcoming section */}
          <SectionHeader title="A venir" iconName="time-outline" />

          {/* Period filter chips */}
          <View style={{
            flexDirection: 'row',
            gap: theme.SPACING.sm,
            marginBottom: theme.SPACING.md,
          }}>
            {([
              { key: 'today' as PeriodFilter, label: "Aujourd'hui", icon: 'today-outline' as IoniconsName },
              { key: 'week' as PeriodFilter, label: 'Cette semaine', icon: 'calendar-outline' as IoniconsName },
            ]).map((f) => {
              const active = periodFilter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setPeriodFilter(f.key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: theme.BORDER_RADIUS.full,
                    backgroundColor: active ? `${theme.colors.primary.main}12` : theme.colors.background.surface,
                    borderWidth: 1,
                    borderColor: active ? theme.colors.primary.main : theme.colors.border.light,
                  }}
                >
                  <Ionicons
                    name={f.icon}
                    size={13}
                    color={active ? theme.colors.primary.main : theme.colors.text.disabled}
                  />
                  <Text style={{
                    ...theme.typography.caption,
                    fontWeight: active ? '700' : '500',
                    color: active ? theme.colors.primary.main : theme.colors.text.secondary,
                  }}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {!hasUpcoming ? (
            <EmptyState
              iconName="calendar-outline"
              title={periodFilter === 'today' ? "Rien de prevu aujourd'hui" : 'Rien de prevu cette semaine'}
              description={periodFilter === 'today' ? "Pas de sejour ni d'intervention aujourd'hui" : "Pas de sejour ni d'intervention cette semaine"}
              compact
              style={{ marginBottom: theme.SPACING.lg }}
            />
          ) : (
            <View style={{ marginBottom: theme.SPACING.lg }}>
              {/* Reservations */}
              {filteredReservations.length > 0 && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: theme.SPACING.sm }}>
                    <Ionicons name="bed-outline" size={14} color={theme.colors.text.secondary} />
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontWeight: '600' }}>
                      Sejours ({filteredReservations.length})
                    </Text>
                  </View>
                  {filteredReservations.map((res) => (
                    <ReservationCard key={res.id} reservation={res} />
                  ))}
                </>
              )}

              {/* Interventions */}
              {filteredInterventions.length > 0 && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: filteredReservations.length > 0 ? theme.SPACING.md : 0, marginBottom: theme.SPACING.sm }}>
                    <Ionicons name="construct-outline" size={14} color={theme.colors.text.secondary} />
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontWeight: '600' }}>
                      Interventions ({filteredInterventions.length})
                    </Text>
                  </View>
                  {filteredInterventions.map((intervention) => (
                    <InterventionCard key={intervention.id} intervention={intervention} />
                  ))}
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
