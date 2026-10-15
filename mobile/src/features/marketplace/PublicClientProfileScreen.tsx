import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { BaitlyButton, BaitlyEmpty, BaitlyField, BaitlyLoading, BaitlyNotice, BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { useBaitlyReducedMotion } from '@/navigation/useBaitlyMotion';
import { Reicon } from '@/icons';
import { PublicAvatar } from './PublicAvatar';
import { BaitlyProviderRating } from './BaitlyProviderRating';
import { baitlyDemoPhoto } from './baitlyDemoPhotos';
import { guestReviewSummary, publicPortfolioPerformance } from './baitlyDemoClients';
import { publicProfilesApi, usePublicProfile, type PublicProperty } from '@/features/conciergeries/publicProfiles';
import { useAuthStore } from '@/store/authStore';
import { demoConciergeBadges } from '@/features/conciergeries/badges';
import { ConciergeBadges } from '@/features/conciergeries/ConciergeBadges';
import { FinancialPerformancePanel } from '@/features/conciergeries/FinancialPerformancePanel';
import { publicPropertyPhotos } from '@/features/conciergeries/publicPropertyPhotos';

const profileArt = {
  occupancy: require('../../../assets/baitly/public-profiles/occupancy.webp'),
  rating: require('../../../assets/baitly/public-profiles/rating.webp'),
  property: require('../../../assets/baitly/public-profiles/property.webp'),
  contract: require('../../../assets/baitly/public-profiles/contract.webp'),
  calendar: require('../../../assets/baitly/public-profiles/calendar.webp'),
  welcome: require('../../../assets/baitly/public-profiles/welcome.webp'),
  distribution: require('../../../assets/baitly/public-profiles/distribution.webp'),
  report: require('../../../assets/baitly/public-profiles/report.webp'),
};
const managementArt: Record<string, number> = {
  LISTINGS: profileArt.distribution, PRICING: profileArt.calendar, GUESTS: profileArt.welcome,
  CLEANING: require('../../../assets/baitly/sectors/cleaning.webp'),
  MAINTENANCE: require('../../../assets/baitly/sectors/sector-maintenance.webp'), OWNER_REPORTING: profileArt.report,
};

export function PropertyGallery({ property, demo, height = 210, edgeToEdge = false }: { property: PublicProperty; demo: boolean; height?: number; edgeToEdge?: boolean }) {
  const colors = useBaitlyTheme();
  const { t } = useTranslation('mobileV1');
  const reduced = useBaitlyReducedMotion();
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const photos = publicPropertyPhotos(property, demo);
  const go = (next: number) => { setPage(next); scroll.current?.scrollTo({ x: width * next, animated: !reduced }); };
  return <View style={[styles.gallery, { backgroundColor: colors.muted, height, borderRadius: edgeToEdge ? 0 : 12 }]} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {width > 0 ? <ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
      style={styles.galleryScroll} onMomentumScrollEnd={event => setPage(Math.max(0, Math.min(photos.length - 1, Math.round(Math.abs(event.nativeEvent.contentOffset.x) / width))))}>
      {photos.map((source, index) => <Image key={index} source={source} contentFit="cover" style={{ width, height }}
        accessibilityLabel={t('propertyPhoto', { name: property.name, count: index + 1 })} />)}
    </ScrollView> : null}
    {photos.length > 0 ? <View style={[styles.photoCount, { backgroundColor: colors.surface }]}><BaitlyText style={styles.meta}>{page + 1}/{photos.length}</BaitlyText></View> : null}
    {page > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={t('previousPropertyPhoto')} onPress={() => go(page - 1)}
      style={[styles.photoArrow, styles.previousPhoto, { backgroundColor: colors.surface }]}><Reicon name="chevron-back" size={20} color={colors.ink} /></Pressable> : null}
    {page + 1 < photos.length ? <Pressable accessibilityRole="button" accessibilityLabel={t('nextPropertyPhoto')} onPress={() => go(page + 1)}
      style={[styles.photoArrow, styles.nextPhoto, { backgroundColor: colors.surface }]}><Reicon name="chevron-forward" size={20} color={colors.ink} /></Pressable> : null}
  </View>;
}

export function PublicClientProfileScreen({ route, navigation }: NativeStackScreenProps<BaitlyStackParams, 'PublicClientProfile'>) {
  const { t, i18n } = useTranslation('mobileV1');
  const colors = useBaitlyTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const row = { flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' as const : 'row' as const };
  const scroll = useRef<ScrollView>(null);
  const [activeTab, setActiveTab] = useState<'performance' | 'properties' | 'management'>('performance');
  const tabsY = useRef(0);
  const contactScrolled = useRef(false);
  const managementY = useRef<number | null>(null);
  const managementFormY = useRef<number | null>(null);
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectCity, setProjectCity] = useState('');
  const [projectType, setProjectType] = useState('');
  const [projectReady, setProjectReady] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [showConditions, setShowConditions] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState(false);
  const contactLock = useRef(false);
  const authenticated = useAuthStore(s => s.isAuthenticated);
  useLayoutEffect(() => { navigation.setOptions({ headerShown: true, headerTransparent: true, headerTitle: '',
    headerStyle: { backgroundColor: 'transparent' } }); }, [navigation, colors.surface]);
  const profile = usePublicProfile(route.params.clientProfileId);
  const client = profile.data;
  useEffect(() => {
    contactScrolled.current = false;
    managementY.current = null; managementFormY.current = null;
    setProjectReady(false); setProjectCity(''); setProjectType(''); setContactMessage('');
    const contact = !!route.params.contact && !!client && (client.role === 'CONCIERGE' || client.seekingManagement);
    setProjectOpen(contact);
    setActiveTab(contact && client?.role === 'CONCIERGE' ? 'management' : 'performance');
  }, [client?.id, route.params.contact]);
  if (!client) return <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: colors.surface }]}>
    {profile.isPending ? <BaitlyLoading /> : <BaitlyEmpty title={t('publicProfileUnavailable')} retry={profile.isError ? () => { void profile.refetch(); } : undefined} />}
  </SafeAreaView>;
  const concierge = client.role === 'CONCIERGE';
  const title = concierge ? client.organization : client.name;
  const guests = guestReviewSummary(client.properties);
  const publishedPeriods = client.financialPerformance?.filter(p => p.occupancyPct != null).map(p => ({ ...p, occupancyPct: p.occupancyPct! }));
  const annualPeriods = publishedPeriods?.length ? publishedPeriods : client.annualPerformance;
  const years = annualPeriods?.map(p => p.year) ?? [...new Set(client.properties.flatMap(p => p.performance.map(period => period.year)))];
  const latestYear = Math.max(...years);
  const latestPerformance = annualPeriods?.find(p => p.year === latestYear) ?? publicPortfolioPerformance(client.properties, latestYear);
  const cover = client.demo ? baitlyDemoPhoto(concierge ? -2 : -1) : client.coverUrl ?? client.properties.flatMap(p => p.photos)[0];
  const submitContact = async () => {
    if (contactLock.current) return;
    if (client.demo) { setProjectReady(true); return; }
    if (!authenticated) { navigation.navigate('Login'); return; }
    contactLock.current = true; setContactBusy(true); setContactError(false);
    try {
      await publicProfilesApi.contact(client.id, concierge ? `${projectCity.trim()} · ${projectType.trim()}` : contactMessage.trim());
      setProjectReady(true);
    } catch { setContactError(true); }
    finally { contactLock.current = false; setContactBusy(false); }
  };
  const badges = demoConciergeBadges(client);
  const percent = (value: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(value);
  const selectTab = (key: typeof activeTab) => {
    setActiveTab(key);
    scroll.current?.scrollTo({ y: Math.max(0, tabsY.current - headerHeight), animated: false });
  };
  const showContact = (y: number) => {
    if (contactScrolled.current) return;
    contactScrolled.current = true;
    scroll.current?.scrollTo({ y: Math.max(0, y - headerHeight), animated: false });
  };
  return <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: colors.surface }]}>
    <ScrollView ref={scroll} contentInsetAdjustmentBehavior="never" contentContainerStyle={styles.content}>
      <View style={[styles.cover, { height: 230 + headerHeight }]}>
        {cover ? <Image source={cover} contentFit="cover" style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.muted }]} />}
        <View style={[styles.coverTag, { backgroundColor: colors.surface }]}><BaitlyText style={styles.meta}>{client.city}{client.demo ? ` · ${t('demoProfile')}` : ''}</BaitlyText></View>
      </View>
      <View style={[styles.identity, row, { backgroundColor: colors.surface }]}>
        <PublicAvatar demo={client.demo} portraitIndex={client.portraitIndex} avatarUrl={client.avatarUrl} size={68} />
        <View style={styles.identityCopy}><BaitlyText style={styles.name} accessibilityRole="header">{title}</BaitlyText>
          <ConciergeBadges badges={badges} presentation="detail" />
          <BaitlyText muted style={styles.meta}>{concierge ? client.name : t('reviewOwner')} · {client.city}</BaitlyText>
        </View>
      </View>
      <View onLayout={event => { tabsY.current = event.nativeEvent.layout.y; }} style={[styles.shortcuts, row, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        {(['performance', 'properties', ...(concierge ? ['management' as const] : [])] as const).map(key => <Pressable key={key}
          accessibilityRole="tab" accessibilityState={{ selected: activeTab === key }} onPress={() => selectTab(key)}
          style={[styles.shortcut, { borderBottomColor: activeTab === key ? colors.ink : 'transparent' }]}>
          <BaitlyText style={styles.shortcutText}>{t(key === 'performance' ? 'publicProfilePerformance' : key === 'properties' ? 'publicPortfolio' : 'publicManagement')}</BaitlyText>
        </Pressable>)}
      </View>
      {!concierge && projectOpen && client.seekingManagement ? <View style={styles.project} onLayout={event => showContact(event.nativeEvent.layout.y)}>
        <BaitlyText variant="heading">{t('directoryContactOwner')}</BaitlyText>
        <BaitlyField label={t('directoryContactMessage')} value={contactMessage} onChangeText={setContactMessage} multiline />
        {contactError ? <BaitlyNotice error>{t('sendFailed')}</BaitlyNotice> : null}
        {projectReady ? <BaitlyNotice>{t(client.demo ? 'publicDemoProjectReady' : 'publicContactRecorded')}</BaitlyNotice> : client.demo ? <BaitlyText muted style={styles.meta}>{t('publicDemoProjectHelp')}</BaitlyText> : null}
      </View> : null}
      {activeTab === 'performance' ? <View style={styles.section}>
        <BaitlyText variant="heading" accessibilityRole="header">{t('publicBaitlyPerformance')}</BaitlyText>
        <FinancialPerformancePanel periods={client.financialPerformance ?? []} />
        {latestPerformance ? <View style={[styles.occupancyFeature, row, { backgroundColor: colors.muted }]}>
          <Image source={profileArt.occupancy} contentFit="contain" style={styles.occupancyArt} />
          <View style={styles.guestCopy}><BaitlyText muted style={styles.meta}>{t('publicOccupancy')} · {latestYear}</BaitlyText>
            <BaitlyText style={styles.occupancyValue}>{percent(latestPerformance.occupancyPct)} %</BaitlyText>
            {latestPerformance.bookedNights != null && latestPerformance.calendarNights != null ? <BaitlyText muted style={styles.meta}>{t('publicBookedNights', { booked: latestPerformance.bookedNights, total: latestPerformance.calendarNights })}</BaitlyText> : null}
          </View>
        </View> : null}
        <View style={[styles.highlights, row]}>
          <View style={[styles.highlight, row]}><Image source={profileArt.property} contentFit="contain" style={styles.metricArt} />
            <View style={styles.guestCopy}><BaitlyText style={styles.bigValue}>{client.properties.length}</BaitlyText>
            <BaitlyText muted style={styles.meta}>{t(concierge ? 'publicManagedHomes' : 'publicPublishedHomes')}</BaitlyText></View></View>
          <View style={[styles.highlight, row]}><Image source={profileArt.rating} contentFit="contain" style={styles.metricArt} />
            <View style={styles.guestCopy}><BaitlyProviderRating average={guests.average} count={guests.count} compact />
            <BaitlyText muted style={styles.meta}>{t('publicGuestSatisfaction')}</BaitlyText></View></View>
        </View>
        {years.length ? <BaitlyText style={styles.body}>{t('publicOccupancy')}</BaitlyText> : <BaitlyText muted>{t('noPublishedPerformance')}</BaitlyText>}
        {years.sort((a, b) => a - b).map(year => {
          const performance = annualPeriods?.find(p => p.year === year) ?? publicPortfolioPerformance(client.properties, year);
          return performance ? <View key={year} style={styles.period}>
            <View style={[styles.metricLabels, row]}><BaitlyText muted style={styles.meta}>{year}</BaitlyText>
              <BaitlyText style={styles.value}>{percent(performance.occupancyPct)} %</BaitlyText></View>
            <View style={[styles.track, { backgroundColor: colors.muted }]}><View style={[styles.fill,
              { width: `${performance.occupancyPct}%`, backgroundColor: year === latestYear ? colors.ink : colors.secondary }]} /></View>
            {performance.bookedNights != null && performance.calendarNights != null ? <BaitlyText muted style={styles.meta}>{t('publicBookedNights', { booked: performance.bookedNights, total: performance.calendarNights })}</BaitlyText> : null}
          </View> : null;
        })}
        {client.demo ? <BaitlyText muted style={styles.meta}>{t('publicPerformanceMethod')}</BaitlyText> : null}
      </View> : null}
      {concierge && activeTab === 'management' ? <View style={styles.section} onLayout={event => {
        managementY.current = event.nativeEvent.layout.y;
        if (projectOpen && managementFormY.current != null) showContact(managementY.current + managementFormY.current);
      }}>
        <BaitlyText variant="heading" accessibilityRole="header">{t('publicManagement')}</BaitlyText>
        <View style={styles.services}>{client.managementServices.map(service => <View key={service} style={[styles.service, row]}>
          <Image source={managementArt[service]} contentFit="contain" style={styles.serviceArt} /><BaitlyText style={styles.serviceLabel}>{t(`managementService${service}`)}</BaitlyText>
        </View>)}</View>
        {client.managementFeePct != null ? <BaitlyText style={styles.value}>{t(client.demo ? 'publicManagementFee' : 'publicManagementFeeReal', { percent: client.managementFeePct })}</BaitlyText> : null}
        <View style={[styles.managementFacts, { backgroundColor: colors.muted }]}>
          <View style={[styles.metricLabels, row]}><BaitlyText muted style={styles.meta}>{t('managementArea')}</BaitlyText><BaitlyText style={styles.author}>{client.city}</BaitlyText></View>
          <View style={[styles.metricLabels, row]}><BaitlyText muted style={styles.meta}>{t('managementPortfolio')}</BaitlyText><BaitlyText style={styles.author}>{client.properties.length} {t('publicPortfolio').toLocaleLowerCase(i18n.language)}</BaitlyText></View>
          <View style={[styles.metricLabels, row]}><BaitlyText muted style={styles.meta}>{t('managementContact')}</BaitlyText><BaitlyText style={styles.author}>{client.name}</BaitlyText></View>
        </View>
        <BaitlyText style={styles.reviewTitle}>{t('managementStart')}</BaitlyText>
        {['Visit', 'Proposal', 'Launch'].map((step, index) => <View key={step} style={[styles.managementStep, row]}>
          <Image source={index === 0 ? profileArt.property : index === 1 ? profileArt.contract : profileArt.distribution} contentFit="contain" style={styles.metricArt} />
          <View style={styles.guestCopy}><BaitlyText style={styles.author}>{t(`managementStep${step}`)}</BaitlyText>
            <BaitlyText muted style={styles.meta}>{t(`managementStep${step}Help`)}</BaitlyText></View>
        </View>)}
        <BaitlyText style={styles.reviewTitle}>{t('managementOwnerTracking')}</BaitlyText>
        <BaitlyText style={styles.body}>{t('managementOwnerTrackingHelp')}</BaitlyText>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showConditions }} onPress={() => setShowConditions(value => !value)} style={[styles.conditionsToggle, row]}>
          <BaitlyText style={styles.reviewTitle}>{t('managementBeforeSigning')}</BaitlyText><View style={{ transform: [{ rotate: showConditions ? '180deg' : '0deg' }] }}><Reicon name="chevron-down" size={18} color={colors.ink} /></View>
        </Pressable>
        {showConditions ? ['Fees', 'Contract', 'Insurance'].map(key => <View key={key} style={[styles.conditionsRow, { borderBottomColor: colors.border }]}>
          <BaitlyText style={styles.author}>{t(`managementCheck${key}`)}</BaitlyText>
          <BaitlyText muted style={styles.meta}>{t(`managementCheck${key}Help`)}</BaitlyText>
        </View>) : null}
        {projectOpen ? <View style={styles.project} onLayout={event => {
          managementFormY.current = event.nativeEvent.layout.y;
          if (managementY.current != null) showContact(managementY.current + managementFormY.current);
        }}>
          <BaitlyField label={t('publicPropertyCity')} value={projectCity} onChangeText={setProjectCity} />
          <BaitlyField label={t('publicPropertyType')} value={projectType} onChangeText={setProjectType} />
          <BaitlyButton title={t(client.demo ? 'publicPrepareProject' : 'publicSendContact')} busy={contactBusy} disabled={projectReady || !projectCity.trim() || !projectType.trim()}
            onPress={() => { void submitContact(); }} />
          {contactError ? <BaitlyNotice error>{t('sendFailed')}</BaitlyNotice> : null}
          {projectReady ? <BaitlyNotice>{t(client.demo ? 'publicDemoProjectReady' : 'publicContactRecorded')}</BaitlyNotice> : client.demo ? <BaitlyText muted style={styles.meta}>{t('publicDemoProjectHelp')}</BaitlyText> : null}
        </View> : null}
      </View> : null}
      {activeTab === 'properties' ? <View style={styles.section}>
        <View style={[styles.guestIdentity, row]}><Image source={profileArt.property} contentFit="contain" style={styles.metricArt} /><BaitlyText variant="heading" accessibilityRole="header">{t('publicPortfolio')}</BaitlyText></View>
        {client.bookingDomain ? <Pressable disabled={client.demo} accessibilityRole="link" onPress={() => { if (/^https:\/\//.test(client.bookingDomain)) void Linking.openURL(client.bookingDomain); }} style={[styles.bookingSite, row, { borderColor: colors.border }]}>
          <View style={[styles.sitePreview, { backgroundColor: colors.muted }]} accessibilityElementsHidden>
            <View style={styles.browserBar}>{[0, 1, 2].map(dot => <View key={dot} style={[styles.browserDot, { backgroundColor: colors.secondary }]} />)}</View>
            {cover ? <Image source={cover} contentFit="cover" style={styles.sitePhoto} /> : null}
            <View style={styles.previewLines}><View style={[styles.previewLine, { backgroundColor: colors.secondary }]} /><View style={[styles.previewLineShort, { backgroundColor: colors.border }]} /></View>
          </View>
          <View style={styles.siteCopy}>
            <View style={[styles.siteHeading, row]}><Reicon name="globe-outline" size={17} color={colors.ink} /><BaitlyText style={styles.author}>{t('publicBookingSite')}</BaitlyText></View>
            <BaitlyText style={styles.siteTitle}>{t('publicBookingInvitation')}</BaitlyText>
            <BaitlyText muted style={styles.siteDomain} numberOfLines={1}>{client.bookingDomain}</BaitlyText>
            {client.demo ? <BaitlyText muted style={styles.meta}>{t('publicDemoSite')}</BaitlyText> : null}
          </View>
        </Pressable> : null}
        {client.properties.map(property => {
          const rating = guestReviewSummary([property]);
          return <View key={property.id} style={[styles.property, { borderBottomColor: colors.border }]}>
            <PropertyGallery property={property} demo={client.demo} />
            <BaitlyText variant="heading" accessibilityRole="header">{property.name}</BaitlyText>
            <View style={[styles.metricLabels, row]}><BaitlyText muted style={styles.meta}>{property.city}</BaitlyText>
              <BaitlyProviderRating average={rating.average} count={rating.count} compact /></View>
            {property.guests != null && property.bedrooms != null && property.bathrooms != null && property.areaM2 != null ? <BaitlyText style={styles.body}>{t('publicHomeCapacity', { guests: property.guests, bedrooms: property.bedrooms, bathrooms: property.bathrooms, area: property.areaM2 })}</BaitlyText> : null}
            <View style={[styles.amenities, row]}>{property.amenities.map(amenity => <BaitlyText key={amenity} muted style={styles.meta}>{t(`publicAmenity${amenity}`)}</BaitlyText>)}</View>
            <BaitlyText style={styles.reviewTitle}>{t('publicGuestReviews')}</BaitlyText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewRail}>{property.guestReviews.map(review => <View key={review.id} style={[styles.guestReview, { backgroundColor: colors.background }]}>
              <View style={[styles.guestIdentity, row]}>
                <PublicAvatar demo={client.demo} portraitIndex={review.portraitIndex} avatarUrl={review.avatarUrl} size={36} />
                <View style={styles.guestCopy}><BaitlyText style={styles.author}>{review.name}</BaitlyText>
                  <BaitlyText muted style={styles.meta}>{new Intl.DateTimeFormat(i18n.language, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${review.date}T12:00:00Z`))}</BaitlyText></View>
                <BaitlyProviderRating average={review.rating} count={1} compact /></View>
              <BaitlyText style={styles.body}>{review.comment}</BaitlyText>
            </View>)}</ScrollView>
          </View>;
        })}
      </View> : null}
    </ScrollView>
    {concierge || client.seekingManagement ? <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <BaitlyButton title={t(concierge ? 'publicEntrustProperty' : 'directoryContactOwner')}
        busy={!concierge && contactBusy} disabled={!concierge && projectOpen && (projectReady || !contactMessage.trim())}
        onPress={() => {
          if (!concierge && projectOpen) { void submitContact(); return; }
          contactScrolled.current = false; selectTab(concierge ? 'management' : 'performance'); setProjectOpen(true); setProjectReady(false);
        }} />
    </View> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: 20, paddingTop: 0, paddingBottom: 40, gap: 18 },
  cover: { height: 250, marginHorizontal: -20 }, coverTag: { position: 'absolute', bottom: 18, end: 20, padding: 8, borderRadius: 8 },
  identity: { alignItems: 'center', gap: 14, marginTop: -38, padding: 16, marginHorizontal: -4, borderRadius: 20 }, identityCopy: { flex: 1, gap: 3 },
  name: { fontSize: 23, lineHeight: 29, fontWeight: '600', letterSpacing: -0.4 },
  meta: { fontSize: 12, lineHeight: 18, fontVariant: ['tabular-nums'] }, body: { fontSize: 14, lineHeight: 21 },
  shortcuts: { borderBottomWidth: StyleSheet.hairlineWidth, gap: 20 }, shortcut: { minHeight: 48, justifyContent: 'center', borderBottomWidth: 2 },
  footer: { paddingTop: 12, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth },
  guestIdentity: { alignItems: 'center', gap: 8 }, guestCopy: { flex: 1 },
  managementFacts: { padding: 14, gap: 12, borderRadius: 10 }, managementStep: { gap: 14, alignItems: 'flex-start', paddingVertical: 4 },
  stepNumber: { fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums'] }, conditionsRow: { gap: 4, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  shortcutText: { fontSize: 14, lineHeight: 20, fontWeight: '500' }, section: { gap: 12, marginTop: 8 },
  metric: { alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  value: { fontSize: 16, lineHeight: 22, fontWeight: '600', fontVariant: ['tabular-nums'] },
  highlights: { gap: 24, alignItems: 'center', paddingVertical: 4 }, highlight: { flex: 1, gap: 4 },
  bigValue: { fontSize: 30, lineHeight: 36, fontWeight: '500', fontVariant: ['tabular-nums'] },
  occupancyFeature: { padding: 16, borderRadius: 16, alignItems: 'center', gap: 14 }, occupancyArt: { width: 100, height: 104 },
  occupancyValue: { fontSize: 36, lineHeight: 44, fontWeight: '500', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  metricArt: { width: 42, height: 46 }, serviceArt: { width: 48, height: 52 }, serviceLabel: { flex: 1, fontSize: 13, lineHeight: 19 },
  conditionsToggle: { alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  metricLabels: { alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }, period: { gap: 5 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' }, fill: { height: '100%', borderRadius: 3 },
  services: { gap: 12, flexDirection: 'row', flexWrap: 'wrap' }, service: { alignItems: 'center', gap: 8, width: '47%' }, project: { gap: 12 },
  bookingSite: { padding: 12, gap: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  sitePreview: { width: 96, borderRadius: 7, overflow: 'hidden' }, browserBar: { height: 14, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6 },
  browserDot: { height: 3, width: 3, borderRadius: 2 }, sitePhoto: { width: 96, height: 65 }, previewLines: { padding: 7, gap: 4 },
  previewLine: { height: 3, width: '70%', borderRadius: 2 }, previewLineShort: { height: 3, width: '45%', borderRadius: 2 },
  siteCopy: { flex: 1, gap: 5 }, siteHeading: { alignItems: 'center', gap: 6 }, siteTitle: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  siteDomain: { fontSize: 12, lineHeight: 18 },
  property: { gap: 10, paddingBottom: 24, marginTop: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  gallery: { height: 210, borderRadius: 12, overflow: 'hidden' }, galleryScroll: { direction: 'ltr' },
  photoCount: { position: 'absolute', top: 10, end: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  photoArrow: { position: 'absolute', bottom: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  previousPhoto: { left: 10 }, nextPhoto: { right: 10 },
  amenities: { flexWrap: 'wrap', gap: 14 }, reviewTitle: { fontSize: 15, lineHeight: 21, fontWeight: '500', marginTop: 5 },
  reviewRail: { gap: 10 }, guestReview: { width: 260, padding: 12, gap: 5, borderRadius: 8 }, author: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
});
