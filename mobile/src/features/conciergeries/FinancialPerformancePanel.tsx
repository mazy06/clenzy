import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import type { FinancialPerformance } from './publicProfiles';

export function FinancialPerformancePanel({ periods }: { periods: FinancialPerformance[] }) {
  const { t, i18n } = useTranslation('mobileV1');
  const colors = useBaitlyTheme();
  const [methodOpen, setMethodOpen] = useState(false);
  const ordered = [...periods].sort((a, b) => a.year - b.year);
  const current = ordered[ordered.length - 1];
  const money = (amount: number, currency: string) => new Intl.NumberFormat(i18n.language, {
    style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  const pct = (amount: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(amount);
  const row = { flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' as const : 'row' as const };
  if (!current) return <View style={styles.empty}><BaitlyText muted>{t('financialNotPublished')}</BaitlyText></View>;
  const comparison = ordered.filter(p => p.currency === current.currency && p.revenuePerCalendarNight != null);
  const max = Math.max(1, ...comparison.map(p => p.revenuePerCalendarNight!));
  return <View style={[styles.section, { borderTopColor: colors.border }]}>
    <View style={[styles.heading, row]}>
      <Image source={require('../../../assets/baitly/public-profiles/report.webp')} contentFit="contain" style={styles.art} />
      <View style={{ flex: 1 }}><BaitlyText variant="heading">{t('financialPerformanceTitle')}</BaitlyText><BaitlyText muted variant="meta">{current.year} · {t('financialPortfolio', { count: current.properties })}</BaitlyText></View>
      {current.revenueGrowthPct != null ? <View style={[styles.growth, { backgroundColor: colors.muted }]}><BaitlyText style={styles.growthValue}>{current.revenueGrowthPct > 0 ? '+' : ''}{pct(current.revenueGrowthPct)} %</BaitlyText><BaitlyText muted variant="meta">{t('financialGrowth')}</BaitlyText></View> : null}
    </View>
    <View style={[styles.metrics, row]}>
      {[['financialAdr', current.averageNightlyRate], ['financialRevCalendar', current.revenuePerCalendarNight]].map(([label, amount]) =>
        <View key={String(label)} style={styles.metric}><BaitlyText muted variant="meta">{t(String(label))}</BaitlyText><BaitlyText style={styles.amount}>{typeof amount === 'number' ? money(amount, current.currency) : '—'}</BaitlyText></View>)}
    </View>
    {current.recordedCostMarginPct != null ? <View style={styles.margin}>
      <View style={[styles.heading, row]}><BaitlyText style={{ flex: 1 }}>{t('financialRecordedMargin')}</BaitlyText><BaitlyText style={styles.growthValue}>{pct(current.recordedCostMarginPct)} %</BaitlyText></View>
      <View style={[styles.track, { backgroundColor: colors.muted }]}><View style={[styles.fill, { width: `${Math.max(0, Math.min(100, current.recordedCostMarginPct))}%`, backgroundColor: colors.primary }]} /></View>
    </View> : <BaitlyText muted variant="meta">{t('financialMarginUnavailable')}</BaitlyText>}
    {comparison.length > 1 ? <View style={styles.comparison}>{comparison.map(period => <View key={period.year} style={[styles.heading, row]}>
      <BaitlyText muted variant="meta" style={styles.year}>{period.year}</BaitlyText>
      <View style={[styles.track, { flex: 1, backgroundColor: colors.muted }]}><View style={[styles.fill, { width: `${period.revenuePerCalendarNight! / max * 100}%`, backgroundColor: period.year === current.year ? colors.primary : colors.secondary }]} /></View>
      <BaitlyText variant="meta" style={styles.numeric}>{money(period.revenuePerCalendarNight!, period.currency)}</BaitlyText>
    </View>)}</View> : null}
    <View style={[styles.heading, row]}><Reicon name="document-text-outline" size={18} color={colors.secondary} /><BaitlyText muted variant="meta" style={{ flex: 1 }}>{t('financialCoverage', { percent: current.financialCoveragePct == null ? '—' : pct(current.financialCoveragePct), count: current.bookedNights })}</BaitlyText></View>
    {current.costCoveragePct != null ? <BaitlyText muted variant="meta">{t('financialCostCoverage', { percent: pct(current.costCoveragePct) })}</BaitlyText> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: methodOpen }} onPress={() => setMethodOpen(value => !value)} style={[styles.method, row]}>
      <BaitlyText muted variant="meta" style={{ flex: 1 }}>{t('financialMethodLabel')}</BaitlyText><View style={{ transform: [{ rotate: methodOpen ? '180deg' : '0deg' }] }}><Reicon name="chevron-down" size={18} color={colors.secondary} /></View>
    </Pressable>
    {methodOpen ? <BaitlyText muted variant="meta">{t('financialMethod')}</BaitlyText> : null}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: 16, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth },
  heading: { alignItems: 'center', gap: 10 }, art: { width: 38, height: 42 },
  growth: { padding: 8, borderRadius: 8 }, growthValue: { fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  metrics: { gap: 18 }, metric: { flex: 1, gap: 6 }, amount: { fontSize: 24, lineHeight: 30, fontWeight: '600', fontVariant: ['tabular-nums'] },
  margin: { gap: 10 }, track: { height: 6, borderRadius: 3, overflow: 'hidden' }, fill: { height: 6, borderRadius: 3 },
  comparison: { gap: 12 }, year: { width: 36 }, numeric: { fontVariant: ['tabular-nums'] },
  method: { minHeight: 44, alignItems: 'center', gap: 10 }, empty: { paddingVertical: 8 },
});
