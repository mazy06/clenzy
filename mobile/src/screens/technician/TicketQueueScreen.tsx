import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInterventions } from '@/hooks/useInterventions';
import { InterventionCard } from '@/components/domain/InterventionCard';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useTheme } from '@/theme';
import type { Intervention } from '@/api/endpoints/interventionsApi';

type TicketsStackNav = NativeStackNavigationProp<{
  TicketQueue: undefined;
  DiagnosticForm: { interventionId: number };
  PhotoDoc: { interventionId: number };
  TechReport: { interventionId: number };
}>;

const STATUS_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'COMPLETED', label: 'Termines' },
];

const PRIORITY_FILTERS = [
  { value: '', label: 'Toutes' },
  { value: 'CRITICAL', label: 'Critique' },
  { value: 'HIGH', label: 'Elevee' },
  { value: 'NORMAL', label: 'Normale' },
];

export function TicketQueueScreen() {
  const theme = useTheme();
  const navigation = useNavigation<TicketsStackNav>();
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const { data, isLoading, isRefetching, refetch } = useInterventions({
    type: 'MAINTENANCE',
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    sort: 'priority,desc',
    size: 50,
  });

  const tickets: Intervention[] = data?.content ?? [];

  const handlePress = useCallback(
    (intervention: Intervention) => {
      navigation.navigate('DiagnosticForm', { interventionId: intervention.id });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Intervention }) => (
      <InterventionCard intervention={item} onPress={() => handlePress(item)} />
    ),
    [handlePress],
  );

  if (isLoading) {
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
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.lg, paddingBottom: theme.SPACING.xs }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary }}>Tickets techniques</Text>
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: 2 }}>
            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <NotificationBell />
      </View>

      {/* Filters: status */}
      <View style={{ paddingHorizontal: theme.SPACING.lg, paddingVertical: theme.SPACING.xs }}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map((f) => (
            <Chip key={f.value} label={f.label} selected={statusFilter === f.value} onPress={() => setStatusFilter(f.value)} />
          ))}
        </View>
      </View>

      {/* Filters: priority */}
      <View style={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: theme.SPACING.sm }}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {PRIORITY_FILTERS.map((f) => (
            <Chip key={f.value} label={f.label} selected={priorityFilter === f.value} onPress={() => setPriorityFilter(f.value)} />
          ))}
        </View>
      </View>

      {/* List */}
      <FlashList
        data={tickets}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: theme.SPACING['3xl'] }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
        ListEmptyComponent={<EmptyState title="Aucun ticket" description="Pas de ticket technique en attente" />}
      />
    </SafeAreaView>
  );
}
