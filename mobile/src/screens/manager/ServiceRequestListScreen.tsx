import React, { useCallback } from 'react';
import { View, Text, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useServiceRequests } from '@/hooks/useServiceRequests';
import { ServiceRequestCard } from '@/components/domain/ServiceRequestCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTheme } from '@/theme';
import type { ServiceRequest } from '@/api/endpoints/serviceRequestsApi';

export function ServiceRequestListScreen() {
  const theme = useTheme();
  const { data, isLoading, isRefetching, refetch } = useServiceRequests();
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
      <View style={{ paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.lg, paddingBottom: theme.SPACING.sm }}>
        <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary }}>Demandes de service</Text>
        <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: 2 }}>
          {requests.length} demande{requests.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlashList
        data={requests}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: theme.SPACING['3xl'] }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
        ListEmptyComponent={<EmptyState title="Aucune demande" description="Pas de demande de service en cours" />}
      />
    </SafeAreaView>
  );
}
