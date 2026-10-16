import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BaitlyButton, BaitlyEmpty, BaitlyLoading, BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { useBaitlyReducedMotion } from '@/navigation/useBaitlyMotion';
import { useBaitlyScope } from './queries';
import type { CatalogProvider } from './api';
import { providerMapPoint, selectedMapIds, validMapPosition, type MapPosition } from './baitlyMapDomain';
import { baitlyProviderMapUrl, baitlyProviderMapPayload } from './baitlyMapBridge';
import { baitlyDemoPhoto } from './baitlyDemoPhotos';
import { BaitlyMoney } from './BaitlyMoney';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '@/api/apiClient';
import { mapCityKey } from './baitlyMapDomain';

async function cityPosition(city: string, parentSignal: AbortSignal,country?:string|null): Promise<MapPosition | undefined> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parentSignal.addEventListener('abort', abort);
  const timer = setTimeout(abort, 10000);
  try {
    if (parentSignal.aborted) controller.abort();
    const result = await apiClient.get<MapPosition|undefined>('/public/baitly-catalog/city-position',{skipAuth:true,signal:controller.signal,params:{city,country:country||undefined}});
    return validMapPosition(result) ? { latitude: result.latitude, longitude: result.longitude } : undefined;
  } finally { clearTimeout(timer); parentSignal.removeEventListener('abort', abort); }
}

