import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useMissionsForDate } from '@/hooks/useInterventions';
import { useTeams } from '@/hooks/useTeams';
import { useAuthStore } from '@/store/authStore';
import { InterventionCard } from '@/components/domain/InterventionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useTheme } from '@/theme';
import type { Intervention } from '@/api/endpoints/interventionsApi';

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

export function TodayMissionsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<TodayStackNav>();
  const user = useAuthStore((s) => s.user);
  const { data: teams } = useTeams();

  // Date navigation
  const todayStr = useMemo(() => getDateString(new Date()), []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return getDateString(d);
  }, []);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const { data, isLoading, isRefetching, refetch } = useMissionsForDate(selectedDate);
  const missions: Intervention[] = data?.content ?? [];

  // Team name
  const teamName = teams?.[0]?.name;

  // Date label
  const dateLabel =
    selectedDate === todayStr
      ? "Aujourd'hui"
      : selectedDate === tomorrowStr
        ? 'Demain'
        : null;

  const formattedDate = capitalizeFirst(formatDateFr(selectedDate));

  const isToday = selectedDate === todayStr;

  const goToNextDay = useCallback(() => {
    setSelectedDate((prev) => {
      const d = new Date(prev + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      return getDateString(d);
    });
  }, []);

  const goToToday = useCallback(() => {
    setSelectedDate(todayStr);
  }, [todayStr]);

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

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon apres-midi';
    return 'Bonsoir';
  }, []);

  const firstName = user?.firstName || user?.username || '';

  if (isLoading && !data) {
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
      {/* Header */}
      <View style={{ paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.lg, paddingBottom: theme.SPACING.sm }}>

        {/* Greeting + Title row */}
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

        {/* Date navigator */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: theme.SPACING.lg,
          marginBottom: theme.SPACING.xs,
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.lg,
          paddingVertical: theme.SPACING.md,
          paddingHorizontal: theme.SPACING.sm,
          ...theme.shadows.sm,
        }}>
          {/* Bouton "Aujourd'hui" pour revenir — visible seulement quand on n'est pas sur today */}
          {!isToday ? (
            <TouchableOpacity
              onPress={goToToday}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: theme.BORDER_RADIUS.full,
                backgroundColor: `${theme.colors.primary.main}15`,
              }}
            >
              <Text style={{
                ...theme.typography.caption,
                color: theme.colors.primary.main,
                fontWeight: '700',
              }}>
                Aujourd'hui
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary }}>
              {formattedDate}
            </Text>
            {dateLabel && (
              <Text style={{
                ...theme.typography.caption,
                color: theme.colors.primary.main,
                fontWeight: '600',
                marginTop: 2,
              }}>
                {dateLabel}
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={goToNextDay}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              width: 36,
              height: 36,
              borderRadius: theme.BORDER_RADIUS.full,
              backgroundColor: theme.colors.background.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-forward" size={20} color={theme.colors.primary.main} />
          </TouchableOpacity>
        </View>

        {/* Mission count */}
        <Text style={{
          ...theme.typography.body2,
          color: theme.colors.text.secondary,
          marginTop: theme.SPACING.md,
        }}>
          {missions.length} intervention{missions.length !== 1 ? 's' : ''} prevue{missions.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* List */}
      <FlashList
        data={missions}
        extraData={selectedDate}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: theme.SPACING['3xl'] }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
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
