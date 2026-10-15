import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { baitlyDataMode } from '@/config/baitlyDataMode';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { BaitlyButton, BaitlyEmpty, BaitlyField, BaitlyLoading, BaitlyNotice, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import { reelsApi, useSocialSettings, type SocialSettings } from './api';

export function ReelSettingsScreen() {
  const { t } = useTranslation('mobileV1');
  const colors = useBaitlyTheme();
  const user = useAuthStore(state => state.user);
  const authenticated = useAuthStore(state => state.isAuthenticated);
  const real = baitlyDataMode() === 'real';
  const scope = useBaitlyScope();
  const queryClient = useQueryClient();
  const settings = useSocialSettings(authenticated && real);
  const [form, setForm] = useState<SocialSettings>({ displayName: '', published: false });
  const initialized = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [gridWidth, setGridWidth] = useState(0);
  const thumbnailWidth = Math.max(0, (gridWidth - 16) / 3);
  const selectionReady = useRef(false);
  useEffect(() => {
    if (settings.isSuccess && !initialized.current) {
      setForm({ ...(settings.data ?? { published: false }), displayName: settings.data?.displayName || user?.fullName?.split(' ')[0] || '' }); initialized.current = true;
    }
  }, [settings.isSuccess, settings.data, user?.fullName]);
  const connected = settings.data?.instagramConnected === true;
  const own = useQuery({ queryKey: [...scope, 'reels-own'], queryFn: reelsApi.own, enabled: authenticated && real && connected });
  useEffect(() => {
    if (own.isSuccess && !selectionReady.current) { setSelected(new Set(own.data.filter(reel => reel.published).map(reel => reel.instagramMediaId))); selectionReady.current = true; }
  }, [own.isSuccess, own.data]);
  const videos = useInfiniteQuery({ queryKey: [...scope, 'instagram-videos'], initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => reelsApi.videos(pageParam, signal), getNextPageParam: last => last.after ?? undefined,
    enabled: authenticated && real && connected });
  const items = videos.data?.pages.flatMap(page => page.items) ?? [];
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); try { await action(); } catch { setError(t('reelActionFailed')); } finally { setBusy(false); }
  };
  // Keep existing social links, without requiring manual links for Instagram OAuth.
  const saveProfile = () => reelsApi.saveSettings({ ...form,
    instagramUrl: settings.data?.instagramUrl ?? null,
    tiktokUrl: settings.data?.tiktokUrl ?? null,
    youtubeUrl: settings.data?.youtubeUrl ?? null,
  });
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: scope }); };
  const connect = () => { void run(async () => {
    const saved = await saveProfile(); setForm(saved);
    const { url } = await reelsApi.connect();
    const loginUrl = new URL(url);
    loginUrl.searchParams.set('force_reauth', 'true');
    const result = await WebBrowser.openAuthSessionAsync(loginUrl.toString(), 'clenzy://instagram-result', {
      preferEphemeralSession: true,
    });
    if (result.type === 'success' && new URL(result.url).searchParams.get('success') === '1') {
      selectionReady.current = false; await refresh();
    } else if (result.type === 'success') throw new Error('Instagram authorization failed');
  }); };
  const publish = () => { void run(async () => {
    await saveProfile();
    await reelsApi.select([...selected]);
    await refresh(); Alert.alert(t('reelSelectionSaved'));
  }); };
  if (!authenticated || !real) return <BaitlyScreen><BaitlyNotice>{t('reelRealAccount')}</BaitlyNotice></BaitlyScreen>;
  if (settings.isPending) return <BaitlyScreen><BaitlyLoading /></BaitlyScreen>;
  if (settings.isError) return <BaitlyScreen><BaitlyEmpty title={t('loadFailed')} retry={() => { void settings.refetch(); }} /></BaitlyScreen>;
  return <BaitlyScreen title={t('reelSettings')}>
    {connected ? <>
    <BaitlyField label={t('reelDisplayName')} value={form.displayName} onChangeText={displayName => setForm(previous => ({ ...previous, displayName }))} />
    <View style={[styles.visibility, { flexDirection: 'row' }]}><BaitlyText style={{ flex: 1 }}>{t('reelVisibility')}</BaitlyText>
      <Switch value={form.published} onValueChange={published => setForm(previous => ({ ...previous, published }))} accessibilityLabel={t('reelVisibility')} /></View>
    <BaitlyButton title={t('reelSaveProfile')} busy={busy} disabled={!form.displayName.trim()} onPress={() => { void run(async () => { setForm(await saveProfile()); await refresh(); }); }} />
    </> : null}
    {error ? <BaitlyNotice error>{error}</BaitlyNotice> : null}
    <View style={[styles.connection, { borderColor: colors.border }]}>
      <View style={styles.visibility}>
        <Reicon name="camera-outline" size={24} color={colors.ink} />
        <BaitlyText variant="heading" style={{ flex: 1 }}>Instagram{connected ? ` · @${settings.data?.instagramUsername}` : ''}</BaitlyText>
        {!connected && settings.data?.instagramConfigured !== false ? <Pressable
          accessibilityRole="button" accessibilityLabel={t('reelChangeInstagramAccount')}
          accessibilityState={{ disabled: busy || !form.displayName.trim() }}
          disabled={busy || !form.displayName.trim()} onPress={connect}
          style={[styles.changeAccount, { backgroundColor: colors.muted, opacity: busy ? 0.5 : 1 }]}>
          <Reicon name="log-out-outline" size={22} color={colors.ink} />
        </Pressable> : null}
      </View>
      {settings.data?.instagramConfigured === false ? <BaitlyNotice>{t('reelInstagramSetup')}</BaitlyNotice>
        : !connected ? <><BaitlyText muted>{t('reelInstagramHelp')}</BaitlyText><BaitlyButton title={t('reelConnectInstagram')} busy={busy} disabled={!form.displayName.trim()} onPress={connect} /></>
        : <>
          <BaitlyText muted>{t('reelChooseVideos')}</BaitlyText>
          {own.isError || videos.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void own.refetch(); void videos.refetch(); }} />
            : own.isPending || videos.isPending ? <BaitlyLoading /> : <View style={styles.grid}
              onLayout={({ nativeEvent }) => setGridWidth(nativeEvent.layout.width)}>
              {gridWidth > 0 ? items.map(video => <Pressable key={video.id} accessibilityRole="checkbox" accessibilityLabel={video.caption || t('reelTab')}
                accessibilityState={{ checked: selected.has(video.id) }} disabled={busy}
                onPress={() => setSelected(previous => { const next = new Set(previous); if (next.has(video.id)) next.delete(video.id); else next.add(video.id); return next; })}
                style={[styles.thumbnail, { width: thumbnailWidth, height: thumbnailWidth / 0.65,
                  backgroundColor: colors.muted, borderColor: selected.has(video.id) ? colors.primary : colors.border }]}>
                {video.thumbnailUrl ? <Image source={video.thumbnailUrl} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                <View style={[styles.check, { backgroundColor: colors.surface }]}><Reicon name={selected.has(video.id) ? 'checkbox-outline' : 'square-outline'} size={22} color={colors.ink} /></View>
              </Pressable>) : null}
            </View>}
          {videos.hasNextPage ? <BaitlyButton secondary title={t('loadMore')} busy={videos.isFetchingNextPage} onPress={() => { void videos.fetchNextPage(); }} /> : null}
          <BaitlyButton title={t('reelPublishSelection')} busy={busy} disabled={own.isPending || videos.isPending || own.isError || videos.isError} onPress={publish} />
          <BaitlyButton secondary title={t('reelDisconnectInstagram')} busy={busy} onPress={() => Alert.alert(t('reelDisconnectInstagram'), t('reelDisconnectHelp'), [
            { text: t('cancel'), style: 'cancel' }, { text: t('confirm'), style: 'destructive', onPress: () => { void run(async () => {
              await reelsApi.disconnect(); setSelected(new Set()); selectionReady.current = false; await refresh();
            }); } },
          ])} />
        </>}
    </View>
  </BaitlyScreen>;
}
const styles = StyleSheet.create({
  changeAccount: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  visibility: { alignItems: 'center', flexDirection: 'row', gap: 12 }, connection: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 20, gap: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Explicit dimensions keep absolute-positioned media visible in a wrapping scroll layout.
  thumbnail: { flexShrink: 0, borderRadius: 12, overflow: 'hidden', borderWidth: 2 },
  check: { position: 'absolute', top: 6, end: 6, borderRadius: 6, padding: 4 },
});
