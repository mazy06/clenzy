import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import type { BusinessActionKind } from './BusinessActionsScreen';
import { Reicon } from '@/icons';
import { BusinessBars, BusinessGauge } from './BusinessCharts';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BaitlyEmpty, BaitlyLoading, BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { canUseBaitlyDemo, useBaitlyDataMode } from '@/config/baitlyDataMode';
import { businessApi, demoBusiness, payoutTotals, reportTotals, type BusinessPeriod } from './businessMetrics';

const metricArtwork: Record<string, number> = {
  revenue: require('../../../assets/baitly/sectors/sector-accounting.webp'),
  occupancy: require('../../../assets/baitly/public-profiles/occupancy.webp'),
  adr: require('../../../assets/baitly/sectors/adr.webp'),
  revpan: require('../../../assets/baitly/sectors/adr.webp'),
  margin: require('../../../assets/baitly/sectors/sector-accounting.webp'),
  fees: require('../../../assets/baitly/sectors/sector-accounting.webp'),
  costs: require('../../../assets/baitly/sectors/sector-maintenance.webp'),
  commission: require('../../../assets/baitly/sectors/sector-accounting.webp'),
  paid: require('../../../assets/baitly/sectors/sector-accounting.webp'),
  pending: require('../../../assets/baitly/navigation/baitly-tracking.png'),
  bookings: require('../../../assets/baitly/navigation/baitly-today.png'),
  homes: require('../../../assets/baitly/navigation/baitly-properties.png'),
  rating: require('../../../assets/baitly/public-profiles/rating.webp'),
  nights: require('../../../assets/baitly/public-profiles/occupancy.webp'),
  completion: require('../../../assets/baitly/mission-steps/work-review.webp'),
  today: require('../../../assets/baitly/navigation/baitly-today.png'),
  upcoming: require('../../../assets/baitly/navigation/baitly-today.png'),
  urgent: require('../../../assets/baitly/mission-steps/security.webp'),
  unpaid: require('../../../assets/baitly/navigation/baitly-tracking.png'),
};

