import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, RefreshControl, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useMissionsForDate, useMissionsForRange } from '@/hooks/useInterventions';
import { useTeams } from '@/hooks/useTeams';
import { useAuthStore } from '@/store/authStore';
import { InterventionCard } from '@/components/domain/InterventionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useTheme } from '@/theme';
import type { Intervention } from '@/api/endpoints/interventionsApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;

type TodayStackNav = NativeStackNavigationProp<{
  TodayMissions: undefined;
  CleaningChecklist: { interventionId: number };
  PhotoCapture: { interventionId: number; type: 'before' | 'after' };
  AnomalyReport: { interventionId: number };
  Signature: { interventionId: number };
}>;

function getDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateFr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Returns Monday of the current week */
function getWeekStart(today: Date): Date {
  const d = new Date(today);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 0
  d.setDate(d.getDate() - diff);
  return d;
}

/** Returns Sunday of the current week */
function getWeekEnd(today: Date): Date {
  const start = getWeekStart(today);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

// ─── KPI Card component ───────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color, theme }: {
  icon: IoniconsName;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: theme.colors.background.paper,
      borderRadius: theme.BORDER_RADIUS.lg,
      padding: theme.SPACING.md,
      gap: 6,
      ...theme.shadows.sm,
    }}>
      <View style={{
        width: 32, height: 32, borderRadius: theme.BORDER_RADIUS.sm,
        backgroundColor: `${color}14`,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary }}>
        {value}
      </Text>
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }} numberOfLines={1}>
        {label}
      </Text>
      {sub != null && (
        <Text style={{ ...theme.typography.caption, color, fontWeight: '600' }} numberOfLines={1}>
          {sub}
        </Text>
      )}
    </View>
  );
}

// ─── Day pill for the weekly strip ───────────────────────────────────

