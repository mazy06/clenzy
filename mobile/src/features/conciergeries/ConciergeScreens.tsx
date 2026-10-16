import React, { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { useBaitlyTheme } from '@/design-system/theme';
import { BaitlyButton, BaitlyEmpty, BaitlyField, BaitlyLoading, BaitlyNotice, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { conciergeApi, rankConciergeries, type ConciergePerformance } from './api';
import { ManagementDirectoryScreen } from './ManagementDirectoryScreen';
import { BaitlyDiscoveryCard, discoveryColumns } from '@/features/marketplace/BaitlyDiscoveryCard';
import { conciergeBadges } from './badges';
import { ConciergeBadges } from './ConciergeBadges';

const publicKey = ['baitly-public-concierge-performance'];
function usePerformance() { return useQuery({ queryKey: publicKey, queryFn: ({ signal }) => conciergeApi.list(signal) }); }
function value(number: number | null, suffix = '') { return number === null ? '–' : `${number}${suffix}`; }

function PerformanceFigures({ item }: { item: ConciergePerformance }) {
  const { t } = useTranslation('mobileV1');
  const colors = useBaitlyTheme();
  return <View style={[styles.figures, { borderColor: colors.border }]}>
    <View style={styles.figure}><BaitlyText variant="heading" style={styles.numeric}>{value(item.occupancyPct, '%')}</BaitlyText><BaitlyText variant="meta" muted>{t('reservedNights')}</BaitlyText></View>
    <View style={styles.figure}><BaitlyText variant="heading" style={styles.numeric}>{value(item.ratingAvg, '/5')}</BaitlyText><BaitlyText variant="meta" muted>{t('serviceRating')}</BaitlyText></View>
    <View style={styles.figure}><BaitlyText variant="heading" style={styles.numeric}>{item.managedProperties}</BaitlyText><BaitlyText variant="meta" muted>{t('managedHomes')}</BaitlyText></View>
  </View>;
}

export function PublicPropertiesScreen({ switcher }: { switcher?: React.ReactNode }) {
  return <ManagementDirectoryScreen switcher={switcher} publishedContent={search => <PublishedConciergeriesList search={search} embedded />} />;
}

function PublishedConciergeriesList({ search, embedded = false }: { search: string; embedded?: boolean }) {
  const { width, fontScale } = useWindowDimensions();
  const columns = discoveryColumns(width, fontScale);
  const { t } = useTranslation('mobileV1');
  const colors = useBaitlyTheme();
  const navigation = useNavigation<NativeStackNavigationProp<BaitlyStackParams>>();
  const query = usePerformance();
  const [sort, setSort] = useState<'occupancy' | 'rating'>('occupancy');
  const [selected, setSelected] = useState<number[]>([]);
  const items = rankConciergeries(query.data ?? [], search, sort);
  const toggle = (id: number) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 3 ? [...current, id] : current);
  return <BaitlyScreen showHeader={!embedded} title={embedded ? undefined : t('properties')} subtitle={t('publicHomesIntro')}>
    <View style={[styles.intro, { backgroundColor: colors.surface }]}>
      <Image source={require('../../../assets/baitly/navigation/baitly-properties.png')} style={styles.house} contentFit="contain" enforceEarlyResizing accessible={false} />
      <View style={styles.introCopy}><BaitlyText variant="heading">{t('findManagement')}</BaitlyText><BaitlyText muted>{t('findManagementHelp')}</BaitlyText></View>
    </View>
    <View style={styles.sorts}>{(['occupancy', 'rating'] as const).map(key => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: sort === key }}
      onPress={() => setSort(key)} style={[styles.sort, { backgroundColor: sort === key ? colors.primary : colors.muted }]}>
      <BaitlyText variant="meta" style={{ color: sort === key ? colors.onPrimary : colors.ink }}>{t(key === 'occupancy' ? 'sortOccupancy' : 'sortRating')}</BaitlyText>
    </Pressable>)}</View>
    <BaitlyText variant="meta" muted>{t('comparisonPrivacy')}</BaitlyText>
    {query.isPending ? <BaitlyLoading /> : query.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void query.refetch(); }} />
      : !items.length ? <BaitlyEmpty title={t('noPublicConciergeries')} message={t(query.data?.length ? 'noMatchingConciergeries' : 'publicationEmptyHelp')} /> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>{items.map(item =>
      <View key={item.provider.id} style={{ width: `${100 / columns}%` }}>
        <BaitlyDiscoveryCard id={item.provider.id} title={item.provider.displayName} city={item.provider.baseCity}
          photo={item.provider.avatarUrl} average={item.ratingAvg} count={item.ratingCount}
          imageOverlay={<ConciergeBadges badges={conciergeBadges({ occupancyPct: item.occupancyPct, properties: item.managedProperties,
            completeYear: item.periodStart.slice(0, 10) === `${new Date().getFullYear() - 1}-01-01`
              && item.periodEnd.slice(0, 10) === `${new Date().getFullYear() - 1}-12-31` })} />}
          homesCount={item.managedProperties} subtitle={`${value(item.occupancyPct, '%')} ${t('reservedNights')}`}
          onOpen={() => navigation.navigate('Provider', { providerId: item.provider.id })}
          onFooterPress={() => toggle(item.provider.id)} footerDisabled={!selected.includes(item.provider.id) && selected.length >= 3}
          footerLabel={t(selected.includes(item.provider.id) ? 'removeComparison' : 'addComparison')}
          footer={<BaitlyText numberOfLines={2} style={{ fontSize: 14, lineHeight: 20, fontWeight: '500' }}>{t(selected.includes(item.provider.id) ? 'removeComparison' : 'addComparison')}</BaitlyText>} />
      </View>)}</View>
    {selected.length > 0 ? <BaitlyButton title={t('compareSelected', { count: selected.length })} disabled={selected.length < 2}
      onPress={() => navigation.navigate('CompareConciergeries', { providerIds: selected })} /> : null}
    <BaitlyText variant="meta" muted>{t('performanceMethod')}</BaitlyText>
  </BaitlyScreen>;
}

