import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import { providerRating } from './domain';
import { BaitlyProviderRating } from './BaitlyProviderRating';

export function discoveryColumns(width: number, fontScale: number) {
  return width < 360 || fontScale > 1.25 ? 1 : width >= 768 ? 3 : 2;
}

/** Shared compact discovery layout for providers, concierges and owners. */
export function BaitlyDiscoveryCard({ id, title, city, photo, average = null, count = 0, verified, subtitle, homesCount, footer, footerLabel, footerDisabled, imageOverlay, onOpen, onFooterPress }: {
  id: string | number; title: string; city?: string | null; photo?: string | ImageSource | number | null;
  average?: number | null; count?: number; verified?: boolean; subtitle?: string | null;
  footer: React.ReactNode; footerLabel?: string; footerDisabled?: boolean; onOpen: () => void; onFooterPress?: () => void;
  imageOverlay?: React.ReactNode;
  homesCount?: number;
}) {
  const colors = useBaitlyTheme();
  const { t, i18n } = useTranslation('mobileV1');
  const rtl = i18n.dir() === 'rtl';
  const [focused, setFocused] = useState(false);
  const rating = providerRating(average, count);
  const reviewLabel = count ? t('providerReviewCount', { count }) : t('providerNoReviews');
  const initials = title.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  return <Pressable accessibilityRole="button" accessibilityLabel={[title, city,
    rating == null ? reviewLabel : `${rating}/5, ${reviewLabel}`].filter(Boolean).join(', ')} onPress={() => onOpen()}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [styles.provider, { backgroundColor: pressed ? colors.muted : colors.surface,
      borderColor: focused ? colors.primary : colors.border }]}>
    <View style={styles.cardContent}>
    <View>{photo ? <Image source={photo} contentFit="cover" style={styles.avatar} accessible={false} recyclingKey={String(id)} />
      : <View style={[styles.avatar, styles.monogram, { backgroundColor: colors.muted }]}>
        <BaitlyText style={styles.initials}>{initials}</BaitlyText>
        <View style={[styles.monogramLine, { backgroundColor: colors.secondary }]} />
      </View>}
    <View style={[styles.ratingBadge, { backgroundColor: colors.surface }]}>
      <BaitlyProviderRating average={average} count={count} compact />
    </View>
    </View>
    <View style={styles.providerText}>
      <View style={[styles.nameRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <BaitlyText style={styles.name} numberOfLines={2}>{title}</BaitlyText>
        {verified ? <Reicon name="checkmark-circle" color={colors.success} size={17} /> : null}
      </View>
      {city ? <View style={[styles.location, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <Reicon name="location-outline" color={colors.secondary} size={14} />
        <BaitlyText variant="meta" muted numberOfLines={1} style={styles.city}>{city}</BaitlyText>
      </View> : null}
      {homesCount != null ? <View style={[styles.homes, styles.details, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <Reicon name="home-outline" size={14} color={colors.secondary} />
        <BaitlyText variant="meta" muted style={styles.homeCount}>{t('directoryHomes', { count: homesCount })}</BaitlyText>
      </View> : null}
      {subtitle ? <BaitlyText variant="meta" numberOfLines={2} style={[styles.specialty, styles.details]}>{subtitle}</BaitlyText> : null}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={footerLabel} disabled={footerDisabled} onPress={event => { event.stopPropagation(); (onFooterPress ?? onOpen)(); }} style={[styles.priceRow, { flexDirection: rtl ? 'row-reverse' : 'row', backgroundColor: colors.muted }]}>
      <View style={styles.footerContent}>{footer}</View>
      <Reicon name={rtl ? 'arrow-back' : 'arrow-forward'} color={colors.ink} size={14} />
    </Pressable>
    </View>
    {imageOverlay}
  </Pressable>;
}

const styles = StyleSheet.create({
  provider: { flex: 1, borderRadius: 14, borderWidth: 1, marginHorizontal: 6, marginBottom: 14 },
  cardContent: { flex: 1, overflow: 'hidden', borderRadius: 13 },
  avatar: { width: '100%', aspectRatio: 1.8 },
  ratingBadge: { position: 'absolute', top: 7, end: 7, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  monogram: { alignItems: 'center', justifyContent: 'center', gap: 9 },
  initials: { fontSize: 27, lineHeight: 32, fontWeight: '500', letterSpacing: -1 },
  monogramLine: { height: 1, width: 20, opacity: 0.5 },
  providerText: { flex: 1, paddingHorizontal: 10, paddingTop: 9, paddingBottom: 9 },
  nameRow: { alignItems: 'center', gap: 4 },
  details: { alignItems: 'center', gap: 7, marginTop: 5 },
  homes: { alignItems: 'center', gap: 3 },
  homeCount: { fontSize: 12, lineHeight: 17, fontVariant: ['tabular-nums'] },
  specialty: { fontSize: 13, lineHeight: 18 },
  name: { flex: 1, fontSize: 16, lineHeight: 21, fontWeight: '600', letterSpacing: -0.3 },
  location: { alignItems: 'center', gap: 4, marginTop: 3 },
  city: { flex: 1, fontSize: 12, lineHeight: 17 },
  priceRow: { alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, minHeight: 42 },
  footerContent: { flex: 1 },
});
