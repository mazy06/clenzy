import React, { useLayoutEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Image } from 'expo-image';
import { baitlyDemoPhoto } from './baitlyDemoPhotos';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { BaitlyButton, BaitlyEmpty, BaitlyLoading, BaitlyNotice, BaitlyText } from '@/design-system/components';
import { useProvider, useProviderReviews } from './queries';
import { BaitlyMoney } from './BaitlyMoney';
import { BaitlyProviderRating } from './BaitlyProviderRating';
import { BaitlyDemoReview } from './BaitlyDemoReview';
import { ProviderMap } from './ProviderMap';
import { BaitlyMapPreview } from './BaitlyMapPreview';
import { baitlySectorImage } from './baitlySectorImages';
import { useBaitlyReducedMotion } from '@/navigation/useBaitlyMotion';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import { networkApi } from '@/features/network/api';
import { useCapabilities } from '@/features/missions/queries';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useQueryClient } from '@tanstack/react-query';
import { useBaitlyScope } from './queries';
import { useAuthStore } from '@/store/authStore';
import { rememberRequestProvider } from '@/navigation/baitlyGuestIntent';

export function ProviderScreen({ route, navigation }: NativeStackScreenProps<BaitlyStackParams, 'Provider'>) {
  const reviews = useProviderReviews(route.params.providerId);
  const { t, i18n } = useTranslation('mobileV1');
  const colors = useBaitlyTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const headerHeight = useHeaderHeight();
  useLayoutEffect(() => { navigation.setOptions({ headerShown: true, headerTransparent: true, headerTitle: '',
    headerStyle: { backgroundColor: 'transparent' } }); }, [navigation]);
  const [footerHeight, setFooterHeight] = useState(100);
  const reducedMotion = useBaitlyReducedMotion();
  const scroll = useRef<ScrollView>(null);
  const coverageY = useRef(0);
  const reviewsY = useRef(0);
  const row = { flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' as const : 'row' as const };
  const result = useProvider(route.params.providerId);
  const p = result.data;
  const management = route.params.purpose === 'management';
  const capabilities = useCapabilities();
  const authenticated = useAuthStore(s => s.isAuthenticated);
  const { isConnected } = useNetworkStatus();
  const scope = useBaitlyScope();
  const cache = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const [invitationUrl, setInvitationUrl] = useState('');
  const [invitationError, setInvitationError] = useState(false);
  const lock = useRef(false);
  async function invite() {
    if (lock.current || !isConnected || !p) return;
    lock.current = true; setInviting(true); setInvitationError(false);
    try {
      const invitation = await networkApi.invite(p.id);
      setInvitationUrl(invitation.url);
      void cache.invalidateQueries({ queryKey: [...scope, 'network'] });
    } catch { setInvitationError(true); }
    finally { lock.current = false; setInviting(false); }
  }
  const photo = p?.demo ? baitlyDemoPhoto(p.id) : p?.avatarUrl;
  const cities = [...new Set([p?.baseCity, ...(p?.coverageCities ?? [])].filter((city): city is string => !!city?.trim()))];
  const languages = [...new Set((p?.languages ?? []).map(code => code.trim().toLowerCase()).filter(Boolean))];
  const languageNames: Record<string, string> = { fr: t('providerFrench'), ar: t('providerArabic'), en: t('providerEnglish') };
  const offers = p?.offers.filter(o => o.active) ?? [];
  return <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: colors.surface }]}>
    {result.isPending ? <View style={{ paddingTop: headerHeight }}><BaitlyLoading /></View> : null}
    {result.isError ? <View style={{ paddingTop: headerHeight }}><BaitlyEmpty title={t('loadFailed')} retry={() => { void result.refetch(); }} /></View> : null}
    {p && !result.isError ? <>
      <ScrollView ref={scroll} style={[styles.scroll, { backgroundColor: colors.surface }]}
        contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content, { paddingBottom: footerHeight + 24 }]}>
      {photo ? <View style={[styles.hero, { height: (width - insets.left - insets.right) / 1.65 + headerHeight }]}>
        <Image source={photo} contentFit="cover" style={styles.photo} accessible={false} />
        {p.demo ? <View style={[styles.demoLabel, { top: insets.top + 12, backgroundColor: colors.surface }]}>
          <BaitlyText muted style={styles.meta}>{t('demoCatalog')}</BaitlyText>
        </View> : null}
      </View> : null}
      <View style={[styles.intro, photo ? styles.introWithPhoto : { paddingTop: headerHeight + 18 }, { backgroundColor: colors.surface }]}>
        <View style={[styles.titleRow, row]}>
          <BaitlyText accessibilityRole="header" style={styles.name}>{p.displayName}</BaitlyText>
          {p.verified ? <View accessible accessibilityLabel={t('verified')}><Reicon name="checkmark-circle" size={22} color={colors.success} /></View> : null}
          {cities.length || (p.travelRadiusKm != null && p.travelRadiusKm > 0) ? <Pressable accessibilityRole="button"
            accessibilityLabel={t('providerCoverage')} onPress={() => scroll.current?.scrollTo({ y: Math.max(0, coverageY.current - headerHeight), animated: !reducedMotion })}
            style={({ pressed }) => [styles.mapShortcut, { backgroundColor: pressed ? colors.muted : colors.surface }]}>
            <BaitlyMapPreview />
          </Pressable> : null}
        </View>
        {p.headline ? <BaitlyText style={styles.headline}>{p.headline}</BaitlyText> : null}
        <View style={[styles.summary, row]}>
          {p.baseCity ? <View style={[styles.iconLine, row]}><Reicon name="location-outline" size={15} color={colors.secondary} />
            <BaitlyText muted style={styles.meta}>{p.baseCity}</BaitlyText></View> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={t('providerReviews')} hitSlop={10}
            onPress={() => scroll.current?.scrollTo({ y: Math.max(0, reviewsY.current - headerHeight), animated: !reducedMotion })}>
            <BaitlyProviderRating average={p.ratingAvg} count={p.ratingCount} />
          </Pressable>
        </View>
        {p.demo && !photo ? <BaitlyText muted style={styles.meta}>{t('demoProfile')}</BaitlyText> : null}
      </View>
      {p.bio ? <View style={styles.section}>
        <BaitlyText variant="heading" accessibilityRole="header">{t('providerAbout')}</BaitlyText>
        <BaitlyText style={styles.description}>{p.bio}</BaitlyText>
      </View> : null}
      <View style={styles.section}>
        <View style={[styles.sectionHeading, row]}>
          <BaitlyText variant="heading" accessibilityRole="header">{t('providerOffers')}</BaitlyText>
          {offers.length ? <BaitlyText muted style={styles.offerCount}>{offers.length}</BaitlyText> : null}
        </View>
        {offers.length ? offers.map(o => <View key={o.id} style={[styles.offer, { borderBottomColor: colors.border }]}>
          <View style={[styles.offerTop, row]}>
            <Image source={baitlySectorImage(o.categoryCode)} style={styles.serviceImage} contentFit="contain" accessible={false} />
            <View style={styles.offerCopy}>
              <BaitlyText style={styles.offerName}>{o.label}</BaitlyText>
              {o.description ? <BaitlyText muted style={styles.description}>{o.description}</BaitlyText> : null}
            </View>
            <View style={styles.offerPrice}>
              <BaitlyMoney amount={o.pricingModel === 'ON_QUOTE' ? null : o.amount} currency={o.currency} country={p.baseCountryCode} style={styles.money} />
              {o.pricingModel !== 'ON_QUOTE' && o.amount != null && (o.unitLabel || o.pricingModel === 'HOURLY')
                ? <BaitlyText muted style={styles.meta}>{o.unitLabel || t('providerHourly')}</BaitlyText> : null}
            </View>
          </View>
        </View>) : <BaitlyText muted style={styles.description}>{t('providerNoOffers')}</BaitlyText>}
      </View>
      {cities.length || (p.travelRadiusKm != null && p.travelRadiusKm > 0) ? <View style={styles.section}
        onLayout={event => { coverageY.current = event.nativeEvent.layout.y; }}>
        <BaitlyText variant="heading" accessibilityRole="header">{t('providerCoverage')}</BaitlyText>
        <View style={[styles.coverageMap, { backgroundColor: colors.muted }]}>
          <ProviderMap providers={[p]} mode="coverage" />
        </View>
        {cities.length ? <View style={[styles.cities, row]}>{cities.map(city => <View key={city} style={[styles.city, row, { backgroundColor: colors.muted }]}>
          <Reicon name="location-outline" size={14} color={colors.secondary} /><BaitlyText style={styles.meta}>{city}</BaitlyText>
        </View>)}</View> : null}
        {p.travelRadiusKm != null && p.travelRadiusKm > 0 ? <BaitlyText muted style={styles.description}>{t('mapRadius', { count: p.travelRadiusKm })}</BaitlyText> : null}
      </View> : null}
      {languages.length || p.acceptsUrgent ? <View style={[styles.section, styles.practical, { borderColor: colors.border }]}>
        {languages.length ? <View style={[styles.practicalRow, row]}>
          <View style={[styles.iconLine, row]}><Reicon name="language-outline" size={18} color={colors.secondary} />
            <BaitlyText muted style={styles.meta}>{t('providerLanguages')}</BaitlyText></View>
          <BaitlyText style={styles.languageValue}>{languages.map(code => languageNames[code] ?? code.toUpperCase()).join(' · ')}</BaitlyText>
        </View> : null}
        {p.acceptsUrgent ? <View style={[styles.iconLine, row]}><Reicon name="time-outline" size={18} color={colors.ink} />
          <BaitlyText style={styles.description}>{t('providerUrgent')}</BaitlyText></View> : null}
      </View> : null}
      <View style={styles.section} onLayout={event => { reviewsY.current = event.nativeEvent.layout.y; }}>
        <View style={[styles.sectionHeading, row]}>
          <BaitlyText variant="heading" accessibilityRole="header">{t('providerReviews')}</BaitlyText>
          {p.demo ? <BaitlyText muted style={styles.meta}>{t('demoCatalog')}</BaitlyText> : null}
        </View>
        {p.ratingCount ? <BaitlyProviderRating average={p.ratingAvg} count={p.ratingCount} />
          : <View style={[styles.emptyReviews, row, { backgroundColor: colors.background }]}>
            <Reicon name="star-outline" size={22} color={colors.secondary} />
            <BaitlyText muted style={styles.emptyReviewsText}>{t('providerNoReviewsDetail')}</BaitlyText>
          </View>}
        {reviews.isPending ? <BaitlyLoading /> : reviews.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void reviews.refetch(); }} />
          : reviews.data?.map(review => <BaitlyDemoReview key={review.id} review={review}
            onOpenClient={clientProfileId => navigation.navigate('PublicClientProfile', { clientProfileId })} />)}
      </View>
      {management ? <View style={styles.section}><BaitlyNotice>{t('managementConsentHelp')}</BaitlyNotice></View> : null}
      {!p.demo && capabilities.data?.canManagePrivateNetwork ? <View style={styles.section}>
        {invitationError ? <BaitlyNotice error>{t('networkActionFailed')}</BaitlyNotice> : null}
        {invitationUrl ? <BaitlyButton secondary title={t('shareInvitation')} onPress={() => { void Share.share({ message: invitationUrl }); }} />
          : <BaitlyButton secondary title={t('inviteNetwork')} busy={inviting} disabled={!isConnected} onPress={() => { void invite(); }} />}
      </View> : null}
      </ScrollView>
      <View onLayout={event => { setFooterHeight(event.nativeEvent.layout.height); }}
        style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
      {p.demo ? <BaitlyButton title={t('demoQuoteUnavailable')} disabled onPress={() => {}} />
        : p.own ? <BaitlyNotice>{t('ownProfile')}</BaitlyNotice>
        : <BaitlyButton title={t(management ? 'discussManagement' : 'requestQuote')} disabled={authenticated && !capabilities.data?.canViewOwnerSpace} onPress={() => {
          if (authenticated) navigation.navigate('CreateRequest', { providerId: p.id, purpose: route.params.purpose });
          else { rememberRequestProvider(p.id, route.params.purpose); navigation.navigate('Login'); }
        }} />}
      </View>
    </> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingBottom: 28 },
  hero: { position: 'relative' },
  photo: { width: '100%', height: '100%' },
  demoLabel: { position: 'absolute', top: 14, end: 16, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 9 },
  intro: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4, gap: 7 },
  introWithPhoto: { marginTop: -22, borderTopStartRadius: 24, borderTopEndRadius: 24 },
  titleRow: { alignItems: 'center', gap: 8 },
  mapShortcut: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  name: { flex: 1, fontSize: 26, lineHeight: 32, fontWeight: '600', letterSpacing: -0.5 },
  headline: { fontSize: 15, lineHeight: 21 },
  summary: { flexWrap: 'wrap', alignItems: 'center', gap: 16, marginTop: 3 },
  iconLine: { alignItems: 'center', gap: 5 },
  meta: { fontSize: 13, lineHeight: 19 },
  description: { fontSize: 14, lineHeight: 21 },
  section: { marginHorizontal: 20, marginTop: 24, gap: 12 },
  sectionHeading: { alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  offerCount: { fontSize: 13, fontVariant: ['tabular-nums'] },
  offer: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  offerTop: { alignItems: 'center', gap: 10 },
  serviceImage: { width: 42, height: 48 },
  offerCopy: { flex: 1, gap: 4 },
  offerName: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  offerPrice: { maxWidth: '40%', gap: 2 },
  money: { fontSize: 17, lineHeight: 22, fontWeight: '600', fontVariant: ['tabular-nums'] },
  cities: { flexWrap: 'wrap', gap: 8 },
  coverageMap: { height: 210, overflow: 'hidden', borderRadius: 16 },
  city: { alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 6 },
  practical: { paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  practicalRow: { alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  languageValue: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  emptyReviews: { alignItems: 'center', padding: 14, borderRadius: 8, gap: 12 },
  emptyReviewsText: { flex: 1, fontSize: 14, lineHeight: 20 },
  footer: { position: 'absolute', bottom: 0, start: 0, end: 0, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