export function ProviderMap({ providers, onOpen, loadMore, loadingMore = false, mode = 'catalog', renderSelection, mapLabels }: {
  providers: CatalogProvider[]; onOpen?: (id: number) => void; loadMore?: () => void; loadingMore?: boolean;
  mode?: 'catalog' | 'coverage';
  renderSelection?: (id: number) => React.ReactNode;
  mapLabels?: { map: string; pin: string };
}) {
  const { t, i18n } = useTranslation('mobileV1');
  const colors = useBaitlyTheme();
  const insets = useSafeAreaInsets();
  const scope = useBaitlyScope();
  const reduced = useBaitlyReducedMotion();
  const web = useRef<WebView>(null);
  const [selected, setSelected] = useState<number>();
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [mapFailed, setMapFailed] = useState(false);
  const [tileFailed, setTileFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const [revision, setRevision] = useState(0);
  const locations = useQuery({
    queryKey: [...scope, 'catalog-map', providers.map(p => [p.id, p.demo, p.baseCity,p.baseCountryCode, p.coverageCities, p.travelRadiusKm, p.demoPosition])],
    retry: false, staleTime: 3600000,
    queryFn: async ({ signal }) => {
      const cities: Record<string, MapPosition> = {};
      const requests=new Map<string,{city:string;country?:string|null}>();
      providers.filter(p=>!p.demo).forEach(p=>[p.baseCity,...p.coverageCities].forEach(city=>{if(city?.trim())requests.set(mapCityKey(city,p.baseCountryCode),{city:city.trim(),country:p.baseCountryCode});}));
      const names=[...requests.keys()];
      for (let start = 0; start < names.length; start += 4) {
        const batch = names.slice(start, start + 4);
        const results = await Promise.allSettled(batch.map(name => {const request=requests.get(name)!;return cityPosition(request.city,signal,request.country);}));
        results.forEach((result, index) => { if (result.status === 'fulfilled' && result.value) cities[batch[index]] = result.value; });
        if (signal.aborted) throw new Error('Map query cancelled');
      }
      return providers.map(p => providerMapPoint(p, cities)).filter(p => p !== null);
    },
  });
  const points = locations.data;
  const url = baitlyProviderMapUrl(i18n.language, colors.background === '#0A1120', mode);
  const payload = useMemo(() => {
    const script = baitlyProviderMapPayload(points ?? [], mapLabels ?? { map: t('providerMap'), pin: t('provider') }, reduced);
    return mode === 'coverage' && points?.length
      ? `${script}window.selectBaitlyProvider?.(${points[0].id});true;` : script;
  }, [points, reduced, t, mode, mapLabels]);
  useEffect(() => {
    setSelected(undefined); setGroupIds([]); setReady(false); setMapFailed(false); setTileFailed(false);
    readyRef.current = false;
    const timer = setTimeout(() => { if (!readyRef.current) setMapFailed(true); }, 15000);
    return () => clearTimeout(timer);
  }, [url, revision]);
  useEffect(() => { if (ready) { setMapFailed(false); web.current?.injectJavaScript(payload); } }, [ready, payload]);
  useEffect(() => { setSelected(undefined); setGroupIds([]); }, [points]);
  const p = providers.find(p => p.id === selected);
  const photo = p?.demo ? baitlyDemoPhoto(p.id) : p?.avatarUrl;
  const select = (id: number) => {
    if (!points?.some(point => point.id === id)) return;
    setSelected(id);
    web.current?.injectJavaScript(`window.selectBaitlyProvider?.(${id});true;`);
  };
  const retry = () => { setRevision(value => value + 1); void locations.refetch(); };
  if (locations.isPending) return <BaitlyLoading />;
  if (locations.isError || !points?.length) return <BaitlyEmpty title={t('mapNoLocations')} retry={retry} />;
  return <View style={styles.container}>
    <View style={styles.map}>
      <WebView ref={web} key={revision} source={{ uri: url }} originWhitelist={[new URL(url).origin]} style={{ backgroundColor: colors.muted }}
        javaScriptEnabled scrollEnabled={false} setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={request => {
          if (request.url === url || request.url === 'about:blank') return true;
          if (['https://www.openstreetmap.org/copyright', 'https://mapterhorn.com/attribution'].includes(request.url)) void Linking.openURL(request.url);
          return false;
        }}
        onError={() => setMapFailed(true)} onHttpError={() => setMapFailed(true)}
        onMessage={event => {
          const ids = selectedMapIds(event.nativeEvent.data, points);
          if (ids.length) { if (mode === 'catalog') { setGroupIds(ids); setSelected(ids[0]); } return; }
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message.type === 'ready') {
              readyRef.current = true; setReady(true); setMapFailed(false);
              web.current?.injectJavaScript(payload);
            }
            if (message.type === 'error') setMapFailed(true);
            if (message.type === 'tilesError') setTileFailed(true);
          } catch { /* Ignore messages outside the map contract. */ }
        }} />
    </View>
    <View pointerEvents="box-none" style={[styles.sheet, { bottom: mode === 'coverage' ? 12 : Math.max(insets.bottom, 8) + 80 }]}>
    {mapFailed || tileFailed ? <BaitlyButton secondary title={t('retryMap')} onPress={retry} /> : null}
    {groupIds.length > 1 ? <ScrollView horizontal style={styles.choices} contentContainerStyle={{ gap: 8 }}>
      {groupIds.map(id => <BaitlyButton key={id} title={providers.find(p => p.id === id)?.displayName ?? ''}
        secondary={selected !== id} onPress={() => select(id)} />)}
    </ScrollView> : null}
    {mode === 'catalog' && p && renderSelection ? renderSelection(p.id) : null}
    {mode === 'catalog' && p && !renderSelection ? <Pressable accessibilityRole="button" accessibilityLabel={p.displayName} onPress={() => onOpen?.(p.id)}
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? colors.muted : colors.surface,
        flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' : 'row' }]}>
      {photo ? <Image source={photo} contentFit="cover" style={styles.photo} accessible={false} /> : null}
      <View style={styles.cardText}><BaitlyText variant="heading" numberOfLines={1}>{p.displayName}</BaitlyText>
        {p.headline ? <BaitlyText variant="meta" muted numberOfLines={1}>{p.headline}</BaitlyText> : null}
        <BaitlyText variant="meta" muted numberOfLines={1}>{[...new Set([p.baseCity, ...p.coverageCities].filter(Boolean))].join(' · ')}</BaitlyText>
        {points.find(point => point.id === p.id)?.radiusKm ? <BaitlyText variant="meta" muted>
          {t('mapRadius', { count: p.travelRadiusKm ?? undefined })}</BaitlyText> : null}
        <BaitlyMoney amount={p.priceFrom} currency={p.currency} country={p.baseCountryCode} style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }} />
      </View>
    </Pressable> : null}
    {loadMore ? <BaitlyButton secondary title={t('loadMore')} busy={loadingMore} onPress={loadMore} /> : null}
    {mode === 'catalog' && providers.every(provider => provider.demo) ? <BaitlyText variant="meta" style={[styles.demo, { color: colors.ink, backgroundColor: colors.surface }]}>{t('demoCatalog')}</BaitlyText> : null}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  sheet: { position: 'absolute', left: 16, right: 16, gap: 8 },
  demo: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, fontSize: 11 },
  choices: { flexGrow: 0, maxHeight: 60 },
  card: { padding: 12, borderRadius: 14, gap: 12, alignItems: 'center' },
  cardText: { flex: 1, gap: 3 }, photo: { width: 68, height: 90, borderRadius: 10 },
});
