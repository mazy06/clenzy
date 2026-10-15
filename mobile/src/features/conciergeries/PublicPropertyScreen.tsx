import React, { useLayoutEffect } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { BaitlyButton, BaitlyEmpty, BaitlyLoading, BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import { PropertyGallery } from '@/features/marketplace/PublicClientProfileScreen';
import { PublicAvatar } from '@/features/marketplace/PublicAvatar';
import { BaitlyProviderRating } from '@/features/marketplace/BaitlyProviderRating';
import { guestReviewSummary } from '@/features/marketplace/baitlyDemoClients';
import { usePublicProfile } from './publicProfiles';

/** Public profile API only: private PMS property endpoints are never used here. */
export function PublicPropertyScreen({ route, navigation }: NativeStackScreenProps<BaitlyStackParams, 'PublicProperty'>) {
  const { t, i18n } = useTranslation('mobileV1');
  const colors = useBaitlyTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const profile = usePublicProfile(route.params.clientProfileId);
  useLayoutEffect(() => { navigation.setOptions({ headerTitle: '', headerTransparent: true,
    headerStyle: { backgroundColor: 'transparent' } }); }, [navigation]);
  const client = profile.data;
  const property = client?.properties.find(home => home.id === route.params.propertyId);
  if (profile.isPending) return <BaitlyLoading />;
  if (profile.isError) return <BaitlyEmpty title={t('loadFailed')} retry={() => { void profile.refetch(); }} />;
  if (!client || !property) return <BaitlyEmpty title={t('publicPropertyUnavailable')} />;
  const rating = guestReviewSummary([property]);
  const row = { flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' as const : 'row' as const };
  const facts = [
    { icon: 'people-outline' as const, value: property.guests, label: 'publicHomeGuests' },
    { icon: 'bed-outline' as const, value: property.bedrooms, label: 'publicHomeBedrooms' },
    { icon: 'water-outline' as const, value: property.bathrooms, label: 'publicHomeBathrooms' },
    { icon: 'resize-outline' as const, value: property.areaM2, label: 'publicHomeArea' },
  ].filter(fact => fact.value != null);
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <PropertyGallery property={property} demo={client.demo} height={Math.min(height * 0.46, 420)} edgeToEdge />
      <View style={styles.content}>
        <View style={styles.title}>
          <BaitlyText variant="title" accessibilityRole="header">{property.name}</BaitlyText>
          <View style={[row, styles.rating]}>
            <BaitlyText muted>{property.city}</BaitlyText>
            <BaitlyProviderRating average={rating.average} count={rating.count} compact />
          </View>
          <BaitlyText variant="meta" muted>{t('publicMapApproximate')}</BaitlyText>
          {client.demo ? <BaitlyText variant="meta" muted>{t('directoryDemo')}</BaitlyText> : null}
        </View>
        {facts.length ? <View style={[styles.facts, row, { borderColor: colors.border }]}>{facts.map(fact => <View key={fact.label} style={styles.fact}>
          <Reicon name={fact.icon} size={22} color={colors.primary} />
          <BaitlyText style={styles.number}>{fact.value}{fact.label === 'publicHomeArea' ? ' m²' : ''}</BaitlyText>
          <BaitlyText muted variant="meta">{t(fact.label)}</BaitlyText>
        </View>)}</View> : null}
        {property.description ? <BaitlyText>{property.description}</BaitlyText> : null}
        {property.amenities.length ? <View style={[styles.amenities, row]}>{property.amenities.map(amenity =>
          <BaitlyText key={amenity} variant="meta" style={[styles.amenity, { backgroundColor: colors.muted }]}>{t(`publicAmenity${amenity}`, { defaultValue: amenity })}</BaitlyText>)}</View> : null}
        {property.guestReviews.length ? <View style={styles.reviews}>
          <BaitlyText variant="heading" accessibilityRole="header">{t('publicGuestReviews')}</BaitlyText>
          {property.guestReviews.map(review => <View key={review.id} style={[styles.review, { borderBottomColor: colors.border }]}>
            <View style={[styles.identity, row]}>
              <PublicAvatar demo={client.demo} portraitIndex={review.portraitIndex} avatarUrl={review.avatarUrl} size={38} />
              <View style={{ flex: 1 }}><BaitlyText>{review.name}</BaitlyText><BaitlyText variant="meta" muted>{review.date}</BaitlyText></View>
              <BaitlyProviderRating average={review.rating} count={1} compact />
            </View>
            <BaitlyText>{review.comment}</BaitlyText>
          </View>)}
        </View> : null}
        <BaitlyButton secondary title={client.organization ?? client.name}
          onPress={() => navigation.navigate('PublicClientProfile', { clientProfileId: client.id })} />
      </View>
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: 20, gap: 22 }, title: { gap: 8 },
  rating: { alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  facts: { justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingVertical: 18, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  fact: { alignItems: 'center', gap: 5 }, number: { fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  amenities: { flexWrap: 'wrap', gap: 8 }, amenity: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  reviews: { gap: 16 }, review: { gap: 10, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth }, identity: { alignItems: 'center', gap: 10 },
});
