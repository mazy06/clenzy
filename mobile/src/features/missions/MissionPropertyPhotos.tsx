import React, { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import { baitlyPrivateImageSource } from '@/api/baitlyMedia';

const demoImages: Record<string, number> = {
  cleaning: require('../../../assets/baitly/providers/cleaning.jpg'),
  pool: require('../../../assets/baitly/providers/pool.jpg'),
  garden: require('../../../assets/baitly/providers/garden.jpg'),
  maintenance: require('../../../assets/baitly/providers/maintenance.jpg'),
  laundry: require('../../../assets/baitly/providers/laundry.jpg'),
};
export function MissionPropertyPhotos({ photos, demo }: { photos: string[]; demo: boolean }) {
  const c = useBaitlyTheme(); const { t } = useTranslation('mobileV1'); const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState<number | null>(null); const [current, setCurrent] = useState(0);
  const sources = photos.map(photo => demo && demoImages[photo] ? demoImages[photo] : baitlyPrivateImageSource(photo));
  if (!sources.length) return null;
  return <>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {sources.map((source, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={t('missionPropertyPhoto', { index: index + 1 })}
        onPress={() => { setCurrent(index); setOpen(index); }} style={{ width: 112, height: 84, borderRadius: 14, overflow: 'hidden', backgroundColor: c.muted }}>
        <Image source={source} cachePolicy="none" contentFit="cover" style={{ width: '100%', height: '100%' }} />
        <View style={{ position: 'absolute', bottom: 5, right: 5, padding: 4, borderRadius: 6, backgroundColor: c.surface }}><Reicon name="search" size={14} color={c.ink} /></View>
      </Pressable>)}
    </ScrollView>
    <Modal visible={open !== null} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setOpen(null)}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 56, flexShrink: 0 }}>
          <BaitlyText variant="meta" style={{ fontVariant: ['tabular-nums'] }}>{current + 1}/{sources.length}</BaitlyText>
          <Pressable accessibilityRole="button" accessibilityLabel={t('missionClosePhoto')} hitSlop={8} onPress={() => setOpen(null)} style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}><Reicon name="close" size={25} color={c.ink} /></Pressable>
        </View>
        {open !== null ? <FlatList style={{ flex: 1 }} horizontal pagingEnabled data={sources} initialScrollIndex={open} keyExtractor={(_, index) => String(index)}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onMomentumScrollEnd={event => setCurrent(Math.round(event.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => <ScrollView style={{ width }} maximumZoomScale={3} minimumZoomScale={1} centerContent contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <Image source={item} cachePolicy="none" contentFit="contain" style={{ width, height: Math.max(160, height - 160) }} />
          </ScrollView>} /> : null}
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  </>;
}
