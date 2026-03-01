import React, { useState, useCallback } from 'react';
import { View, Text, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useServiceRequests } from '@/hooks/useServiceRequests';
import { ServiceRequestCard } from '@/components/domain/ServiceRequestCard';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useTheme } from '@/theme';
import type { ServiceRequest } from '@/api/endpoints/serviceRequestsApi';

const STATUS_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'RESOLVED', label: 'Resolus' },
];

export function IncidentListScreen() {
  const theme = useTheme();
  const [statusFilter, setStatusFilter] = useState('');

  const params: Record<string, string> = {};
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading, isRefetching, refetch } = useServiceRequests(params);
  const requests = data?.content ?? [];

  const renderItem = useCallback(
    ({ item }: { item: ServiceRequest }) => <ServiceRequestCard request={item} />,
    [],
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
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.lg, paddingBottom: theme.SPACING.xs }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary }}>Incidents & Demandes</Text>
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: 2 }}>
            {requests.length} element{requests.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <NotificationBell />
      </View>

      <View style={{ paddingHorizontal: theme.SPACING.lg, paddingVertical: theme.SPACING.xs }}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map((f) => (
            <Chip key={f.value} label={f.label} selected={statusFilter === f.value} onPress={() => setStatusFilter(f.value)} />
          ))}
        </View>
      </View>

      <FlashList
        data={requests}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: theme.SPACING['3xl'] }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
        ListEmptyComponent={<EmptyState title="Aucun incident" description="Pas de demande en cours" />}
      />
    </SafeAreaView>
  );
}
