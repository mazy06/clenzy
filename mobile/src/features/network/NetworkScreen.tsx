import React, { useRef, useState } from 'react';
import { Alert, Share, View, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Reicon } from '@/icons';
import { useBaitlyTheme } from '@/design-system/theme';
import { canUseBaitlyDemo, useBaitlyDataMode } from '@/config/baitlyDataMode';
import { baitlyDemoProviders } from '@/features/marketplace/baitlyDemoCatalog';
import { AccountGroup, AccountRow } from '@/features/account/AccountComponents';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { BaitlyButton, BaitlyEmpty, BaitlyField, BaitlyLoading, BaitlyNotice, BaitlyRow, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useCapabilities } from '@/features/missions/queries';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { networkApi, type NetworkLink } from './api';

export function NetworkScreen() {
  const { t } = useTranslation('mobileV1');
  const navigation = useNavigation<NativeStackNavigationProp<BaitlyStackParams>>();
  const route = useRoute();
  const initialToken = (route.params as { token?: string } | undefined)?.token ?? '';
  const scope = useBaitlyScope();
  const colors = useBaitlyTheme();
  const mode = useBaitlyDataMode(s => s.mode);
  const demo = canUseBaitlyDemo() && mode === 'demo';
  const [search, setSearch] = useState('');
  const capabilities = useCapabilities();
  const { isConnected } = useNetworkStatus();
  const cache = useQueryClient();
  const [received, setReceived] = useState(Boolean(initialToken));
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  const members = useInfiniteQuery({ queryKey: [...scope, 'network-members'], initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => demo ? Promise.resolve({ content: baitlyDemoProviders.slice(0, 3), number: 0, totalPages: 1, totalElements: 3, size: 20, first: true, last: true, empty: false }) : networkApi.members(pageParam, signal), enabled: !received,
    getNextPageParam: last => last.number + 1 < last.totalPages ? last.number + 1 : undefined });
  const result = useInfiniteQuery({ queryKey: [...scope, 'network', received], initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => demo ? Promise.resolve({ content: [{ id: -101, providerId: -4, providerName: 'Riad Services · Démo', organizationName: 'Maison Safran · Démo', status: 'INVITED' as const }, { id: -102, providerId: -5, providerName: 'Blanchisserie Atlas · Démo', organizationName: 'Riad Horizon · Démo', status: 'EXPIRED' as const }], number: 0, totalPages: 1, totalElements: 2, size: 20, first: true, last: true, empty: false }) : networkApi.list(received, pageParam, signal),
    enabled: !received || capabilities.data?.canQuote === true,
    getNextPageParam: last => last.number + 1 < last.totalPages ? last.number + 1 : undefined, retry: false });
  async function act(action: () => Promise<unknown>) {
    if (demo || lock.current || !isConnected) return;
    lock.current = true; setBusy(true); setError(false);
    try { await action(); setToken(''); await Promise.all([
      cache.invalidateQueries({ queryKey: [...scope, 'network'] }),
      cache.invalidateQueries({ queryKey: [...scope, 'network-members'] }),
      cache.invalidateQueries({ queryKey: [...scope, 'catalog'] }),
    ]); }
    catch { setError(true); await result.refetch(); }
    finally { lock.current = false; setBusy(false); }
  }
  function remove(link: NetworkLink) {
    Alert.alert(t('removeNetwork'), t('removeNetworkHelp'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('confirm'), style: 'destructive', onPress: () => { void act(() => received ? networkApi.leave(link.id) : networkApi.revoke(link.id)); } },
    ]);
  }
  return <BaitlyScreen>
    <View style={styles.intro}><View style={styles.flex}><BaitlyText style={styles.title}>{t('myNetwork')}</BaitlyText>
      <BaitlyText muted variant="meta">{t(demo ? 'homeDemo' : 'networkPrivateHint')}</BaitlyText></View>
      <Image source={require('../../../assets/baitly/navigation/baitly-network.png')} style={styles.illustration} contentFit="contain" accessible={false} /></View>
    {capabilities.data?.canQuote ? <View style={styles.tabs}>{[false, true].map(value => <Pressable key={String(value)} accessibilityRole="button" accessibilityState={{ selected: received === value }}
      disabled={busy} onPress={() => setReceived(value)} style={({ pressed }) => [styles.tab, { backgroundColor: received === value ? colors.surface : pressed ? colors.muted : 'transparent' }]}>
      <BaitlyText variant="meta" style={{ fontWeight: received === value ? '600' : '400' }}>{t(value ? 'receivedInvitations' : 'myNetwork')}</BaitlyText></Pressable>)}</View> : null}
    {!isConnected ? <BaitlyNotice>{t('onlineRequired')}</BaitlyNotice> : null}
    {error ? <BaitlyNotice error>{t('networkActionFailed')}</BaitlyNotice> : null}
    {!received ? <>
      <BaitlyField label={t('networkSearch')} value={search} onChangeText={setSearch} />
      {members.isPending ? <BaitlyLoading /> : null}
      {members.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void members.refetch(); }} /> : null}
      <AccountGroup title={t('organizationProviders')}>{members.data?.pages.flatMap(p => p.content).filter(p => `${p.displayName} ${p.headline || ''} ${p.baseCity || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(p => <Pressable key={p.id} accessibilityRole="button"
        onPress={() => navigation.navigate('Provider', { providerId: p.id })} style={({ pressed }) => [styles.member, { backgroundColor: pressed ? colors.muted : colors.surface }]}>
        <View style={[styles.avatar, { backgroundColor: colors.muted }]}><BaitlyText style={styles.initial}>{p.displayName.slice(0, 1)}</BaitlyText></View>
        <View style={styles.flex}><BaitlyText style={styles.name}>{p.displayName}</BaitlyText><BaitlyText muted variant="meta" numberOfLines={2}>{[p.headline, p.baseCity].filter(Boolean).join(' · ')}</BaitlyText></View>
        <Reicon name="chevron-forward" size={18} color={colors.secondary} /></Pressable>)}</AccountGroup>
      {members.data && !members.data.pages.some(p => p.content.length) ? <BaitlyText muted>{t('noOrganizationProviders')}</BaitlyText> : null}
      {members.hasNextPage ? <BaitlyButton title={t('loadMore')} secondary busy={members.isFetchingNextPage}
        onPress={() => { void members.fetchNextPage(); }} /> : null}
    </> : null}
    {received ? <>
      <BaitlyField label={t('invitationToken')} value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} />
      <BaitlyButton title={t('acceptInvitation')} disabled={demo || !token || busy || !isConnected}
        onPress={() => { void act(() => networkApi.acceptToken(token.trim())); }} />
    </> : null}
    {result.isPending && (!received || capabilities.data?.canQuote) ? <BaitlyLoading /> : null}
    {result.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void result.refetch(); }} /> : null}
    <AccountGroup title={t('networkInvitations')}>{result.data?.pages.flatMap(p => p.content).map(link => <View key={link.id} style={styles.invitation}>
      <BaitlyText style={styles.name}>{received ? link.organizationName : link.providerName ?? t('providerUnavailable')}</BaitlyText>
      <BaitlyText variant="meta" style={{ color: link.status === 'ACTIVE' ? colors.success : colors.secondary }}>{t(`network.${link.status}`)}</BaitlyText>
      {!received && link.provider ? <AccountRow title={t('networkViewProvider')} icon="person-outline" onPress={() => navigation.navigate('Provider', { providerId: link.providerId })} last /> : null}
      {received && link.status === 'INVITED' ? <BaitlyButton title={t('acceptInvitation')} disabled={demo || busy || !isConnected}
        onPress={() => { void act(() => networkApi.accept(link.id)); }} /> : null}
      {!demo && link.status !== 'REVOKED' && (received || capabilities.data?.canManagePrivateNetwork) ?
        <BaitlyButton secondary title={t('removeNetwork')} disabled={busy || !isConnected} onPress={() => remove(link)} /> : null}
      {!demo && !received && capabilities.data?.canManagePrivateNetwork && ['EXPIRED', 'REVOKED'].includes(link.status) ?
        <BaitlyButton secondary title={t('renewInvitation')} disabled={busy || !isConnected}
          onPress={() => { void act(async () => { const invitation = await networkApi.invite(link.providerId); await Share.share({ message: invitation.url }); }); }} /> : null}
    </View>)}</AccountGroup>
    {result.data && !result.data.pages.some(p => p.content.length) ? <BaitlyEmpty title={t('emptyNetwork')} message={t('emptyNetworkHelp')} /> : null}
    {result.hasNextPage ? <BaitlyButton title={t('loadMore')} secondary busy={result.isFetchingNextPage}
      onPress={() => { void result.fetchNextPage(); }} /> : null}
    {!demo ? <BaitlyButton secondary title={t('verify')} onPress={() => { void Promise.allSettled([result.refetch(), members.refetch()]); }} busy={result.isFetching} /> : null}
  </BaitlyScreen>;
}
const styles = StyleSheet.create({
  flex: { flex: 1 }, intro: { flexDirection: 'row', alignItems: 'center', gap: 12 }, title: { fontSize: 26, lineHeight: 32, fontWeight: '600', marginBottom: 5 }, illustration: { width: 72, height: 85 },
  tabs: { flexDirection: 'row', gap: 4 }, tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingHorizontal: 8 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 }, avatar: { width: 44, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, initial: { fontSize: 21, fontWeight: '600' }, name: { fontSize: 16, lineHeight: 22, fontWeight: '600' }, invitation: { padding: 16, gap: 8 },
});
