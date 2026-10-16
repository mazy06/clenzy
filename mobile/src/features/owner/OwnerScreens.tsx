import { MissionPropertyPhotos } from '@/features/missions/MissionPropertyPhotos';
import { Image } from 'expo-image';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useBaitlyTheme } from '@/design-system/theme';
import { baitlyMediaList, baitlyPrivateImageSource } from '@/api/baitlyMedia';
import { Reicon } from '@/icons';
import { workApi } from '@/features/missions/api';
import React, { useCallback } from 'react';
import { RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { propertiesApi, type Property } from '@/api/endpoints/propertiesApi';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { BaitlyButton, BaitlyEmpty, BaitlyLoading, BaitlyRow, BaitlyScreen, BaitlyText, baitlyStyles } from '@/design-system/components';
import { BaitlyHeaderAction } from '@/design-system/BaitlyHeader';
import { useBaitlyProperties, useBaitlyScope, useRequests } from '@/features/marketplace/queries';
import type { QuoteRequest } from '@/features/marketplace/api';
import { demoOwnedProperties } from './baitlyDemoProperties';
import { publicPropertyPhotos } from '@/features/conciergeries/publicPropertyPhotos';

export function OwnerHomeScreen() {
  const { t } = useTranslation('mobileV1');
  const user = useAuthStore(s => s.user);
  const navigation = useNavigation<NativeStackNavigationProp<BaitlyStackParams>>();
  const requests = useRequests('sent', 'QUOTED');
  const scope = useBaitlyScope();
  const reports = useQuery({ queryKey: [...scope, 'owner-reports'], queryFn: () => workApi.ownerList(0, 'AWAITING_VALIDATION'), retry: false });
  const decisions = requests.data?.pages.flatMap(p => p.items) ?? [];
  const renderItem = useCallback(({ item }: { item: QuoteRequest }) => <BaitlyRow title={item.title}
    subtitle={item.providerName} detail={t(item.expired ? 'status.EXPIRED' : 'decisionNeeded')}
    onPress={() => navigation.navigate('Quote', { requestId: item.id, side: 'sent' })} />, [navigation, t]);
  return <BaitlyScreen title={t('today')} subtitle={user?.organizationName} scroll={false}
    actions={<BaitlyHeaderAction icon="person-outline" label={t('account')} onPress={() => navigation.navigate('Account')} />}>
    <FlashList data={decisions} renderItem={renderItem} keyExtractor={item => String(item.id)} contentContainerStyle={baitlyStyles.list}
      refreshControl={<RefreshControl refreshing={requests.isRefetching || reports.isRefetching} onRefresh={() => {
        void Promise.allSettled([requests.refetch(), reports.refetch()]);
      }} />}
      ListHeaderComponent={<>
        <BaitlyButton secondary title={t('missions')} onPress={() => navigation.navigate('OwnerMissions')} />
        {reports.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void reports.refetch(); }} /> : null}
        {reports.data?.content.map(item => <BaitlyRow key={item.id} title={item.title} subtitle={t('report')}
          onPress={() => navigation.navigate('Mission', { interventionId: item.id })} />)}
        <BaitlyText variant="heading">{t('decisions')}</BaitlyText>
      </>}
      ListEmptyComponent={requests.isPending ? <BaitlyLoading /> : <BaitlyEmpty
        title={requests.isError ? t('loadFailed') : t('noDecisions')}
        retry={requests.isError ? () => { void requests.refetch(); } : undefined} />}
      ListFooterComponent={requests.hasNextPage ? <BaitlyButton title={t('loadMore')} secondary busy={requests.isFetchingNextPage}
        onPress={() => { void requests.fetchNextPage(); }} /> : null} />
  </BaitlyScreen>;
}

