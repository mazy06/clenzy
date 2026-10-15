import React, { useCallback } from 'react';
import { RefreshControl, View } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { BaitlyEmpty, BaitlyLoading, BaitlyText, BaitlyScreen, baitlyStyles } from '@/design-system/components';
import { BaitlyHeaderAction } from '@/design-system/BaitlyHeader';
import { useBaitlyScope } from '@/features/marketplace/queries';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { workApi } from './api';
import { MissionCard } from './MissionCard';
import { canUseBaitlyDemo, useBaitlyDataMode } from '@/config/baitlyDataMode';
import { useBaitlyDemoProfile, useBaitlyUser } from '@/config/baitlyDemoProfiles';
import { demoWorkList, useDemoWorkRevision } from './baitlyDemoWork';
import { missionListRows, type MissionListRow } from './missionListModel';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
const tradeArtwork = {
  cleaning: require('../../../assets/baitly/sectors/cleaning.webp'),
  maintenance: require('../../../assets/baitly/sectors/sector-maintenance.webp'),
  laundry: require('../../../assets/baitly/sectors/sector-laundry.webp'),
  exterior: require('../../../assets/baitly/sectors/sector-garden.webp'),
};
export function MissionsScreen({ owner = false, header, listHeader, listFooter, embedded = false }: { owner?: boolean; embedded?: boolean; header?: React.ReactNode; listHeader?: React.ReactNode; listFooter?: React.ReactNode }) {
  const { t } = useTranslation('mobileV1');
  const c=useBaitlyTheme();
  const scope = useBaitlyScope();
  const cache = useQueryClient();
  const profile = useBaitlyDemoProfile(s => s.key);
  const user = useBaitlyUser();
  useDemoWorkRevision(state => state.revision);
  const mode = useBaitlyDataMode(s => s.mode);
  const trade = mode === 'demo' ? profile : user?.roles.includes('HOUSEKEEPER')?'cleaning':user?.roles.includes('TECHNICIAN')?'maintenance':user?.roles.includes('LAUNDRY')?'laundry':user?.roles.includes('EXTERIOR_TECH')?'exterior':null;
  const artwork = trade && trade in tradeArtwork ? tradeArtwork[trade as keyof typeof tradeArtwork] : undefined;
  const demo = canUseBaitlyDemo() && mode === 'demo';
  const navigation = useNavigation<NativeStackNavigationProp<BaitlyStackParams>>();
  const result = useInfiniteQuery({ queryKey: [...scope, 'missions', owner], initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => owner ? workApi.ownerList(pageParam) : workApi.list(pageParam, signal),
    getNextPageParam: last => last.number + 1 < last.totalPages ? last.number + 1 : undefined, retry: false, enabled: !demo });
  const rows=missionListRows(demo ? demoWorkList() : result.data?.pages.flatMap(p => p.content) ?? []);
  const render = useCallback(({ item }: { item: MissionListRow }) => {
    if(item.kind==='heading')return <View style={{flexDirection:'row',alignItems:'center',gap:8,paddingTop:item.group==='running'||item.group==='upcoming'?12:24,paddingBottom:12}}>
      <Reicon name={item.group==='running'?'play-circle-outline':item.group==='upcoming'?'calendar-outline':item.group==='review'?'time-outline':item.group==='cancelled'?'close-circle-outline':'checkmark-circle-outline'} size={21} color={c.ink}/>
      <BaitlyText accessibilityRole="header" style={{flex:1,fontWeight:'600',fontSize:17}}>{t(owner&&item.group==='upcoming'?'missionGroup.planned':`missionGroup.${item.group}`)}</BaitlyText><BaitlyText muted variant="meta" style={{fontVariant:['tabular-nums']}}>{item.count}</BaitlyText>
    </View>;
    const mission=item.mission;
    const type = mission.type.toUpperCase();
    const missionArtwork = artwork ?? (type.includes('CLEAN') || type.includes('HOUSEKEEP') ? tradeArtwork.cleaning : type.includes('LAUNDRY') || type.includes('LINEN') ? tradeArtwork.laundry : type.includes('GARDEN') || type.includes('EXTERIOR') ? tradeArtwork.exterior : type.includes('POOL') ? require('../../../assets/baitly/sectors/sector-pool.webp') : tradeArtwork.maintenance);
    return <MissionCard title={mission.title} compact={['review','finished','cancelled'].includes(item.group)}
    paused={!!mission.pausedAt} owner={owner}
    artwork={missionArtwork}
    property={mission.propertyName ?? t('remoteMission')} status={mission.status} date={mission.scheduledDate}
    onPress={() => navigation.navigate('Mission', { interventionId: mission.id })}/>;
  }, [navigation, t, artwork,c.ink,owner]);
  return <BaitlyScreen scroll={false} showHeader={!embedded} header={header}
    actions={<BaitlyHeaderAction icon="person-outline" label={t('account')} onPress={() => navigation.navigate('Account')} />}>
    <FlashList ListHeaderComponent={listHeader ? <>{listHeader}</> : undefined} data={rows} renderItem={render} getItemType={item=>item.kind}
      keyExtractor={item => item.key} contentContainerStyle={baitlyStyles.list}
      refreshControl={demo ? undefined : <RefreshControl refreshing={result.isRefetching} onRefresh={() => { void result.refetch(); if (owner) void cache.invalidateQueries({ queryKey: scope }); }} />}
      onEndReached={() => { if (result.hasNextPage && !result.isFetchingNextPage) void result.fetchNextPage(); }}
      ListEmptyComponent={result.isPending ? <BaitlyLoading /> : <BaitlyEmpty title={result.isError ? t('loadFailed') : t('noMissions')}
        retry={result.isError ? () => { void result.refetch(); } : undefined} />}
      ListFooterComponent={<>{listFooter}{result.isFetchingNextPage ? <BaitlyLoading /> : result.isError && result.data
        ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void result.refetch(); }} /> : null}</>} />
  </BaitlyScreen>;
}

export function OwnerMissionsScreen() { return <MissionsScreen owner />; }
