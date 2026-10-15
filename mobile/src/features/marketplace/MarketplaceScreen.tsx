import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { ParamListBase } from '@react-navigation/native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { BaitlyButton, BaitlyEmpty, BaitlyLoading, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { BaitlyHeader, BaitlyHeaderAction } from '@/design-system/BaitlyHeader';
import { useCatalog, useCategories } from './queries';
import { formatMoney } from './domain';
import type { CatalogProvider } from './api';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import { baitlyDemoPhoto } from './baitlyDemoPhotos';
import { baitlySectorImage } from './baitlySectorImages';
import { ProviderMap } from './ProviderMap';
import { BaitlyMapPreview } from './BaitlyMapPreview';
import { BaitlyMoney } from './BaitlyMoney';
import { BaitlyDiscoveryCard, discoveryColumns } from './BaitlyDiscoveryCard';

const ProviderRow = memo(function ProviderRow({ provider: p, onOpen }: { provider: CatalogProvider; onOpen: (id: number) => void }) {
  const { t, i18n } = useTranslation('mobileV1');
  const rtl = i18n.dir() === 'rtl';
  const price = formatMoney(p.priceFrom, p.currency, i18n.language);
  const photo = p.demo ? baitlyDemoPhoto(p.id) : p.avatarUrl;
  return <BaitlyDiscoveryCard id={p.id} title={p.displayName} city={p.baseCity} photo={photo}
    average={p.ratingAvg} count={p.ratingCount} verified={p.verified} subtitle={p.headline} onOpen={() => onOpen(p.id)}
    footer={<View style={[styles.priceText, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
      {price ? <BaitlyText variant="meta" muted style={styles.priceLabel}>{t('shortPriceFrom')}</BaitlyText> : null}
      <BaitlyMoney amount={p.priceFrom} currency={p.currency} country={p.baseCountryCode} style={price ? styles.price : styles.quote} />
    </View>} />;
});

export function MarketplaceScreen() {
  const { width, fontScale } = useWindowDimensions();
  const columns = discoveryColumns(width, fontScale);
  const { t, i18n } = useTranslation('mobileV1');
  const navigation = useNavigation<NativeStackNavigationProp<BaitlyStackParams>>();
  // Pushed as « Services » with the native header hidden: the toolbar carries the back button.
  const pushed = useRoute().name === 'Services';
  const tabNavigation = useNavigation<BottomTabNavigationProp<ParamListBase>>();
  const insets = useSafeAreaInsets();
  const colors = useBaitlyTheme();
  const rtl = i18n.dir() === 'rtl';
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mapMode, setMapMode] = useState(false);
  useEffect(() => {
    tabNavigation.setOptions({ tabBarStyle: mapMode ? { position: 'absolute', bottom: 0, left: 0, right: 0 } : undefined });
  }, [mapMode, tabNavigation]);
  const searchInput = useRef<TextInput>(null);
  useEffect(() => { if (searchOpen) searchInput.current?.focus(); }, [searchOpen]);
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const catalog = useCatalog(query, category);
  const categories = useCategories();
  useEffect(() => {
    if (mapMode && catalog.hasNextPage && !catalog.isFetchingNextPage && !catalog.isFetchNextPageError
      && (catalog.data?.pages.length ?? 0) < 10) void catalog.fetchNextPage();
  }, [mapMode, catalog.hasNextPage, catalog.isFetchingNextPage, catalog.isFetchNextPageError, catalog.data?.pages.length, catalog.fetchNextPage]);
  const items = catalog.data?.pages.flatMap(p => p.items) ?? [];
  const openProvider = useCallback((providerId: number) => navigation.navigate('Provider', { providerId }), [navigation]);
  const renderItem = useCallback(({ item }: { item: CatalogProvider }) => <ProviderRow provider={item} onOpen={openProvider} />, [openProvider]);
  const clear = () => { setSearch(''); setQuery(''); setCategory(''); };
  const searchField = <View style={[styles.search, { backgroundColor: colors.surface, borderColor: searchFocused ? colors.primary : colors.border,
    flexDirection: rtl ? 'row-reverse' : 'row' }]}>
    <Reicon name="search-outline" color={colors.secondary} size={19} />
    <TextInput ref={searchInput} accessibilityLabel={t('providerOrCity')} placeholder={t('providerOrCity')} placeholderTextColor={colors.secondary}
      value={search} onChangeText={setSearch} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
      returnKeyType="search" style={[styles.searchInput, { color: colors.ink, textAlign: rtl ? 'right' : 'left' }]} />
    <Pressable accessibilityRole="button" accessibilityLabel={t('clearSearch')} onPress={() => {
      setSearch(''); setQuery(''); setSearchOpen(false);
    }} style={styles.clearSearch}>
      <Reicon name="close" color={colors.secondary} size={18} />
    </Pressable>
  </View>;
  const mapAction = <Pressable accessibilityRole="button" accessibilityLabel={mapMode ? t('showProviderList') : t('showProviderMap')}
      accessibilityState={{ selected: mapMode }} onPress={() => setMapMode(!mapMode)}
      style={({ pressed }) => [styles.searchButton, { backgroundColor: pressed || mapMode ? colors.muted : colors.surface }]}>
      {mapMode ? <Reicon name="list-outline" size={22} color={colors.ink} />
        : <BaitlyMapPreview />}
    </Pressable>;
  const searchAction = <Pressable accessibilityRole="button" accessibilityLabel={t('providerOrCity')}
      accessibilityState={{ expanded: searchOpen }} onPress={() => { setSearchOpen(true); searchInput.current?.focus(); }}
      style={({ pressed }) => [styles.searchButton, { backgroundColor: pressed ? colors.muted : colors.surface }]}>
      <Reicon name="search-outline" size={22} color={colors.ink} />
    </Pressable>;
  const toolbar = <View style={{ gap: 8, width: '100%' }}>
    {mapMode ? <View style={[styles.toolbar, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>{mapAction}{searchAction}</View>
      : <BaitlyHeader start={pushed ? <View style={{ flexDirection: rtl ? 'row-reverse' : 'row' }}>
        <BaitlyHeaderAction icon={rtl ? 'chevron-forward' : 'chevron-back'} label={t('back')} onPress={() => navigation.goBack()} />{mapAction}</View> : mapAction} end={searchAction} />}
    {searchOpen ? searchField : null}
  </View>;
  if (mapMode) return <KeyboardAvoidingView style={styles.fullMap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    {catalog.isPending ? <BaitlyLoading /> : catalog.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void catalog.refetch(); }} />
      : <ProviderMap providers={items} onOpen={openProvider}
        loadingMore={catalog.isFetchingNextPage} loadMore={catalog.hasNextPage ? () => { void catalog.fetchNextPage(); } : undefined} />}
    <View pointerEvents="box-none" style={[styles.mapControls, { top: insets.top + 4, left: insets.left + 16, right: insets.right + 16 }]}>
      {toolbar}
      {category || search ? <Pressable accessibilityRole="button" onPress={clear} style={styles.mapFields}>
        <BaitlyText variant="meta" muted>{t('clearFilters')}</BaitlyText>
      </Pressable> : null}
    </View>
  </KeyboardAvoidingView>;
  return <BaitlyScreen scroll={false} header={toolbar} headerStyle={styles.servicesHeader}>
    <FlashList key={columns} numColumns={columns} data={items} keyExtractor={item => String(item.id)} renderItem={renderItem}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.list}
      refreshControl={<RefreshControl tintColor={colors.secondary} refreshing={catalog.isRefetching} onRefresh={() => { void catalog.refetch(); }} />}
      onEndReached={() => { if (catalog.hasNextPage && !catalog.isFetchingNextPage) void catalog.fetchNextPage(); }} onEndReachedThreshold={0.3}
      ListHeaderComponent={<View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.tabs, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          {[{ code: '', labelFr: t('allTradesShort'), labelEn: t('allTradesShort') }, ...(categories.data ?? [])].map(c =>
            <Pressable key={c.code} accessibilityRole="button" accessibilityState={{ selected: category === c.code }} onPress={() => setCategory(c.code)}
              style={({ pressed }) => [styles.tab, { borderBottomColor: category === c.code ? colors.ink : 'transparent', opacity: pressed ? 0.6 : 1 }]}>
              <Image source={baitlySectorImage(c.code)} contentFit="contain" style={styles.sectorImage} accessible={false} />
              <BaitlyText variant="meta" muted={category !== c.code} numberOfLines={2} style={[styles.sectorLabel, category === c.code ? styles.selectedTab : undefined]}>
                {i18n.language.startsWith('en') ? c.labelEn : c.labelFr}
              </BaitlyText>
            </Pressable>)}
        </ScrollView>
        {categories.isError ? <BaitlyButton secondary title={t('retry')} onPress={() => { void categories.refetch(); }} /> : null}
        {category || search ? <Pressable accessibilityRole="button" onPress={clear} style={styles.reset}>
          <BaitlyText variant="meta" muted>{t('clearFilters')}</BaitlyText>
        </Pressable> : null}
      </View>}
      ListEmptyComponent={catalog.isPending ? <BaitlyLoading /> : <BaitlyEmpty title={catalog.isError ? t('loadFailed') : t('noProviders')}
        retry={catalog.isError ? () => { void catalog.refetch(); } : search || category ? clear : undefined} />}
      ListFooterComponent={catalog.isFetchingNextPage ? <BaitlyLoading /> : catalog.isFetchNextPageError || (catalog.isError && items.length > 0)
        ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void catalog.refetch(); }} /> : null} />
  </BaitlyScreen>;
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 14, paddingBottom: 28 },
  toolbar: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  toolbarEnd: { alignItems: 'center', gap: 9 },
  servicesHeader: { paddingTop: 4, paddingBottom: 12 },
  fullMap: { flex: 1 },
  mapControls: { position: 'absolute', left: 16, right: 16, gap: 10 },
  mapFields: { paddingHorizontal: 16, paddingBottom: 12, gap: 10, minHeight: 44 },
  searchButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  search: { flex: 1, minWidth: 0, minHeight: 44, borderWidth: 1, borderRadius: 12, alignItems: 'center', paddingStart: 10, gap: 6 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, minHeight: 44, paddingVertical: 8 },
  clearSearch: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  tabs: { gap: 8, paddingBottom: 8 },
  tab: { width: 78, minHeight: 62, alignItems: 'center', justifyContent: 'flex-start', borderBottomWidth: 1, gap: 2, paddingBottom: 3 },
  sectorImage: { width: 30, height: 30 },
  sectorLabel: { fontSize: 11, lineHeight: 13, textAlign: 'center' },
  selectedTab: { fontWeight: '600' },
  reset: { minHeight: 44, justifyContent: 'center' },
  priceText: { flex: 1, flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  priceLabel: { fontSize: 12, lineHeight: 16 },
  price: { fontSize: 18, lineHeight: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
  quote: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
});
