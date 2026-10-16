import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Reicon } from '@/icons';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { BaitlyButton, BaitlyEmpty, BaitlyField, BaitlyLoading, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { BaitlyHeaderAction } from '@/design-system/BaitlyHeader';
import { useBaitlyTheme } from '@/design-system/theme';
import { BaitlyPill } from '@/design-system/primitives';
import { useRequests } from './queries';
import { formatMoney } from './domain';
import { isBaitlyDemoCatalogEnabled } from './baitlyDemoCatalog';
import type { QuoteRequest, QuoteSide } from './api';

export function RequestsScreen({ side }: { side: QuoteSide }) {
  const { t, i18n } = useTranslation('mobileV1');
  const c = useBaitlyTheme();
  const navigation = useNavigation<NativeStackNavigationProp<BaitlyStackParams>>();
  const requests = useRequests(side);
  const demo = isBaitlyDemoCatalogEnabled();
  const [filter, setFilter] = useState('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const items = requests.data?.pages.flatMap(p => p.items) ?? [];
  const filtered = items.filter(item => (filter === 'all' || filter === 'active' && ['SENT', 'QUOTED'].includes(item.status)
    || filter === 'accepted' && item.status === 'ACCEPTED' || filter === 'closed' && ['DECLINED', 'TURNED_DOWN', 'WITHDRAWN', 'EXPIRED'].includes(item.status))
    && `${item.title} ${item.providerName || ''} ${item.requesterOrganizationName || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const row = { flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' as const : 'row' as const };
  const render = ({ item }: { item: QuoteRequest }) => {
    const pill = item.status === 'ACCEPTED' ? 'success' : item.expired || ['DECLINED', 'TURNED_DOWN', 'WITHDRAWN', 'EXPIRED'].includes(item.status) ? 'error'
      : (side === 'sent' && item.status === 'QUOTED') || (side === 'received' && item.status === 'SENT') ? 'warning' : 'neutral';
    const status = t(side === 'received' && item.status === 'SENT' ? 'toQuote' : side === 'received' && item.status === 'QUOTED' ? 'quoteSent' : `status.${item.status}`);
    return <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Quote', { requestId: item.id, side })}
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? c.muted : c.surface }]}>
      <View style={[styles.top, row]}><View style={styles.flex}><BaitlyPill label={status} tone={pill} /></View>
        <Reicon name={item.status === 'ACCEPTED' ? 'checkmark-circle-outline' : 'document-text-outline'} size={21} color={c.secondary} /></View>
      <BaitlyText style={styles.title} numberOfLines={2}>{item.title}</BaitlyText>
      <BaitlyText muted variant="meta" numberOfLines={1}>{side === 'sent' ? item.providerName : item.requesterOrganizationName}</BaitlyText>
      <View style={[styles.bottom, row, { borderTopColor: c.border }]}>
        <BaitlyText style={[styles.flex, styles.amount]}>{formatMoney(item.quotedAmount, item.quotedCurrency, i18n.language) || t(item.status === 'SENT' ? 'trackingAwaitingPrice' : 'trackingNoQuote')}</BaitlyText>
        <Reicon name="chevron-forward" size={18} color={c.secondary} /></View>
    </Pressable>;
  };
  return <BaitlyScreen scroll={false}>
    <View style={[styles.toolbar, row]}><View style={styles.flex}>{searchOpen ? <BaitlyField label={t('trackingSearch')} value={search} onChangeText={setSearch} autoFocus />
      : <BaitlyText variant="heading">{t(side === 'sent' ? 'tracking' : 'receivedRequests')}</BaitlyText>}</View>
      <BaitlyHeaderAction icon="search-outline" label={t('trackingSearch')} onPress={() => { setSearchOpen(!searchOpen); setSearch(''); }} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={[styles.filters, row]}>
      {['all', 'active', 'accepted', 'closed'].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: value === filter }} onPress={() => setFilter(value)}
        style={({ pressed }) => [styles.chip, { backgroundColor: value === filter ? c.muted : pressed ? c.surface : 'transparent' }]}><BaitlyText variant="meta">{t(`trackingFilter.${value}`)}</BaitlyText></Pressable>)}
    </ScrollView>
    {demo ? <BaitlyText muted variant="meta" style={styles.demo}>{t('homeDemo')}</BaitlyText> : null}
    <FlashList data={filtered} renderItem={render} keyExtractor={item => String(item.id)} contentContainerStyle={styles.list}
      refreshControl={demo ? undefined : <RefreshControl refreshing={requests.isRefetching} onRefresh={() => { void requests.refetch(); }} tintColor={c.secondary} />}
      onEndReached={() => { if (requests.hasNextPage && !requests.isFetchingNextPage) void requests.fetchNextPage(); }}
      ListEmptyComponent={requests.isPending ? <BaitlyLoading /> : requests.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void requests.refetch(); }} />
        : <View style={styles.empty}><Image source={require('../../../assets/baitly/navigation/baitly-tracking.png')} style={styles.illustration} contentFit="contain" accessible={false} />
          <BaitlyText variant="heading" style={{ textAlign: 'center' }}>{t(items.length ? 'trackingNoMatch' : 'noRequests')}</BaitlyText>
          {!items.length ? <BaitlyText muted style={{ textAlign: 'center' }}>{t(side === 'sent' ? 'noRequestsSentHelp' : 'noRequestsReceivedHelp')}</BaitlyText> : null}
          {!items.length && side === 'sent' ? <BaitlyButton title={t('findProvider')} icon="search-outline" onPress={() => navigation.navigate('Services')} /> : null}</View>}
      ListFooterComponent={requests.isFetchingNextPage ? <BaitlyLoading /> : requests.isError && items.length > 0 ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void requests.refetch(); }} /> : null} />
  </BaitlyScreen>;
}
export function SentRequestsScreen() { return <RequestsScreen side="sent" />; }
export function ReceivedRequestsScreen() { return <RequestsScreen side="received" />; }
const styles = StyleSheet.create({
  flex: { flex: 1 }, toolbar: { paddingHorizontal: 16, paddingBottom: 8, alignItems: 'center', gap: 8 }, filterScroll: { flexGrow: 0, marginBottom: 12 }, filters: { paddingHorizontal: 16, gap: 4 },
  chip: { minHeight: 40, paddingHorizontal: 12, borderRadius: 12, justifyContent: 'center' }, demo: { paddingHorizontal: 16, paddingBottom: 12 }, list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { borderRadius: 22, padding: 16, gap: 6, marginBottom: 12 }, top: { alignItems: 'center', gap: 8 }, title: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  bottom: { alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 4 }, amount: { fontSize: 16, fontWeight: '500', fontVariant: ['tabular-nums'] },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 32 }, illustration: { width: 100, height: 110 },
});
