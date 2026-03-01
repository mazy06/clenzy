import React, { useCallback } from 'react';
import { View, Text, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useInterventions } from '@/hooks/useInterventions';
import { InterventionCard } from '@/components/domain/InterventionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useTheme } from '@/theme';
import type { Intervention } from '@/api/endpoints/interventionsApi';

export function HistoryScreen() {
  const theme = useTheme();
  const { data, isLoading, isRefetching, refetch } = useInterventions({
    status: 'COMPLETED',
    sort: 'updatedAt,desc',
    size: 50,
  });

  const missions: Intervention[] = data?.content ?? [];

  const renderItem = useCallback(
    ({ item }: { item: Intervention }) => <InterventionCard intervention={item} />,
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
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.lg, paddingBottom: theme.SPACING.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary }}>Historique</Text>
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: 2 }}>
            Missions terminees
          </Text>
        </View>
        <NotificationBell />
      </View>

      <FlashList
        data={missions}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: theme.SPACING['3xl'] }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
        ListEmptyComponent={<EmptyState title="Aucun historique" description="Vos missions terminees apparaitront ici" />}
      />
    </SafeAreaView>
  );
}