export function ConciergeBusinessSummary() {
  const navigation = useNavigation<NativeStackNavigationProp<BaitlyStackParams>>();
  const [focusedMetric, setFocusedMetric] = useState<string | null>(null);
  const { t, i18n } = useTranslation('mobileV1'); const c = useBaitlyTheme(); const scope = useBaitlyScope();
  const { width, fontScale } = useWindowDimensions();
  const singleColumn = width < 350 || fontScale > 1.3;
  const mode = useBaitlyDataMode(state => state.mode); const demo = canUseBaitlyDemo() && mode === 'demo';
  const [period, setPeriod] = useState<BusinessPeriod>('month');
  const sample = demoBusiness(period);
  const overview = useQuery({ queryKey: [...scope, 'business-overview', period], queryFn: ({ signal }) => demo ? Promise.resolve(sample.overview) : businessApi.overview(period, signal), retry: false });
  const data = overview.data;
  const report = useQuery({ queryKey: [...scope, 'business-report', period, data?.financialContext], enabled: !!data?.financialContext,
    queryFn: async () => { const value = demo ? sample.report : await businessApi.report(data!); return { ...reportTotals(value), currency: value.currency }; }, retry: false });
  const payouts = useQuery({ queryKey: [...scope, 'business-payouts'], queryFn: ({ signal }) => demo ? Promise.resolve(sample.payouts) : businessApi.payouts(signal), retry: false });
  const numbers = (value: number, digits = 0) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: digits }).format(value);
  const money = (value: number, currency?: string) => { if (!currency) return '–'; try { return new Intl.NumberFormat(i18n.language, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value); } catch { return '–'; } };
  const row = { flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' as const : 'row' as const };
  const metric = (key: string, value: string, label?: string, detail?: string) => {
    const kind = ['urgent', 'unpaid', 'rating', 'today', 'upcoming', 'completion'].includes(key) ? key as BusinessActionKind : undefined;
    const action = kind ? () => navigation.navigate('BusinessActions', { kind }) : key === 'homes' ? () => navigation.navigate('MyProperties') : undefined;
    const content = <><View style={[styles.metricTop, row]}><BaitlyText muted variant="meta" style={{ flex: 1 }}>{label ?? t(`business.${key}`)}</BaitlyText>{key === 'occupancy' && data ? <BusinessGauge value={data.occupancyRate.value} label={t('business.occupancy')} /> : key === 'completion' && data ? <BusinessGauge value={data.interventions.completionRate} label={t('business.completion')} /> : metricArtwork[key] ? <Image source={metricArtwork[key]} style={styles.metricImage} contentFit="contain" enforceEarlyResizing accessible={false} /> : null}</View><View style={{ gap: 3 }}><BaitlyText style={styles.value}>{value}</BaitlyText>{detail ? <BaitlyText muted variant="meta" style={{ fontVariant: ['tabular-nums'] }}>{detail}</BaitlyText> : null}</View>{action ? <Reicon name={i18n.dir() === 'rtl' ? 'chevron-back' : 'chevron-forward'} size={15} color={c.secondary} style={{ position: 'absolute', bottom: 12, end: 10 }} /> : null}</>;
    const style = [styles.metric, { backgroundColor: c.surface, width: singleColumn || key.startsWith('channel.') ? '100%' as const : '48%' as const }];
    return action ? <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${label ?? t(`business.${key}`)} : ${value}`} onPress={action} onFocus={() => setFocusedMetric(key)} onBlur={() => setFocusedMetric(null)} style={({ pressed }) => [style, { backgroundColor: pressed ? c.muted : c.surface, borderWidth: 1, borderColor: focusedMetric === key ? c.primary : 'transparent' }]}>{content}</Pressable> : <View key={key} style={style}>{content}</View>;
  };
  const payment = payouts.data && data?.financialContext ? payoutTotals(payouts.data, data.financialContext.from, data.financialContext.toExclusive) : undefined;
  return <View style={styles.container}>
    <View style={[styles.periods, row]}>{(['month','quarter','year'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: period === value }}
      onPress={() => setPeriod(value)} style={({ pressed }) => [styles.period, { backgroundColor: period === value || pressed ? c.muted : 'transparent' }]}><BaitlyText variant="meta" style={{ fontWeight: period === value ? '600' : '400' }}>{t(`business.period.${value}`)}</BaitlyText></Pressable>)}</View>
    {overview.isPending ? <BaitlyLoading /> : overview.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void overview.refetch(); }} /> : data ? <>
      <View style={[styles.grid, row]}>
      {metric('revenue', money(data.totalRevenue.value, data.financialContext?.currency), undefined, data.totalRevenue.previousValue != null && data.totalRevenue.previousValue > 0 ? `${data.totalRevenue.growth > 0 ? '+' : ''}${numbers(data.totalRevenue.growth,1)} %` : undefined)}

      </View>
      {data.financialContext ? <BaitlyText muted variant="meta">{data.financialContext.from} · {businessEnd(data.financialContext.toExclusive)}{demo ? ` · ${t('business.demo')}` : ''}</BaitlyText> : null}
      <View style={[styles.grid, row]}>
      {metric('occupancy', `${numbers(data.occupancyRate.value,1)} %`)}
      {metric('adr', money(data.adr.value,data.financialContext?.currency))}
      {metric('revpan', money(data.revPan.value,data.financialContext?.currency))}
      {report.data ? metric('margin', money(report.data.margin,report.data.currency), undefined, report.data.marginPct == null ? undefined : t('business.marginShare', { value: numbers(report.data.marginPct,1) })) : report.isError ? <BaitlyEmpty title={t('business.financeUnavailable')} retry={() => { void report.refetch(); }} /> : report.isPending && data.financialContext ? <BaitlyLoading /> : !data.financialContext ? <BaitlyText muted variant="meta">{t('business.financeUnavailable')}</BaitlyText> : null}

      </View>

      <>
        {report.data ? <BusinessBars title={t('business.revenueBreakdown')} rows={[{ label: t('business.fees'), value: report.data.fees, formatted: money(report.data.fees,report.data.currency) }, { label: t('business.costs'), value: report.data.costs, formatted: money(report.data.costs,report.data.currency) }, { label: t('business.margin'), value: report.data.margin, formatted: money(report.data.margin,report.data.currency) }]} /> : null}
        <BaitlyText muted variant="meta">{t('business.marginDefinition')}</BaitlyText>
        {payouts.isError ? <BaitlyEmpty title={t('business.payoutUnavailable')} retry={() => { void payouts.refetch(); }} /> : payouts.isPending ? <BaitlyLoading /> : payment ? <>
          {payment.totals.map(bucket => <View key={bucket.currency} style={[styles.grid, row]}>{metric('commission',money(bucket.commission,bucket.currency))}{metric('paid',money(bucket.paid,bucket.currency))}{metric('pending',money(bucket.pending,bucket.currency))}</View>)}
          {!payment.totals.length && !payment.unknownCurrency ? <BaitlyText muted variant="meta">{t('business.noPayouts')}</BaitlyText> : null}
          {payment.unknownCurrency ? <BaitlyText muted variant="meta">{t('business.currencyMissing')}</BaitlyText> : null}
          <BaitlyText muted variant="meta">{t('business.payoutDefinition')}</BaitlyText>
        </> : null}
        <View style={[styles.grid, row]}>{metric('bookings',numbers(data.bookings.value))}{metric('homes',`${data.properties.active} / ${data.properties.total}`)}
        {metric('rating',data.guestRating.count ? `${numbers(data.guestRating.average,1)} / 5 · ${numbers(data.guestRating.count)}` : '–')}
        {metric('nights',`${numbers(data.financialContext?.occupiedNights ?? 0)} / ${numbers(data.financialContext?.availableNights ?? 0)}`)}
        {metric('completion',`${numbers(data.interventions.completionRate,1)} %`)}{metric('today',numbers(data.interventions.today))}{metric('upcoming',numbers(data.interventions.upcoming))}
        {metric('urgent',numbers(data.urgentInterventionsCount))}{metric('unpaid',numbers(data.pendingPaymentsCount))}
        </View>
        {data.revenueByChannel?.length ? <BusinessBars title={t('business.channels')} maximum={data.revenueByChannel.reduce((sum, channel) => sum + channel.amount, 0)} rows={data.revenueByChannel.map(channel => ({ label: channel.label || channel.source, value: channel.amount, formatted: `${money(channel.amount,data.financialContext?.currency)} · ${numbers(channel.pct,1)} %` }))} /> : null}
      </>
    </> : null}
  </View>;
}
function businessEnd(iso: string) { const date = new Date(`${iso}T12:00:00Z`); date.setUTCDate(date.getUTCDate()-1); return date.toISOString().slice(0,10); }
const styles = StyleSheet.create({
  container: { gap: 10, paddingBottom: 14 }, periods: { gap: 4 }, period: { minHeight: 44, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  revenue: { alignItems: 'center', padding: 18, borderRadius: 18, gap: 8 }, amount: { fontSize: 29, lineHeight: 36, fontWeight: '600', fontVariant: ['tabular-nums'] },
  metricTop: { alignItems: 'center', gap: 8 }, metricImage: { width: 44, height: 48 }, revenueImage: { width: 76, height: 82 },
  grid: { flexWrap: 'wrap', gap: 10 }, metric: { flexGrow: 1, minHeight: 100, justifyContent: 'space-between', gap: 12, padding: 15, borderRadius: 14 }, value: { fontSize: 22, lineHeight: 29, fontWeight: '600', fontVariant: ['tabular-nums'] }, more: { minHeight: 44, justifyContent: 'center' },
});
