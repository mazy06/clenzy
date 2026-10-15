import React, { memo, useEffect, useId, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Mask, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useBaitlyTheme } from '@/design-system/theme';
import { BaitlyText } from '@/design-system/components';
import { physicalTabIndex, type BaitlyArtwork } from './baitlyNavigationModel';
import { useBaitlyReducedMotion } from './useBaitlyMotion';
import { Reicon } from '@/icons';

const images = {
  marketplace: require('../../assets/baitly/navigation/baitly-marketplace.png'),
  properties: require('../../assets/baitly/navigation/baitly-properties.png'),
  tracking: require('../../assets/baitly/navigation/baitly-tracking.png'),
  account: require('../../assets/baitly/navigation/baitly-account.png'),
  today: require('../../assets/baitly/navigation/baitly-today.png'),
  home: require('../../assets/baitly/sectors/sector-concierge.webp'),
  missions: require('../../assets/baitly/navigation/baitly-missions.png'),
  network: require('../../assets/baitly/navigation/baitly-network.png'),
  messages: require('../../assets/baitly/navigation/baitly-messages.png'),
};
const defaultArtwork: Record<string, BaitlyArtwork> = {
  Marketplace: 'marketplace', Properties: 'properties', Tracking: 'tracking', Profile: 'account', Today: 'today', Reels: 'reels',
  Planning: 'today', Calendar: 'today', Interventions: 'missions', Tickets: 'missions', Teams: 'network',
  Messages: 'messages', Messaging: 'messages', History: 'tracking', Dashboard: 'today', More: 'account',
};
const motion = { duration: 280, easing: Easing.out(Easing.poly(4)) };
const dockHeight = 64;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const MenuImage = memo(function MenuImage({ artwork, focused, reduced }: { artwork: BaitlyArtwork; focused: boolean; reduced: boolean }) {
  const progress = useSharedValue(focused ? 1 : 0);
  useEffect(() => { progress.value = reduced ? Number(focused) : withTiming(Number(focused), motion); }, [focused, reduced, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.68 + progress.value * 0.32,
    transform: [{ translateY: -10 * progress.value }, { scale: 0.86 + 0.22 * progress.value },
      { rotate: `${-4 * Math.sin(Math.PI * progress.value)}deg` }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.image, style]}>
    {artwork === 'reels' ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Reicon name="play-circle-outline" size={34} color="#D4B98B" /></View>
      : <Image source={images[artwork]} contentFit="contain" style={StyleSheet.absoluteFill} accessible={false} cachePolicy="memory-disk" enforceEarlyResizing />}
  </Animated.View>;
});

/** One bar for all workspaces, with a moving transparent cutout behind the selected image. */
export function BaitlyTabBar({ state, descriptors, navigation, insets, artwork = {} }: BottomTabBarProps & {
  artwork?: Partial<Record<string, BaitlyArtwork>>;
}) {
  const colors = useBaitlyTheme();
  const { i18n } = useTranslation();
  const rtl = i18n.dir() === 'rtl';
  const reduced = useBaitlyReducedMotion();
  const [width, setWidth] = useState(0);
  const initialized = useRef(false);
  const maskId = `baitly-dock-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const center = useSharedValue(0);
  const position = physicalTabIndex(state.index, state.routes.length, rtl);
  useEffect(() => {
    const target = width / state.routes.length * (position + 0.5);
    center.value = reduced || !initialized.current ? target : withTiming(target, motion);
    if (width > 0) initialized.current = true;
  }, [position, width, state.routes.length, reduced, center]);
  const cutout = useAnimatedProps(() => ({ cx: center.value }));
  const [keyboard, setKeyboard] = useState(Keyboard.isVisible());
  const [focusedKey, setFocusedKey] = useState<string>();
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  if (keyboard) return null;
  const routes = rtl ? [...state.routes].reverse() : state.routes;
  const tabStyle = StyleSheet.flatten(descriptors[state.routes[state.index].key].options.tabBarStyle);
  const floating = tabStyle && typeof tabStyle === 'object' && 'position' in tabStyle && tabStyle.position === 'absolute';
  return <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 8) + 2,
    ...(floating ? { position: 'absolute', bottom: 0, left: 0, right: 0 } : {}),
    paddingLeft: Math.max(insets.left, 20), paddingRight: Math.max(insets.right, 20) }]}>
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.bar}>
      {width > 0 ? <Svg width={width} height={dockHeight} style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
        <Defs><Mask id={maskId} x={0} y={0} width={width} height={dockHeight} maskUnits="userSpaceOnUse">
          <Rect width={width} height={dockHeight} fill="white" />
          <AnimatedCircle animatedProps={cutout} cy={11} r={27} fill="black" />
        </Mask></Defs>
        <Rect x={0.5} y={0.5} width={width - 1} height={dockHeight - 1} rx={22} fill="#1B2A35" stroke="#344958" mask={`url(#${maskId})`} />
      </Svg> : null}
      <View style={styles.slots}>
        {routes.map(route => {
          const { options } = descriptors[route.key];
          const selected = state.routes[state.index].key === route.key;
          const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name;
          return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            accessibilityState={{ selected }} testID={`baitly-tab-${route.name}`}
            onFocus={() => setFocusedKey(route.key)} onBlur={() => setFocusedKey(undefined)}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!selected && !event.defaultPrevented) {
                void Haptics.selectionAsync().catch(() => {});
                navigation.navigate(route.name, route.params);
              }
            }} onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={({ pressed }) => [styles.slot, { opacity: pressed ? 0.75 : 1, borderColor: focusedKey === route.key ? '#D4B98B' : 'transparent' }]}>
            <MenuImage artwork={artwork[route.name] ?? defaultArtwork[route.name] ?? 'account'} focused={selected} reduced={reduced} />
            <BaitlyText variant="meta" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.3}
              style={[styles.label, { color: selected ? '#FBFCFD' : '#B9C8D3', fontWeight: selected ? '600' : '400' }]}>{label}</BaitlyText>
            {options.tabBarBadge !== undefined ? <View style={[styles.badge, { backgroundColor: colors.danger }]}>
              <BaitlyText variant="meta" style={[styles.badgeText, { color: colors.onPrimary }]}>{options.tabBarBadge}</BaitlyText>
            </View> : null}
          </Pressable>;
        })}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  outer: { paddingTop: 12, alignItems: 'center' },
  bar: { height: dockHeight, width: '100%', maxWidth: 620 },
  // Routes are explicitly reversed for RTL.
  slots: { flexDirection: 'row', direction: 'ltr', height: dockHeight },
  slot: { flex: 1, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'flex-end', borderWidth: 2, borderRadius: 18, paddingBottom: 6 },
  image: { position: 'absolute', top: 0, width: 40, height: 40 },
  label: { fontSize: 11, lineHeight: 14, textAlign: 'center', paddingHorizontal: 2 },
  badge: { position: 'absolute', top: 2, end: 7, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, justifyContent: 'center' },
  badgeText: { fontSize: 10, lineHeight: 14, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
