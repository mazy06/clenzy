import React, { useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTranslation } from 'react-i18next';
import { BaitlyNotice, BaitlyText } from '@/design-system/components';
import { BaitlyMapPreview } from '@/features/marketplace/BaitlyMapPreview';
import { useBaitlyTheme } from '@/design-system/theme';
import { baitlyProviderMapUrl, baitlyProviderMapPayload } from '@/features/marketplace/baitlyMapBridge';
import { validMapPosition } from '@/features/marketplace/baitlyMapDomain';
import type { MobileMission } from './api';
import { Reicon } from '@/icons';
import { Image } from 'expo-image';
import { MissionPropertyPhotos } from './MissionPropertyPhotos';
import { MissionDoorAccess } from './MissionDoorAccess';

export function missionDestination(mission: MobileMission) {
  const point = { latitude: mission.propertyLatitude!, longitude: mission.propertyLongitude! };
  return validMapPosition(point) ? `${point.latitude},${point.longitude}` : mission.propertyAddress?.trim();
}
export function MissionArrival({ mission, accessInstructions, cleaningInstructions, propertyPhotos = [] }: { mission: MobileMission; accessInstructions?: string; cleaningInstructions?: string; propertyPhotos?: string[] }) {
  const { t, i18n } = useTranslation('mobileV1'); const c = useBaitlyTheme();
  const web = useRef<WebView>(null); const [failed, setFailed] = useState(false);
  const destination = missionDestination(mission);
  const point = { latitude: mission.propertyLatitude!, longitude: mission.propertyLongitude! };
  const url = baitlyProviderMapUrl(i18n.language, c.background === '#0A1120', 'coverage');
  const open = (url: string) => { void Linking.openURL(url).catch(() => setFailed(true)); };
  const directions = () => {
    if (!destination) return;
    const encoded = encodeURIComponent(destination);
    Alert.alert(t('arrivalDirections'), undefined, [
      { text: Platform.OS === 'ios' ? 'Apple Plans' : t('arrivalMaps'), onPress: () => open(Platform.OS === 'ios' ? `https://maps.apple.com/?daddr=${encoded}&dirflg=d` : `geo:0,0?q=${encoded}`) },
      { text: 'Google Maps', onPress: () => open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`) },
      { text: 'Waze', onPress: () => open(validMapPosition(point) ? `https://waze.com/ul?ll=${encoded}&navigate=yes` : `https://waze.com/ul?q=${encoded}&navigate=yes`) },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };
  return <View style={{ gap: 12 }}>
    <MissionDoorAccess id={mission.id}/>
    <MissionPropertyPhotos photos={propertyPhotos} demo={mission.id < 0} />
    <Pressable accessibilityRole="button" accessibilityLabel={t('arrivalDirections')} disabled={!destination} onPress={directions}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, backgroundColor: pressed ? c.muted : c.surface })}>
    <View pointerEvents="none" style={{ width: 84, height: 84, borderRadius: 12, overflow: 'hidden', backgroundColor: c.muted }}>
    {validMapPosition(point) ?
      <WebView ref={web} source={{ uri: url }} originWhitelist={[new URL(url).origin]} scrollEnabled={false} setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={request => request.url === url || request.url === 'about:blank'}
        onError={() => setFailed(true)} onHttpError={() => setFailed(true)}
        onMessage={event => {
          try { if (JSON.parse(event.nativeEvent.data).type === 'ready') {
            web.current?.injectJavaScript(`${baitlyProviderMapPayload([{ ...point, id: mission.id, radiusKm: null, zones: [] }], { map: t('arrivalTitle'), pin: mission.propertyName ?? t('properties') }, true)}window.selectBaitlyProvider?.(${mission.id});true;`);
          } } catch { /* Ignore unrelated map messages. */ }
        }} /> : <BaitlyMapPreview />}
    </View>
    <View style={{ flex: 1, gap: 4 }}><BaitlyText style={{ fontWeight: '600' }}>{t('arrivalDirections')}</BaitlyText>
      <BaitlyText muted variant="meta" numberOfLines={2}>{mission.propertyAddress || t('arrivalNoPosition')}</BaitlyText></View>
    <Reicon name="chevron-forward" size={20} color={c.secondary} />
    </Pressable>
    {[{ key: 'arrivalAccess', image: require('../../../assets/baitly/mission-steps/security.webp'), text: accessInstructions },
      { key: mission.type.includes('CLEANING') ? 'arrivalCleaning' : 'arrivalInstructions', image: mission.type.includes('CLEANING') ? require('../../../assets/baitly/mission-steps/cleaning.webp') : require('../../../assets/baitly/sectors/sector-maintenance.webp'), text: [cleaningInstructions,mission.description].filter(Boolean).join('\n') }].map(section =>
      <View key={section.key} style={{ padding: 16, borderRadius: 18, backgroundColor: c.surface, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={section.image} contentFit="contain" style={{ width: 56, height: 56 }} accessible={false} />
          <BaitlyText style={{ flex: 1, fontWeight: '600', fontSize: 17 }}>{t(section.key)}</BaitlyText>
        </View>
        <BaitlyText variant="meta" muted={!section.text}>{section.text || t('arrivalNoInstructions')}</BaitlyText>
      </View>)}
    {failed ? <BaitlyNotice error>{t('arrivalMapFailed')}</BaitlyNotice> : null}
  </View>;
}
