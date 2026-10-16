import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useBaitlyTheme } from '@/design-system/theme';
import type { ConciergeBadge } from './badges';

const images = {
  fire: require('../../../assets/baitly/concierge-badges/fire.png'),
  premium: require('../../../assets/baitly/concierge-badges/premium.png'),
  profit: require('../../../assets/baitly/concierge-badges/profit.png'),
  occupancy: require('../../../assets/baitly/concierge-badges/occupancy.png'),
  favorite: require('../../../assets/baitly/concierge-badges/favorite.png'),
  'small-homes': require('../../../assets/baitly/concierge-badges/small-homes.png'),
  'full-service': require('../../../assets/baitly/concierge-badges/full-service.png'),
  'direct-booking': require('../../../assets/baitly/concierge-badges/direct-booking.png'),
};

export function ConciergeBadges({ badges, presentation = 'card' }: { badges: ConciergeBadge[]; presentation?: 'card' | 'detail' }) {
  const { t } = useTranslation('mobileV1');
  const colors = useBaitlyTheme();
  if (!badges.length) return null;
  return <View pointerEvents="none" style={presentation === 'card' ? styles.badges : styles.detail}>
    {(presentation === 'card' ? badges.slice(0, 1) : badges).map(badge => <View key={badge} style={presentation === 'card' ? [styles.circle, { backgroundColor: colors.background }] : undefined}>
      <Image source={images[badge]} contentFit="contain" style={presentation === 'card' ? styles.image : styles.detailImage}
        enforceEarlyResizing accessible accessibilityLabel={t(`conciergeBadge_${badge}`)} />
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  badges: { position: 'absolute', top: -9, left: -9, flexDirection: 'row', alignItems: 'center' },
  circle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  image: { width: 22, height: 24 },
  detail: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  detailImage: { width: 44, height: 48 },
});
