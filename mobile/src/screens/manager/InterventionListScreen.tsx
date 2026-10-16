import React, { useState } from 'react';
import { RefreshControl, View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { interventionsApi, type Intervention } from '@/api/endpoints/interventionsApi';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { canUseBaitlyDemo, useBaitlyDataMode } from '@/config/baitlyDataMode';
import { BaitlyScreen, BaitlyText, BaitlyField, BaitlyLoading, BaitlyEmpty } from '@/design-system/components';
import { BaitlyHeaderAction } from '@/design-system/BaitlyHeader';
import { useBaitlyTheme } from '@/design-system/theme';
import { MissionCard } from '@/features/missions/MissionCard';
import { planningDateKey, planningDemo, planningHour } from './planningModel';
import type { InterventionsStackParamList } from '@/navigation/ManagerNavigator';

export function InterventionListScreen() {
  const { t, i18n } = useTranslation('mobileV1');
  const c = useBaitlyTheme();
  const navigation = useNavigation<NativeStackNavigationProp<InterventionsStackParamList>>();
  const scope = useBaitlyScope();
  const mode = useBaitlyDataMode(s => s.mode);
  const demo = canUseBaitlyDemo() && mode === 'demo';
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const result = useInfiniteQuery({ queryKey: [...scope, 'admin-missions', filter], initialPageParam: 0, enabled: !demo,
    queryFn: ({ pageParam }) => interventionsApi.getAll({ page: pageParam, status: filter || undefined, size: 30, sort: 'createdAt,desc' }),
    getNextPageParam: last => last.number + 1 < last.totalPages ? last.number + 1 : undefined, retry: false });
  const items = demo ? planningDemo(planningDateKey(new Date())) : result.data?.pages.flatMap(page => page.content) ?? [];
  const visible = items.filter(item => (!demo || !filter || item.status === filter) && `${item.title} ${item.propertyName || ''} ${item.assignedTechnicianName || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <BaitlyScreen scroll={false}>
    <View style={styles.toolbar}><View style={styles.flex}>{searchOpen ? <BaitlyField label={t('missionSearch')} value={search} onChangeText={setSearch} autoFocus /> : <BaitlyText variant="heading">{t('missions')}</BaitlyText>}</View>
      <BaitlyHeaderAction icon="search-outline" label={t('missionSearch')} onPress={() => { setSearchOpen(!searchOpen); setSearch(''); }} />
      <BaitlyHeaderAction icon="add" label={t('planningCreate')} onPress={() => navigation.navigate('CreateIntervention')} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filters}>
      {['', 'PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].map(status => <Pressable key={status} accessibilityRole="button" accessibilityState={{ selected: filter === status }}
        onPress={() => setFilter(status)} style={({ pressed }) => [styles.chip, { backgroundColor: filter === status ? c.muted : pressed ? c.surface : 'transparent' }]}>
        <BaitlyText variant="meta">{t(status === 'SCHEDULED' ? 'planningScheduled' : status ? `missionStatus.${status}` : 'planningAll')}</BaitlyText></Pressable>)}
    </ScrollView>
    {demo ? <BaitlyText variant="meta" muted style={styles.demo}>{t('homeDemo')}</BaitlyText> : null}
    <FlashList data={visible} extraData={expanded} keyExtractor={item => String(item.id)} contentContainerStyle={styles.list}
      renderItem={({ item }: { item: Intervention }) => <MissionCard title={item.title} property={item.propertyName} person={item.assignedTechnicianName || item.teamName}
        status={item.status} date={[item.scheduledDate, planningHour(item.startTime, i18n.language)].filter(Boolean).join(' · ')}
        notes={demo && expanded === item.id ? item.description : undefined}
        onPress={() => demo ? setExpanded(current => current === item.id ? null : item.id) : navigation.navigate('InterventionDetail', { interventionId: item.id })} />}
      refreshControl={demo ? undefined : <RefreshControl refreshing={result.isRefetching} onRefresh={() => { void result.refetch(); }} tintColor={c.secondary} />}
      onEndReached={() => { if (!demo && result.hasNextPage && !result.isFetchingNextPage) void result.fetchNextPage(); }}
      ListEmptyComponent={!demo && result.isPending ? <BaitlyLoading /> : <BaitlyEmpty title={result.isError && !demo ? t('loadFailed') : t('planningEmpty')}
        retry={result.isError && !demo ? () => { void result.refetch(); } : undefined} />}
      ListFooterComponent={result.isFetchingNextPage ? <BaitlyLoading /> : null} />
  </BaitlyScreen>;
}
const styles = StyleSheet.create({
  flex: { flex: 1 }, toolbar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingBottom: 8 },
  filters: { gap: 5, paddingHorizontal: 16 }, filterScroll: { flexGrow: 0, marginBottom: 12 }, chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12 },
  demo: { paddingHorizontal: 16, paddingBottom: 12 }, list: { paddingHorizontal: 16, paddingBottom: 32 },
});
