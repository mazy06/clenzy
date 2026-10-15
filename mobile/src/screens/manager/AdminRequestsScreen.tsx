import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { serviceRequestsApi, type ServiceRequest } from '@/api/endpoints/serviceRequestsApi';
import { ServiceRequestCard } from '@/components/domain/ServiceRequestCard';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { useBaitlyTheme } from '@/design-system/theme';
import { BaitlyScreen, BaitlyText, BaitlyLoading, BaitlyEmpty } from '@/design-system/components';
import { canUseBaitlyDemo, useBaitlyDataMode } from '@/config/baitlyDataMode';

export function AdminRequestsScreen({ incidents = false }: { incidents?: boolean }) {
  const { t } = useTranslation('mobileV1');
  const c = useBaitlyTheme();
  const scope = useBaitlyScope();
  const mode = useBaitlyDataMode(s => s.mode);
  const demo = canUseBaitlyDemo() && mode === 'demo';
  const [status, setStatus] = useState('');
  const result = useInfiniteQuery({ queryKey: [...scope, 'admin-service-requests', status], initialPageParam: 0, enabled: !demo,
    queryFn: ({ pageParam }) => serviceRequestsApi.getAll({ page: String(pageParam), size: '30', ...(status ? { status } : {}) }),
    getNextPageParam: page => page.number + 1 < page.totalPages ? page.number + 1 : undefined, retry: false });
  const demoItems: ServiceRequest[] = [
    { id: -501, title: 'Fuite sous l’évier · Démo', propertyName: 'Dar Zellige', serviceType: 'MAINTENANCE', status: 'PENDING', priority: 'HIGH', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: -502, title: 'Remplacement du linge · Démo', propertyName: 'Riad Horizon', serviceType: 'CLEANING', status: 'IN_PROGRESS', priority: 'NORMAL', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: -503, title: 'Contrôle du portail · Démo', propertyName: 'Villa Ourika', serviceType: 'MAINTENANCE', status: 'RESOLVED', priority: 'LOW', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ];
  const items = demo ? demoItems.filter(item => !status || item.status === status) : result.data?.pages.flatMap(page => page.content) ?? [];
  return <BaitlyScreen scroll={false}>
    <View style={styles.heading}><BaitlyText variant="heading">{t(incidents ? 'adminIncidents' : 'adminServiceRequests')}</BaitlyText>
      {demo ? <BaitlyText muted variant="meta">{t('homeDemo')}</BaitlyText> : null}</View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filters}>
      {['', 'PENDING', 'IN_PROGRESS', 'RESOLVED'].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: value === status }}
        onPress={() => setStatus(value)} style={({ pressed }) => [styles.chip, { backgroundColor: value === status ? c.muted : pressed ? c.surface : 'transparent' }]}>
        <BaitlyText variant="meta">{t(!value ? 'planningAll' : value === 'RESOLVED' ? 'adminResolved' : `missionStatus.${value}`)}</BaitlyText></Pressable>)}
    </ScrollView>
    <FlashList data={items} keyExtractor={item => String(item.id)} contentContainerStyle={styles.list} renderItem={({ item }) => <ServiceRequestCard request={item} />}
      refreshControl={demo ? undefined : <RefreshControl refreshing={result.isRefetching} onRefresh={() => { void result.refetch(); }} />}
      onEndReached={() => { if (!demo && result.hasNextPage && !result.isFetchingNextPage) void result.fetchNextPage(); }}
      ListEmptyComponent={!demo && result.isPending ? <BaitlyLoading /> : <BaitlyEmpty title={!demo && result.isError ? t('loadFailed') : t('trackingNoMatch')}
        retry={!demo && result.isError ? () => { void result.refetch(); } : undefined} />}
      ListFooterComponent={result.isFetchingNextPage ? <BaitlyLoading /> : result.isError && items.length ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void result.refetch(); }} /> : null} />
  </BaitlyScreen>;
}
const styles = StyleSheet.create({
  heading: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 }, filterScroll: { flexGrow: 0, marginBottom: 12 }, filters: { paddingHorizontal: 16, gap: 4 },
  chip: { minHeight: 40, paddingHorizontal: 12, borderRadius: 12, justifyContent: 'center' }, list: { paddingHorizontal: 16, paddingBottom: 32 },
});
export function AdminIncidentsScreen() { return <AdminRequestsScreen incidents />; }
