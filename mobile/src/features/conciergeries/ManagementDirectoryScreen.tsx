import { useBaitlyUser } from '@/config/baitlyDemoProfiles';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type ParamListBase } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { BaitlyEmpty, BaitlyLoading, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { Reicon } from '@/icons';
import { BaitlyHeader, BaitlyHeaderAction } from '@/design-system/BaitlyHeader';
import { useBaitlyTheme } from '@/design-system/theme';
import { BaitlyDiscoveryCard, discoveryColumns } from '@/features/marketplace/BaitlyDiscoveryCard';
import { baitlyDemoPhoto } from '@/features/marketplace/baitlyDemoPhotos';
import { isBaitlyDemoCatalogEnabled } from '@/features/marketplace/baitlyDemoCatalog';
import { guestReviewSummary } from '@/features/marketplace/baitlyDemoClients';
import { demoConciergeBadges } from './badges';
import { ConciergeBadges } from './ConciergeBadges';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaitlyMapPreview } from '@/features/marketplace/BaitlyMapPreview';
import { PublicHomesMap } from './PublicHomesMap';
import { usePublicProfiles } from './publicProfiles';

/** Public discovery is opt-in; being a review author alone never implies consent. */

/** Routes that push this directory over another screen: it then draws its own back button. */
const PUSHED_ROUTES = new Set(['DiscoverConciergeries', 'PublicHomes']);
export function ManagementDirectoryScreen({ publishedContent, switcher }: { publishedContent: (search: string) => React.ReactNode; switcher?: React.ReactNode }) {
  const { t, i18n } = useTranslation('mobileV1');
  const colors = useBaitlyTheme();
  const user = useBaitlyUser();
  const conciergeAccount = user?.organizationType === 'CONCIERGE' && !user.roles.some(role => ['SUPER_ADMIN', 'SUPER_MANAGER', 'ADMIN'].includes(role));
  const { width, fontScale } = useWindowDimensions();
  const columns = discoveryColumns(width, fontScale);
  const navigation = useNavigation<NativeStackNavigationProp<BaitlyStackParams>>();
  const tabNavigation = useNavigation<BottomTabNavigationProp<ParamListBase>>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const [mapMode, setMapMode] = useState(false);
  const [mapRoles, setMapRoles] = useState({ CONCIERGE: true, OWNER: true });
  useFocusEffect(useCallback(() => {
    tabNavigation.setOptions({ tabBarStyle: mapMode ? { position: 'absolute', bottom: 0, left: 0, right: 0 } : undefined });
    return () => tabNavigation.setOptions({ tabBarStyle: undefined });
  }, [mapMode, tabNavigation]));
  const [role, setRole] = useState<'CONCIERGE' | 'OWNER'>('CONCIERGE');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInput = useRef<TextInput>(null);
  useEffect(() => { if (searchOpen && !mapMode) searchInput.current?.focus(); }, [searchOpen, mapMode]);
  const demo = isBaitlyDemoCatalogEnabled();
  const effectiveRole = conciergeAccount ? 'OWNER' : role;
  const profiles = usePublicProfiles(effectiveRole, search);
  const clients = (profiles.data ?? []).filter(client => !conciergeAccount || (client.role === 'OWNER' && client.seekingManagement && client.properties.length > 0));
  const mapConcierges = usePublicProfiles('CONCIERGE', '', mapMode && !conciergeAccount && mapRoles.CONCIERGE);
  const mapOwners = usePublicProfiles('OWNER', '', mapMode && (conciergeAccount || mapRoles.OWNER));
  const mapQueries = [!conciergeAccount && mapRoles.CONCIERGE ? mapConcierges : null, conciergeAccount || mapRoles.OWNER ? mapOwners : null].filter(query => query !== null);
  const mapClients = mapQueries.flatMap(query => query.data ?? []).filter(client => !conciergeAccount || (client.role === 'OWNER' && client.seekingManagement && client.properties.length > 0));
  const row = { flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' as const : 'row' as const };
  const mapAction = <Pressable accessibilityRole="button" accessibilityLabel={t(mapMode ? 'publicHomesList' : 'publicHomesMap')}
    accessibilityState={{ selected: mapMode }} onPress={() => setMapMode(value => !value)}
    style={[styles.searchButton, { backgroundColor: colors.surface }]}>
    {mapMode ? <Reicon name="list-outline" size={22} color={colors.ink} /> : <BaitlyMapPreview />}
  </Pressable>;
  const searchAction = <BaitlyHeaderAction icon="search-outline" label={t('directorySearch')} onPress={() => { setSearchOpen(true); searchInput.current?.focus(); }} />;
  const mapFilters = <View style={[styles.mapFilters, row]}>
    {(['CONCIERGE', 'OWNER'] as const).map(value => <Pressable key={value} accessibilityRole="checkbox"
      accessibilityState={{ checked: mapRoles[value] }}
      onPress={() => setMapRoles(previous => ({ ...previous, [value]: !previous[value] }))}
      style={({ pressed }) => [styles.mapFilter, row, { backgroundColor: pressed ? colors.muted : colors.surface,
        borderColor: mapRoles[value] ? colors.primary : colors.border }]}>
      <Reicon name={mapRoles[value] ? 'checkbox-outline' : 'square-outline'} size={18} color={mapRoles[value] ? colors.primary : colors.secondary} />
      <BaitlyText style={styles.mapFilterLabel}>{t(value === 'CONCIERGE' ? 'directoryConcierges' : 'directoryOwners')}</BaitlyText>
    </Pressable>)}
  </View>;
  const toolbar = <View style={{ width: '100%', gap: 8 }}>
    {mapMode ? <View style={[row, { alignItems: 'center', gap: 8 }]}>{mapAction}{conciergeAccount ? null : mapFilters}</View>
      : <BaitlyHeader start={<View style={row}>{PUSHED_ROUTES.has(route.name) ? <BaitlyHeaderAction icon={i18n.dir() === 'rtl' ? 'chevron-forward' : 'chevron-back'} label={t('back')} onPress={() => navigation.goBack()} /> : null}{mapAction}</View>} end={searchAction} />}
    {!mapMode ? switcher : null}
    {searchOpen && !mapMode ? <View style={[styles.search, row, { backgroundColor: colors.surface, borderColor: searchFocused ? colors.primary : colors.border }]}>
      <Reicon name="search-outline" color={colors.secondary} size={19} />
      <TextInput ref={searchInput} accessibilityLabel={t('directorySearch')} placeholder={t('directorySearch')}
        placeholderTextColor={colors.secondary} value={search} onChangeText={setSearch}
        onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} returnKeyType="search"
        style={[styles.searchInput, { color: colors.ink, textAlign: i18n.dir() === 'rtl' ? 'right' : 'left' }]} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('clearSearch')} onPress={() => { setSearch(''); setSearchOpen(false); }} style={styles.searchButton}>
        <Reicon name="close" color={colors.secondary} size={18} />
      </Pressable>
    </View> : null}
  </View>;
  const tabs = <View style={[styles.tabs, row, { borderBottomColor: colors.border }]}>
      {(['CONCIERGE', 'OWNER'] as const).map(value => <Pressable key={value} accessibilityRole="tab"
        accessibilityState={{ selected: role === value }} onPress={() => { setRole(value); setSearch(''); }}
        style={[styles.tab, { borderBottomColor: role === value ? colors.ink : 'transparent' }]}>
        <BaitlyText style={styles.tabLabel}>{t(value === 'CONCIERGE' ? 'directoryConcierges' : 'directoryOwners')}</BaitlyText>
      </Pressable>)}
    </View>;
  if (mapMode) return <View style={{ flex: 1, backgroundColor: colors.background }}>
    {!mapQueries.length ? <BaitlyEmpty title={t('publicMapSelectFilter')} />
      : mapQueries.some(query => query.isPending) ? <BaitlyLoading />
      : mapQueries.some(query => query.isError) ? <BaitlyEmpty title={t('loadFailed')} retry={() => { mapQueries.forEach(query => { void query.refetch(); }); }} />
      : <PublicHomesMap clients={mapClients} onOpen={(clientProfileId, propertyId) => navigation.navigate('PublicProperty', { clientProfileId, propertyId })} />}
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 4, left: 16, right: 16, gap: 8 }}>
      {toolbar}
    </View>
  </View>;
  return <BaitlyScreen scroll={false} header={toolbar} headerStyle={styles.header}>
    {conciergeAccount ? null : tabs}
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>
      {demo ? <BaitlyText muted variant="meta">{t('directoryDemo')}</BaitlyText> : null}
      {profiles.isPending ? <BaitlyLoading /> : profiles.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void profiles.refetch(); }} />
        : !clients.length ? (!demo && effectiveRole === 'CONCIERGE' ? publishedContent(search) : <BaitlyEmpty title={t('directoryNoMatch')} />) : null}
      <View style={[styles.grid, row]}>{clients.map(client => {
        const rating = guestReviewSummary(client.properties);
        const badges = demoConciergeBadges(client);
        const contactLabel = t(client.role === 'CONCIERGE' ? 'publicEntrustProperty' : 'directoryContactOwner');
        return <View key={client.id} style={{ width: `${100 / columns}%` }}>
          <BaitlyDiscoveryCard id={client.id} title={client.organization ?? client.name} city={client.city}
            photo={client.demo ? baitlyDemoPhoto(client.role === 'CONCIERGE' ? -2 : -1) : client.coverUrl ?? client.avatarUrl} average={rating.average} count={rating.count}
            imageOverlay={<ConciergeBadges badges={badges} />}
            homesCount={client.properties.length} subtitle={client.role === 'CONCIERGE' ? client.name : t('directorySeekingShort')}
            onOpen={() => navigation.navigate('PublicClientProfile', { clientProfileId: client.id })}
            onFooterPress={() => navigation.navigate('PublicClientProfile', { clientProfileId: client.id, contact: true })}
            footerLabel={contactLabel} footer={<BaitlyText numberOfLines={2} style={styles.contactLabel}>{contactLabel}</BaitlyText>} />
        </View>;
      })}</View>
    </ScrollView>
  </BaitlyScreen>;
}

const styles = StyleSheet.create({
  mapFilters: { flex: 1, flexWrap: 'wrap', gap: 6 },
  mapFilter: { minHeight: 44, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, alignItems: 'center', gap: 5 },
  mapFilterLabel: { fontSize: 12, fontWeight: '500' },
  header: { paddingTop: 4, paddingBottom: 12 },
  toolbar: { flex: 1, minHeight: 44, alignItems: 'center', gap: 10 },
  title: { flex: 1, minWidth: 0, alignItems: 'center', gap: 8 },
  searchButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  search: { flex: 1, minWidth: 0, minHeight: 44, borderWidth: 1, borderRadius: 12, alignItems: 'center', paddingStart: 10, gap: 6 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, minHeight: 44, paddingVertical: 8 },
  tabs: { paddingHorizontal: 20, gap: 24, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { minHeight: 50, justifyContent: 'center', borderBottomWidth: 2 }, tabLabel: { fontSize: 15, fontWeight: '500' },
  content: { padding: 20, gap: 16, paddingBottom: 100 },
  grid: { flexWrap: 'wrap', marginHorizontal: -6 },
  contactLabel: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
});