export function BaitlyPropertiesScreen({ switcher }: { switcher?: React.ReactNode }) {
  const { t, i18n } = useTranslation('mobileV1');
  const c = useBaitlyTheme();
  const { width, fontScale } = useWindowDimensions();
  const columns = width >= 768 ? 3 : width >= 360 && fontScale < 1.3 ? 2 : 1;
  const navigation = useNavigation<NativeStackNavigationProp<BaitlyStackParams>>();
  const query = useBaitlyProperties();
  const renderItem = useCallback(({ item }: { item: Property }) => {
    const photo = baitlyMediaList(item.photos)[0];
    // Demo homes carry sector keys ("pool"…) rather than stored media.
    const demoPhoto = item.id < 0 && photo ? publicPropertyPhotos({ photos: [photo] } as never, true)[0] : undefined;
    const source = demoPhoto ?? (photo ? baitlyPrivateImageSource(photo) : undefined);
    return <Pressable accessibilityRole="button" accessibilityLabel={item.name} onPress={() => item.id < 0 ? navigation.navigate('Property', { propertyId: item.id }) : navigation.navigate('PropertyDetail', { propertyId: item.id })} style={({ pressed }) => ({ flex: 1, marginHorizontal: 5, marginBottom: 12, borderRadius: 14, overflow: 'hidden', backgroundColor: pressed ? c.muted : c.surface })}>
      <Image source={source ?? require('../../../assets/baitly/navigation/baitly-properties.png')} contentFit={source ? 'cover' : 'contain'} style={{ width: '100%', aspectRatio: 1.8, backgroundColor: c.muted }} cachePolicy={source ? 'none' : 'memory-disk'} accessible={false} />
      <View style={{padding:12,gap:5}}><BaitlyText style={{fontSize:17,lineHeight:23,fontWeight:'600'}} numberOfLines={2}>{item.name}</BaitlyText><BaitlyText muted variant="meta">{item.city}</BaitlyText>
        <View style={{flexDirection:i18n.dir()==='rtl'?'row-reverse':'row',gap:5,alignItems:'center'}}><Reicon name="bed-outline" size={16} color={c.secondary}/><BaitlyText muted variant="meta" style={{fontVariant:['tabular-nums']}}>{item.bedroomCount ?? '–'}</BaitlyText><Reicon name="people-outline" size={16} color={c.secondary}/><BaitlyText muted variant="meta" style={{fontVariant:['tabular-nums']}}>{item.maxGuests ?? '–'}</BaitlyText></View>
      </View><View style={{paddingHorizontal:12,paddingVertical:10,backgroundColor:c.muted}}><BaitlyText variant="meta">{t('viewProperty')}</BaitlyText></View>
    </Pressable>;
  }, [navigation,c,i18n,t]);
  return <BaitlyScreen title={switcher ? undefined : t('accountMyProperties')} scroll={false}>
    {switcher ? <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>{switcher}</View> : null}
    <FlashList key={columns} numColumns={columns} data={query.data?.pages.flatMap(p => p.content) ?? []} renderItem={renderItem} keyExtractor={item => String(item.id)}
      contentContainerStyle={baitlyStyles.list}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }} />}
      onEndReached={() => { if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage(); }}
      ListEmptyComponent={query.isPending ? <BaitlyLoading /> : <BaitlyEmpty icon="home-outline"
        title={query.isError ? t('loadFailed') : t('noProperties')} message={query.isError ? t('retryHelp') : t('noPropertiesHelp')}
        retry={query.isError ? () => { void query.refetch(); } : undefined} />}
      ListFooterComponent={query.isFetchingNextPage ? <BaitlyLoading /> : query.isError && query.data
        ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void query.refetch(); }} /> : null} />
  </BaitlyScreen>;
}

export function BaitlyPropertyScreen({ route }: NativeStackScreenProps<BaitlyStackParams, 'Property'>) {
  const { t } = useTranslation('mobileV1');
  const scope = useBaitlyScope();
  const result = useQuery({ queryKey: [...scope, 'property', route.params.propertyId],
    queryFn: () => route.params.propertyId<0 ? Promise.resolve(demoOwnedProperties().find(item=>item.id===route.params.propertyId)) : propertiesApi.getById(route.params.propertyId) });
  const property = result.data;
  return <BaitlyScreen title={property?.name ?? t('properties')}>
    {result.isPending ? <BaitlyLoading /> : null}
    {result.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void result.refetch(); }} /> : null}
    {property && !result.isError ? <>
      <MissionPropertyPhotos photos={baitlyMediaList(property.photos)} demo={route.params.propertyId < 0} />
      <BaitlyText>{[property.address, property.city, property.country].filter(Boolean).join(', ')}</BaitlyText>
      {property.description ? <BaitlyText>{property.description}</BaitlyText> : null}
      {property.specialRequirements ? <><BaitlyText variant="heading">{t('instructions')}</BaitlyText>
        <BaitlyText>{property.specialRequirements}</BaitlyText></> : null}
    </> : null}
  </BaitlyScreen>;
}