function DayPill({ dateStr, todayStr, selectedDate, missionCount, onPress, theme }: {
  dateStr: string;
  todayStr: string;
  selectedDate: string;
  missionCount: number;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const d = new Date(dateStr + 'T00:00:00');
  const dayName = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
  const dayNum = d.getDate();
  const isSelected = dateStr === selectedDate;
  const isToday = dateStr === todayStr;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: theme.SPACING.sm,
        borderRadius: theme.BORDER_RADIUS.md,
        backgroundColor: isSelected ? theme.colors.primary.main : 'transparent',
      }}
    >
      <Text style={{
        ...theme.typography.caption,
        color: isSelected ? '#fff' : theme.colors.text.secondary,
        textTransform: 'capitalize',
      }}>
        {dayName}
      </Text>
      <Text style={{
        ...theme.typography.h4,
        color: isSelected ? '#fff' : isToday ? theme.colors.primary.main : theme.colors.text.primary,
        fontWeight: isToday ? '700' : '600',
        marginVertical: 2,
      }}>
        {dayNum}
      </Text>
      {missionCount > 0 ? (
        <View style={{
          width: 18, height: 18, borderRadius: 9,
          backgroundColor: isSelected ? 'rgba(255,255,255,0.3)' : `${theme.colors.primary.main}18`,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{
            fontSize: 10, fontWeight: '700',
            color: isSelected ? '#fff' : theme.colors.primary.main,
          }}>
            {missionCount}
          </Text>
        </View>
      ) : (
        <View style={{ width: 18, height: 18 }} />
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────

export function TodayMissionsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<TodayStackNav>();
  const user = useAuthStore((s) => s.user);
  const { data: teams } = useTeams();

  // Date navigation
  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => getDateString(now), [now]);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Week range for KPIs
  const weekStartDate = useMemo(() => getWeekStart(now), [now]);
  const weekEndDate = useMemo(() => getWeekEnd(now), [now]);
  const weekStartStr = useMemo(() => getDateString(weekStartDate), [weekStartDate]);
  const weekEndStr = useMemo(() => getDateString(weekEndDate), [weekEndDate]);

  // Week days array (Mon-Sun)
  const weekDays = useMemo(() => {
    const days: string[] = [];
    const d = new Date(weekStartDate);
    for (let i = 0; i < 7; i++) {
      days.push(getDateString(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [weekStartDate]);

  // Data
  const { data: todayData, isLoading, isRefetching, refetch } = useMissionsForDate(selectedDate);
  const { data: weekData } = useMissionsForRange(weekStartStr, weekEndStr);

  const missions: Intervention[] = todayData?.content ?? [];
  const weekMissions: Intervention[] = weekData?.content ?? [];

  // Weekly KPIs
  const weekKpis = useMemo(() => {
    const total = weekMissions.length;
    const done = weekMissions.filter((m) => m.status === 'COMPLETED').length;
    const inProgress = weekMissions.filter((m) => m.status === 'IN_PROGRESS').length;
    const upcoming = weekMissions.filter((m) => m.status === 'SCHEDULED' || m.status === 'PENDING').length;
    const urgent = weekMissions.filter((m) => m.isUrgent).length;

    // Missions per day of the week
    const perDay = new Map<string, number>();
    for (const m of weekMissions) {
      const date = m.scheduledDate ?? m.createdAt?.split('T')[0];
      if (date) perDay.set(date, (perDay.get(date) ?? 0) + 1);
    }

    // Distinct properties this week
    const properties = new Set(weekMissions.map((m) => m.propertyId).filter(Boolean));

    // Total estimated hours
    const estimatedHours = weekMissions.reduce((sum, m) => sum + (m.estimatedDurationHours ?? 0), 0);

    return { total, done, inProgress, upcoming, urgent, perDay, propertyCount: properties.size, estimatedHours };
  }, [weekMissions]);

  // Team name
  const teamName = teams?.[0]?.name;

  // Date label
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return getDateString(d);
  }, []);

  const dateLabel =
    selectedDate === todayStr
      ? "Aujourd'hui"
      : selectedDate === tomorrowStr
        ? 'Demain'
        : null;

  const formattedDate = capitalizeFirst(formatDateFr(selectedDate));

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon apres-midi';
    return 'Bonsoir';
  }, []);

  const firstName = user?.firstName || user?.username || '';

  const handlePress = useCallback(
    (intervention: Intervention) => {
      navigation.navigate('CleaningChecklist', { interventionId: intervention.id });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Intervention }) => (
      <InterventionCard intervention={item} onPress={() => handlePress(item)} />
    ),
    [handlePress],
  );

  const completionPct = weekKpis.total > 0 ? Math.round((weekKpis.done / weekKpis.total) * 100) : 0;

  // Daily total amount (updates when selectedDate / missions change)
  const dailyTotal = useMemo(() => {
    return missions.reduce((sum, m) => sum + (m.estimatedCost ?? 0), 0);
  }, [missions]);

  if (isLoading && !todayData) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <FlashList
        data={missions}
        extraData={selectedDate}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: theme.SPACING['3xl'] }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: theme.SPACING.lg }}>
            {/* Header */}
            <View style={{ paddingTop: theme.SPACING.lg, paddingBottom: theme.SPACING.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: theme.SPACING.xs }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginBottom: 4 }}>
                    {greeting}{firstName ? `, ${firstName}` : ''}
                    {teamName ? ` · ${teamName}` : ''}
                  </Text>
                  <Text style={{ ...theme.typography.h1, color: theme.colors.text.primary }}>
                    Interventions
                  </Text>
                </View>
                <NotificationBell />
              </View>
            </View>

            {/* Weekly KPIs */}
            <View style={{ gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
              {/* Row 1: main KPIs */}
              <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
                <KpiCard
                  icon="calendar-outline"
                  label="Cette semaine"
                  value={weekKpis.total}
                  sub={weekKpis.total > 0 ? `${completionPct}% termine${completionPct > 1 ? 's' : ''}` : undefined}
                  color={theme.colors.primary.main}
                  theme={theme}
                />
                <KpiCard
                  icon="checkmark-circle-outline"
                  label="Terminees"
                  value={weekKpis.done}
                  color="#059669"
                  theme={theme}
                />
                <KpiCard
                  icon="time-outline"
                  label="A venir"
                  value={weekKpis.upcoming}
                  sub={weekKpis.urgent > 0 ? `${weekKpis.urgent} urgente${weekKpis.urgent > 1 ? 's' : ''}` : undefined}
                  color="#F59E0B"
                  theme={theme}
                />
              </View>

              {/* Row 2: secondary KPIs */}
              <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
                <KpiCard
                  icon="play-circle-outline"
                  label="En cours"
                  value={weekKpis.inProgress}
                  color="#3B82F6"
                  theme={theme}
                />
                <KpiCard
                  icon="home-outline"
                  label="Logements"
                  value={weekKpis.propertyCount}
                  color="#8B5CF6"
                  theme={theme}
                />
                <KpiCard
                  icon="hourglass-outline"
                  label="Heures estimees"
                  value={weekKpis.estimatedHours > 0 ? `${weekKpis.estimatedHours}h` : '—'}
                  color="#EC4899"
                  theme={theme}
                />
              </View>
            </View>

            {/* Week day strip */}
            <View style={{
              flexDirection: 'row',
              backgroundColor: theme.colors.background.paper,
              borderRadius: theme.BORDER_RADIUS.lg,
              padding: 4,
              marginBottom: theme.SPACING.md,
              ...theme.shadows.sm,
            }}>
              {weekDays.map((day) => (
                <DayPill
                  key={day}
                  dateStr={day}
                  todayStr={todayStr}
                  selectedDate={selectedDate}
                  missionCount={weekKpis.perDay.get(day) ?? 0}
                  onPress={() => setSelectedDate(day)}
                  theme={theme}
                />
              ))}
            </View>

            {/* Selected day info */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: theme.SPACING.md,
            }}>
              <View>
                <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary }}>
                  {formattedDate}
                </Text>
                {dateLabel && (
                  <Text style={{ ...theme.typography.caption, color: theme.colors.primary.main, fontWeight: '600', marginTop: 2 }}>
                    {dateLabel}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>
                  {missions.length} intervention{missions.length !== 1 ? 's' : ''}
                </Text>
                {dailyTotal > 0 && (
                  <Text style={{ ...theme.typography.h4, color: theme.colors.primary.main, marginTop: 2 }}>
                    {dailyTotal.toFixed(2).replace('.', ',')} €
                  </Text>
                )}
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            iconName="clipboard-outline"
            title="Aucune mission"
            description={
              selectedDate === todayStr
                ? "Pas d'intervention prevue pour aujourd'hui"
                : `Pas d'intervention prevue pour le ${formattedDate.toLowerCase()}`
            }
          />
        }
      />
    </SafeAreaView>
  );
}