export function CompareConciergeriesScreen({ route }: { route: { params: { providerIds: number[] } } }) {
  const { t } = useTranslation('mobileV1');
  const colors = useBaitlyTheme();
  const navigation = useNavigation<NativeStackNavigationProp<BaitlyStackParams>>();
  const query = usePerformance();
  // Always refetch the public source, including after a publication is withdrawn.
  const items = (query.data ?? []).filter(item => route.params.providerIds.slice(0, 3).includes(item.provider.id));
  return <BaitlyScreen title={t('compareConciergeries')} subtitle={t('comparisonPrivacy')}>
    {query.isPending ? <BaitlyLoading /> : query.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void query.refetch(); }} />
      : items.length < 2 ? <BaitlyEmpty title={t('comparisonUnavailable')} message={t('publicationEmptyHelp')} />
      : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.comparison}>
        {items.map(item => <View key={item.provider.id} style={[styles.column, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <BaitlyText variant="heading" style={styles.compareTitle}>{item.provider.displayName}</BaitlyText>
          <BaitlyText muted>{item.provider.baseCity || t('unknownCity')}</BaitlyText>
          <BaitlyText variant="meta" muted>{t('performancePeriod', { year: item.periodStart.slice(0, 4) })}</BaitlyText>
          {[['reservedNights', value(item.occupancyPct, '%')], ['serviceRating', value(item.ratingAvg, '/5')], ['managedHomes', String(item.managedProperties)], ['publishedReviews', String(item.ratingCount)]].map(([label, display]) =>
            <View key={label} style={[styles.compareRow, { borderColor: colors.border }]}><BaitlyText variant="meta" muted>{t(label)}</BaitlyText><BaitlyText variant="heading" style={styles.numeric}>{display}</BaitlyText></View>)}
          <BaitlyButton title={t('discussManagement')} onPress={() => navigation.navigate('Provider', { providerId: item.provider.id, purpose: 'management' })} />
        </View>)}
      </ScrollView>}
    <BaitlyNotice>{t('managementConsentHelp')}</BaitlyNotice>
    <BaitlyText variant="meta" muted>{t('performanceMethod')}</BaitlyText>
  </BaitlyScreen>;
}

export function ConciergePublicationScreen() {
  const { t } = useTranslation('mobileV1');
  const scope = useBaitlyScope();
  const client = useQueryClient();
  const key = [...scope, 'concierge-publication'];
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => conciergeApi.settings(signal), retry: false });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const lock = useRef(false);
  async function save(published: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setFailed(false);
    try {
      client.setQueryData(key, await conciergeApi.publish(published));
      await client.invalidateQueries({ queryKey: publicKey });
    } catch { setFailed(true); }
    finally { lock.current = false; setBusy(false); }
  }
  return <BaitlyScreen title={t('publicPerformance')}>
    <BaitlyText>{t('publicationConsentHelp')}</BaitlyText>
    {query.isPending ? <BaitlyLoading /> : query.isError ? <BaitlyEmpty
      title={t((query.error as { status?: number }).status === 403 ? 'publicationAccessHelp' : 'loadFailed')}
      retry={() => { void query.refetch(); }} /> : query.data ? <>
      <BaitlyNotice>{t(query.data.published ? 'performancePublished' : 'performancePrivate')}</BaitlyNotice>
      {query.data.preview ? <><PerformanceFigures item={query.data.preview} /><BaitlyText variant="meta" muted>{t('performancePeriod', { year: query.data.preview.periodStart.slice(0, 4) })}</BaitlyText></> : null}
      {!query.data.eligible ? <BaitlyText muted>{t('publicationMinimum')}</BaitlyText> : null}
      {failed ? <BaitlyNotice error>{t('sendFailed')}</BaitlyNotice> : null}
      <BaitlyButton title={t(query.data.published ? 'withdrawPublication' : 'publishPerformance')} busy={busy} disabled={!query.data.eligible && !query.data.published}
        onPress={() => query.data.published ? void save(false) : Alert.alert(t('publishPerformance'), t('publicationConsentHelp'), [
          { text: t('cancel'), style: 'cancel' }, { text: t('confirm'), onPress: () => { void save(true); } },
        ])} />
    </> : null}
    <BaitlyText variant="meta" muted>{t('performanceMethod')}</BaitlyText>
  </BaitlyScreen>;
}

const styles = StyleSheet.create({
  intro: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 12, gap: 8 },
  house: { width: 82, height: 100 }, introCopy: { flex: 1, gap: 4 },
  sorts: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, sort: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22 },
  company: { borderBottomWidth: 1, paddingVertical: 16, gap: 12 }, companyTitle: { flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 48 },
  avatar: { width: 44, height: 44, borderRadius: 12 },
  figures: { flexDirection: 'row', gap: 8, borderTopWidth: 1, paddingTop: 12 }, figure: { flex: 1, gap: 4 }, numeric: { fontVariant: ['tabular-nums'] },
  comparison: { gap: 12, paddingBottom: 8 }, column: { width: 238, padding: 16, borderRadius: 18, borderWidth: 1, gap: 12 },
  compareTitle: { minHeight: 72 }, compareRow: { minHeight: 80, justifyContent: 'center', gap: 4, borderTopWidth: 1 },
});
