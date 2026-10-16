import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, FlatList, Linking, Pressable, Share, StyleSheet, View, type ViewToken } from 'react-native';
import { WebView } from 'react-native-webview';
import { Image } from 'expo-image';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { BaitlyEmpty, BaitlyLoading, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { BaitlyHeaderAction } from '@/design-system/BaitlyHeader';
import { Reicon } from '@/icons';
import { reelPlayerHtml } from './reelPlayer';
import { type Reel, useReels } from './api';
import { ReelAuthorBar } from './ReelAuthorBar';

function ReelSlide({ reel, height, active }: { reel: Reel; height: number; active: boolean }) {
  const { t } = useTranslation('mobileV1');
  const player = useRef<WebView>(null);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const [authorBarHeight, setAuthorBarHeight] = useState(160);
  useEffect(() => { if (active) { setPaused(false); setFailed(false); } }, [active]);
  const toggle = () => { player.current?.injectJavaScript(`(()=>{const v=document.getElementById('video');${paused ? 'v.play();' : 'v.pause();'}})();true;`); setPaused(!paused); };
  const action = (icon: React.ComponentProps<typeof Reicon>['name'], label: string, onPress: () => void) =>
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.action}><Reicon name={icon} size={25} color="#FBFCFD" /></Pressable>;
  return <View style={[styles.slide, { height }]}>
    {reel.thumbnailUrl ? <Image source={reel.thumbnailUrl} contentFit="cover" style={StyleSheet.absoluteFill} accessible={false} /> : null}
    {active && reel.videoUrl && !failed ? <WebView ref={player} source={{ html: reelPlayerHtml(reel.videoUrl, true) }}
      style={styles.player} originWhitelist={['about:blank']} onShouldStartLoadWithRequest={request => request.url === 'about:blank'}
      allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} scrollEnabled={false} setSupportMultipleWindows={false}
      onError={() => setFailed(true)} onMessage={event => { if (event.nativeEvent.data === 'error') setFailed(true); if (event.nativeEvent.data === 'paused') setPaused(true); }}
      onLoadEnd={() => { if (!muted) player.current?.injectJavaScript("document.getElementById('video').muted=false;true;"); }} /> : null}
    <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={t(paused ? 'reelPlay' : 'reelPause')} onPress={toggle} />
    <View style={[styles.actions, { bottom: authorBarHeight + 12 }]}>
      {action(muted ? 'volume-mute-outline' : 'volume-high-outline', t('reelSound'), () => { player.current?.injectJavaScript(`document.getElementById('video').muted=${!muted};true;`); setMuted(!muted); })}
      {action('open-outline', t('reelOpenInstagram'), () => { void Linking.openURL(reel.permalink).catch(() => setFailed(true)); })}
      {action('share-outline', t('reelShare'), () => { void Share.share({ message: reel.permalink }).catch(() => {}); })}
    </View>
    {failed ? <View style={[styles.playbackError, { bottom: authorBarHeight + 12 }]}>
      <BaitlyText style={styles.copy}>{t('reelPlaybackFailed')}</BaitlyText>
    </View> : null}
    <ReelAuthorBar reel={reel} onLayout={event => setAuthorBarHeight(event.nativeEvent.layout.height)} />
    {paused && !failed ? <View pointerEvents="none" style={styles.play}><Reicon name="play-circle" size={46} color="#FBFCFD" /></View> : null}
  </View>;
}
export function ReelsScreen() {
  const { t } = useTranslation('mobileV1');
  const navigation = useNavigation<NativeStackNavigationProp<BaitlyStackParams>>();
  const authenticated = useAuthStore(state => state.isAuthenticated);
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => { const subscription = AppState.addEventListener('change', state => setForeground(state === 'active')); return () => subscription.remove(); }, []);
  const feed = useReels();
  const [height, setHeight] = useState(0);
  const [visible, setVisible] = useState<string>();
  const items = feed.data?.pages.flat() ?? [];
  const viewability = useRef({ itemVisiblePercentThreshold: 70 }).current;
  const onViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken<Reel>[] }) => {
    if (viewableItems[0]) setVisible(viewableItems[0].item.id);
  }, []);
  return <BaitlyScreen scroll={false} actions={<BaitlyHeaderAction icon="add-outline" label={t('reelPublish')}
    onPress={() => authenticated ? navigation.navigate('ReelSettings') : navigation.navigate('Login')} />}>
    {feed.isPending ? <BaitlyLoading /> : feed.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void feed.refetch(); }} />
      : !items.length ? <BaitlyEmpty title={t('reelEmpty')} /> : <View style={{ flex: 1 }} onLayout={event => setHeight(event.nativeEvent.layout.height)}>
        {height > 0 ? <FlatList key={height} data={items} keyExtractor={item => item.id} pagingEnabled showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => <ReelSlide reel={item} height={height} active={focused && foreground && (visible ? visible === item.id : index === 0)} />}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          onViewableItemsChanged={onViewable} viewabilityConfig={viewability} initialNumToRender={1} maxToRenderPerBatch={2} windowSize={3}
          onEndReached={() => { if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage(); }}
          onEndReachedThreshold={0.5} refreshing={feed.isRefetching} onRefresh={() => { void feed.refetch(); }} /> : null}
      </View>}
  </BaitlyScreen>;
}
const styles = StyleSheet.create({
  slide: { backgroundColor: '#101820' }, player: { flex: 1, backgroundColor: '#101820' },
  actions: { position: 'absolute', end: 12, gap: 14 }, action: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1B2A35D9', alignItems: 'center', justifyContent: 'center' },
  playbackError: { position: 'absolute', start: 16, end: 74, padding: 12, backgroundColor: '#101820' },
  copy: { color: '#FBFCFD', fontSize: 14 },
  play: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
