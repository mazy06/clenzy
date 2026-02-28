import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { KpiCard } from '@/components/domain/KpiCard';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Divider } from '@/components/ui/Divider';
import { useProperties } from '@/hooks/useProperties';
import { useReservations } from '@/hooks/useReservations';
import { useServiceRequests } from '@/hooks/useServiceRequests';
import type { Reservation } from '@/api/endpoints/reservationsApi';
import type { Property } from '@/api/endpoints/propertiesApi';
import { useAiAnalytics } from '@/hooks/useAiAnalytics';
import type { OccupancyForecast } from '@/api/endpoints/aiAnalyticsApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;
type TabKey = 'overview' | 'revenue' | 'occupancy' | 'performance' | 'forecast';
type PeriodKey = 'month' | 'quarter' | 'year';

/* ─── Constants ─── */

const PERIODS: Array<{ value: PeriodKey; label: string }> = [
  { value: 'month', label: 'Ce mois' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Annee' },
];

const TABS: Array<{ key: TabKey; label: string; icon: IoniconsName }> = [
  { key: 'overview', label: 'Synthèse', icon: 'grid-outline' },
  { key: 'revenue', label: 'Revenus', icon: 'cash-outline' },
  { key: 'occupancy', label: 'Occupation', icon: 'pie-chart-outline' },
  { key: 'performance', label: 'Performance', icon: 'trophy-outline' },
  { key: 'forecast', label: 'Previsions', icon: 'sparkles-outline' },
];

const CHANNEL_COLORS: Record<string, string> = {
  Airbnb: '#FF5A5F',
  'Booking.com': '#003580',
  Booking: '#003580',
  Direct: '#059669',
  VRBO: '#3B5998',
  Expedia: '#FBCE00',
};

const DEFAULT_CHANNEL_COLOR = '#6B7280';

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

/* ─── Period helpers ─── */

function getPeriodDates(period: PeriodKey): { startDate: string; endDate: string; prevStartDate: string; prevEndDate: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  const fmt = (date: Date) => date.toISOString().split('T')[0];

  let startDate: Date;
  let prevStartDate: Date;
  let prevEndDate: Date;

  if (period === 'month') {
    startDate = new Date(y, m, 1);
    prevStartDate = new Date(y, m - 1, 1);
    prevEndDate = new Date(y, m, 0); // last day of previous month
  } else if (period === 'quarter') {
    const qStart = Math.floor(m / 3) * 3;
    startDate = new Date(y, qStart, 1);
    prevStartDate = new Date(y, qStart - 3, 1);
    prevEndDate = new Date(y, qStart, 0);
  } else {
    startDate = new Date(y, 0, 1);
    prevStartDate = new Date(y - 1, 0, 1);
    prevEndDate = new Date(y - 1, 11, 31);
  }

  return {
    startDate: fmt(startDate),
    endDate: fmt(now),
    prevStartDate: fmt(prevStartDate),
    prevEndDate: fmt(prevEndDate),
  };
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a);
  const d2 = new Date(b);
  const diff = Math.ceil((d2.getTime() - d1.getTime()) / 86400000);
  return Math.max(0, diff);
}

function getStayNights(res: Reservation): number {
  if (!res.checkIn || !res.checkOut) return 0;
  return daysBetween(res.checkIn.split('T')[0], res.checkOut.split('T')[0]);
}

function isConfirmed(res: Reservation): boolean {
  const s = (res.status ?? '').toUpperCase();
  return s !== 'CANCELLED' && s !== 'CANCELED' && s !== 'NO_SHOW';
}

function trendPercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/* ─── Analytics computation ─── */

interface PropertyMetrics {
  id: number;
  name: string;
  revenue: number;
  occupiedNights: number;
  totalNights: number;
  occupancyRate: number;
  reservationCount: number;
  avgStay: number;
  score: number;
}

interface ChannelMetrics {
  name: string;
  revenue: number;
  count: number;
  color: string;
}

interface AnalyticsResult {
  totalRevenue: number;
  prevRevenue: number;
  totalNights: number;
  occupiedNights: number;
  occupancyRate: number;
  prevOccupancyRate: number;
  adr: number;
  prevAdr: number;
  revPAN: number;
  prevRevPAN: number;
  avgStay: number;
  prevAvgStay: number;
  reservationCount: number;
  prevReservationCount: number;
  propertyCount: number;
  pendingRequests: number;
  byProperty: PropertyMetrics[];
  byChannel: ChannelMetrics[];
  vacantNights: number;
  avgRevenuePerBooking: number;
}

function computeAnalytics(
  reservations: Reservation[],
  prevReservations: Reservation[],
  propertyCount: number,
  propertyList: Array<{ id: number; name: string }>,
  daysInPeriod: number,
  prevDaysInPeriod: number,
  pendingRequests: number,
): AnalyticsResult {
  const confirmed = reservations.filter(isConfirmed);
  const prevConfirmed = prevReservations.filter(isConfirmed);

  // Global metrics
  const totalRevenue = confirmed.reduce((sum, r) => sum + (r.totalPrice ?? 0), 0);
  const prevRevenue = prevConfirmed.reduce((sum, r) => sum + (r.totalPrice ?? 0), 0);

  const totalNights = propertyCount * daysInPeriod;
  const prevTotalNights = propertyCount * prevDaysInPeriod;

  const occupiedNights = confirmed.reduce((sum, r) => sum + getStayNights(r), 0);
  const prevOccupiedNights = prevConfirmed.reduce((sum, r) => sum + getStayNights(r), 0);

  const occupancyRate = totalNights > 0 ? (occupiedNights / totalNights) * 100 : 0;
  const prevOccupancyRate = prevTotalNights > 0 ? (prevOccupiedNights / prevTotalNights) * 100 : 0;

  const adr = occupiedNights > 0 ? totalRevenue / occupiedNights : 0;
  const prevAdr = prevOccupiedNights > 0 ? prevRevenue / prevOccupiedNights : 0;

  const revPAN = totalNights > 0 ? totalRevenue / totalNights : 0;
  const prevRevPAN = prevTotalNights > 0 ? prevRevenue / prevTotalNights : 0;

  const avgStay = confirmed.length > 0
    ? confirmed.reduce((sum, r) => sum + getStayNights(r), 0) / confirmed.length
    : 0;
  const prevAvgStay = prevConfirmed.length > 0
    ? prevConfirmed.reduce((sum, r) => sum + getStayNights(r), 0) / prevConfirmed.length
    : 0;

  const avgRevenuePerBooking = confirmed.length > 0 ? totalRevenue / confirmed.length : 0;

  // By property
  const byProperty: PropertyMetrics[] = propertyList.map((p) => {
    const propRes = confirmed.filter((r) => r.propertyId === p.id);
    const propRevenue = propRes.reduce((sum, r) => sum + (r.totalPrice ?? 0), 0);
    const propOccupied = propRes.reduce((sum, r) => sum + getStayNights(r), 0);
    const propTotal = daysInPeriod;
    const propRate = propTotal > 0 ? (propOccupied / propTotal) * 100 : 0;
    const propAvgStay = propRes.length > 0
      ? propRes.reduce((sum, r) => sum + getStayNights(r), 0) / propRes.length
      : 0;

    // Simple score: weighted(revenue 40%, occupancy 40%, avgStay 20%) normalized
    const revenueScore = Math.min(100, (propRevenue / Math.max(totalRevenue * 0.5, 1)) * 100);
    const occScore = propRate;
    const stayScore = Math.min(100, (propAvgStay / Math.max(avgStay * 2, 1)) * 100);
    const score = Math.round(revenueScore * 0.4 + occScore * 0.4 + stayScore * 0.2);

    return {
      id: p.id,
      name: p.name,
      revenue: propRevenue,
      occupiedNights: propOccupied,
      totalNights: propTotal,
      occupancyRate: propRate,
      reservationCount: propRes.length,
      avgStay: propAvgStay,
      score: Math.min(100, score),
    };
  }).sort((a, b) => b.score - a.score);

  // By channel
  const channelMap = new Map<string, { revenue: number; count: number }>();
  for (const r of confirmed) {
    const channel = r.sourceName || r.source || 'Direct';
    const existing = channelMap.get(channel) ?? { revenue: 0, count: 0 };
    existing.revenue += r.totalPrice ?? 0;
    existing.count += 1;
    channelMap.set(channel, existing);
  }

  const byChannel: ChannelMetrics[] = Array.from(channelMap.entries())
    .map(([name, data]) => ({
      name,
      revenue: data.revenue,
      count: data.count,
      color: CHANNEL_COLORS[name] ?? DEFAULT_CHANNEL_COLOR,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    totalRevenue,
    prevRevenue,
    totalNights,
    occupiedNights,
    occupancyRate,
    prevOccupancyRate,
    adr,
    prevAdr,
    revPAN,
    prevRevPAN,
    avgStay,
    prevAvgStay,
    reservationCount: confirmed.length,
    prevReservationCount: prevConfirmed.length,
    propertyCount,
    pendingRequests,
    byProperty,
    byChannel,
    vacantNights: Math.max(0, totalNights - occupiedNights),
    avgRevenuePerBooking,
  };
}

/* ─── Tab selector (scrollable chips) ─── */

function TabSelector({ activeTab, onTabChange, theme }: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{
      flexDirection: 'row',
      marginHorizontal: theme.SPACING.lg,
      backgroundColor: theme.colors.background.surface,
      borderRadius: theme.BORDER_RADIUS.full,
      padding: 4,
    }}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 10,
              borderRadius: theme.BORDER_RADIUS.full,
              backgroundColor: isActive ? theme.colors.primary.main : 'transparent',
            }}
          >
            <Text style={{
              ...theme.typography.caption,
              fontWeight: isActive ? '700' : '500',
              color: isActive ? theme.colors.primary.contrastText : theme.colors.text.disabled,
              fontSize: 12,
            }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─── Overview Tab ─── */

function OverviewTab({ data, theme }: { data: AnalyticsResult; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ paddingHorizontal: theme.SPACING.lg }}>
      <SectionHeader title="Indicateurs cles" iconName="analytics-outline" />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
        <KpiCard
          label="Revenus total"
          value={Math.round(data.totalRevenue).toLocaleString('fr-FR')}
          unit="EUR"
          trend={trendPercent(data.totalRevenue, data.prevRevenue)}
          iconName="cash-outline"
          color="primary"
        />
        <KpiCard
          label="Taux d'occupation"
          value={Math.round(data.occupancyRate)}
          unit="%"
          trend={trendPercent(data.occupancyRate, data.prevOccupancyRate)}
          iconName="pie-chart-outline"
          color={data.occupancyRate >= 70 ? 'success' : data.occupancyRate >= 40 ? 'warning' : 'error'}
        />
        <KpiCard
          label="Prix moy./nuit (ADR)"
          value={Math.round(data.adr)}
          unit="EUR"
          trend={trendPercent(data.adr, data.prevAdr)}
          iconName="pricetag-outline"
          color="secondary"
        />
        <KpiCard
          label="RevPAN"
          value={Math.round(data.revPAN)}
          unit="EUR"
          trend={trendPercent(data.revPAN, data.prevRevPAN)}
          iconName="trending-up"
          color="primary"
        />
        <KpiCard
          label="Duree moy. sejour"
          value={data.avgStay.toFixed(1)}
          unit="nuits"
          trend={trendPercent(data.avgStay, data.prevAvgStay)}
          iconName="time-outline"
          color="info"
        />
        <KpiCard
          label="Reservations"
          value={data.reservationCount}
          trend={trendPercent(data.reservationCount, data.prevReservationCount)}
          iconName="calendar-outline"
          color="secondary"
        />
        <KpiCard
          label="Proprietes actives"
          value={data.propertyCount}
          iconName="home-outline"
          color="success"
        />
        <KpiCard
          label="Demandes en cours"
          value={data.pendingRequests}
          iconName="construct-outline"
          color="warning"
        />
      </View>
    </View>
  );
}

/* ─── Revenue Tab ─── */

function RevenueTab({ data, theme }: { data: AnalyticsResult; theme: ReturnType<typeof useTheme> }) {
  const maxPropertyRevenue = Math.max(...data.byProperty.map((p) => p.revenue), 1);
  const maxChannelRevenue = Math.max(...data.byChannel.map((c) => c.revenue), 1);

  return (
    <View style={{ paddingHorizontal: theme.SPACING.lg }}>
      {/* Revenue KPIs */}
      <SectionHeader title="Synthese" iconName="wallet-outline" />
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
        <KpiCard
          label="Revenus total"
          value={Math.round(data.totalRevenue).toLocaleString('fr-FR')}
          unit="EUR"
          trend={trendPercent(data.totalRevenue, data.prevRevenue)}
          iconName="cash-outline"
          color="primary"
        />
        <KpiCard
          label="Rev. moy./reservation"
          value={Math.round(data.avgRevenuePerBooking)}
          unit="EUR"
          iconName="receipt-outline"
          color="secondary"
        />
      </View>

      {/* Top properties by revenue */}
      <SectionHeader title="Top proprietes" iconName="podium-outline" />
      {data.byProperty.length === 0 ? (
        <EmptyState iconName="home-outline" title="Aucune donnee" compact style={{ marginBottom: theme.SPACING.lg }} />
      ) : (
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          {data.byProperty.slice(0, 6).map((prop, idx) => (
            <View key={prop.id}>
              {idx > 0 && <View style={{ height: 10 }} />}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, width: 20, textAlign: 'right' }}>
                  #{idx + 1}
                </Text>
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, flex: 1, fontWeight: '500' }} numberOfLines={1}>
                  {prop.name}
                </Text>
                <Text style={{ ...theme.typography.body2, color: theme.colors.primary.main, fontWeight: '700' }}>
                  {Math.round(prop.revenue).toLocaleString('fr-FR')}€
                </Text>
              </View>
              <View style={{ marginLeft: 28 }}>
                <View style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: `${theme.colors.primary.main}18`,
                  overflow: 'hidden',
                }}>
                  <View style={{
                    height: '100%',
                    width: `${Math.max(2, (prop.revenue / maxPropertyRevenue) * 100)}%`,
                    borderRadius: 4,
                    backgroundColor: theme.colors.primary.main,
                  }} />
                </View>
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* Revenue by channel */}
      <SectionHeader title="Revenus par canal" iconName="globe-outline" />
      {data.byChannel.length === 0 ? (
        <EmptyState iconName="globe-outline" title="Aucune donnee" compact style={{ marginBottom: theme.SPACING.lg }} />
      ) : (
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          {data.byChannel.map((channel, idx) => (
            <View key={channel.name}>
              {idx > 0 && <View style={{ height: 10 }} />}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: channel.color }} />
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, flex: 1, fontWeight: '500' }}>
                  {channel.name}
                </Text>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
                  {channel.count} res.
                </Text>
                <Text style={{ ...theme.typography.body2, color: channel.color, fontWeight: '700' }}>
                  {Math.round(channel.revenue).toLocaleString('fr-FR')}€
                </Text>
              </View>
              <View style={{ marginLeft: 18 }}>
                <View style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: `${channel.color}18`,
                  overflow: 'hidden',
                }}>
                  <View style={{
                    height: '100%',
                    width: `${Math.max(2, (channel.revenue / maxChannelRevenue) * 100)}%`,
                    borderRadius: 3,
                    backgroundColor: channel.color,
                  }} />
                </View>
              </View>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

/* ─── Occupancy Tab ─── */

function OccupancyTab({ data, theme }: { data: AnalyticsResult; theme: ReturnType<typeof useTheme> }) {
  const occColor = data.occupancyRate >= 70 ? 'success' : data.occupancyRate >= 40 ? 'warning' : 'error';
  const colorMap = {
    success: theme.colors.success.main,
    warning: theme.colors.warning.main,
    error: theme.colors.error.main,
  };

  return (
    <View style={{ paddingHorizontal: theme.SPACING.lg }}>
      {/* Global occupancy */}
      <SectionHeader title="Taux global" iconName="pie-chart-outline" />
      <Card style={{ marginBottom: theme.SPACING.lg, alignItems: 'center', paddingVertical: theme.SPACING.xl }}>
        <Text style={{
          fontSize: 44,
          lineHeight: 52,
          color: colorMap[occColor],
          fontWeight: '800',
        }}>
          {Math.round(data.occupancyRate)}%
        </Text>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginBottom: theme.SPACING.md }}>
          {data.occupiedNights} nuits occupees / {data.totalNights} disponibles
        </Text>
        <View style={{ width: '100%' }}>
          <ProgressBar progress={data.occupancyRate} color={occColor} height={10} />
        </View>
      </Card>

      {/* Vacant nights + avg stay */}
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
        <KpiCard
          label="Nuits vacantes"
          value={data.vacantNights}
          unit="nuits"
          iconName="moon-outline"
          color="warning"
        />
        <KpiCard
          label="Duree moy. sejour"
          value={data.avgStay.toFixed(1)}
          unit="nuits"
          trend={trendPercent(data.avgStay, data.prevAvgStay)}
          iconName="time-outline"
          color="info"
        />
      </View>

      {/* Occupancy by property */}
      <SectionHeader title="Par propriete" iconName="home-outline" />
      {data.byProperty.length === 0 ? (
        <EmptyState iconName="home-outline" title="Aucune donnee" compact style={{ marginBottom: theme.SPACING.lg }} />
      ) : (
        <View style={{ gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
          {data.byProperty
            .sort((a, b) => b.occupancyRate - a.occupancyRate)
            .map((prop) => {
              const propOccColor = prop.occupancyRate >= 70 ? 'success' : prop.occupancyRate >= 40 ? 'warning' : 'error';
              const propColorHex = colorMap[propOccColor];
              return (
                <Card key={prop.id}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.SPACING.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, flex: 1 }}>
                      <View style={{
                        width: 32,
                        height: 32,
                        borderRadius: theme.BORDER_RADIUS.sm,
                        backgroundColor: `${propColorHex}0C`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Ionicons name="home-outline" size={16} color={propColorHex} />
                      </View>
                      <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                        {prop.name}
                      </Text>
                    </View>
                    <Text style={{ ...theme.typography.h4, color: propColorHex, fontWeight: '700' }}>
                      {Math.round(prop.occupancyRate)}%
                    </Text>
                  </View>
                  <ProgressBar progress={prop.occupancyRate} color={propOccColor} height={6} />
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginTop: 4 }}>
                    {prop.occupiedNights} / {prop.totalNights} nuits
                  </Text>
                </Card>
              );
            })}
        </View>
      )}
    </View>
  );
}

/* ─── Performance Tab ─── */

function PerformanceTab({ data, theme }: { data: AnalyticsResult; theme: ReturnType<typeof useTheme> }) {
  const sorted = [...data.byProperty].sort((a, b) => b.score - a.score);

  // Portfolio averages
  const avgRevPAN = data.revPAN;
  const avgOccupancy = data.occupancyRate;

  return (
    <View style={{ paddingHorizontal: theme.SPACING.lg }}>
      {/* Portfolio summary */}
      <SectionHeader title="Resume portefeuille" iconName="briefcase-outline" />
      <Card style={{ marginBottom: theme.SPACING.lg }}>
        <View style={{ flexDirection: 'row', gap: theme.SPACING.md }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginBottom: 4 }}>
              RevPAN moy.
            </Text>
            <Text style={{ ...theme.typography.h3, color: theme.colors.primary.main, fontWeight: '800' }}>
              {Math.round(avgRevPAN)}€
            </Text>
          </View>
          <View style={{ width: 1, backgroundColor: theme.colors.border.light }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginBottom: 4 }}>
              Occupation moy.
            </Text>
            <Text style={{
              ...theme.typography.h3,
              fontWeight: '800',
              color: avgOccupancy >= 70 ? theme.colors.success.main : avgOccupancy >= 40 ? theme.colors.warning.main : theme.colors.error.main,
            }}>
              {Math.round(avgOccupancy)}%
            </Text>
          </View>
          <View style={{ width: 1, backgroundColor: theme.colors.border.light }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginBottom: 4 }}>
              Proprietes
            </Text>
            <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, fontWeight: '800' }}>
              {data.propertyCount}
            </Text>
          </View>
        </View>
      </Card>

      {/* Property ranking */}
      <SectionHeader title="Classement" iconName="trophy-outline" />
      {sorted.length === 0 ? (
        <EmptyState iconName="trophy-outline" title="Aucune donnee" compact style={{ marginBottom: theme.SPACING.lg }} />
      ) : (
        <View style={{ gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
          {sorted.map((prop, idx) => {
            const rank = idx + 1;
            const isTop3 = rank <= 3;
            const medalColor = isTop3 ? MEDAL_COLORS[idx] : theme.colors.text.disabled;
            const scoreColor = prop.score >= 70 ? theme.colors.success.main : prop.score >= 40 ? theme.colors.warning.main : theme.colors.error.main;
            const scoreBarColor: 'success' | 'warning' | 'error' = prop.score >= 70 ? 'success' : prop.score >= 40 ? 'warning' : 'error';

            return (
              <Card key={prop.id}>
                {/* Header: rank + name + score */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: theme.SPACING.sm }}>
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: isTop3 ? `${medalColor}20` : `${theme.colors.text.disabled}10`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {isTop3 ? (
                      <Ionicons name="medal-outline" size={16} color={medalColor} />
                    ) : (
                      <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, fontWeight: '700' }}>
                        #{rank}
                      </Text>
                    )}
                  </View>
                  <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, flex: 1, fontWeight: '600' }} numberOfLines={1}>
                    {prop.name}
                  </Text>
                  <View style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: theme.BORDER_RADIUS.full,
                    backgroundColor: `${scoreColor}14`,
                  }}>
                    <Text style={{ ...theme.typography.caption, color: scoreColor, fontWeight: '800' }}>
                      {prop.score}/100
                    </Text>
                  </View>
                </View>

                {/* Score bar */}
                <ProgressBar progress={prop.score} color={scoreBarColor} height={6} />

                <Divider style={{ marginVertical: theme.SPACING.sm }} />

                {/* Metrics row */}
                <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, fontSize: 10 }}>RevPAN</Text>
                    <Text style={{ ...theme.typography.body2, color: theme.colors.primary.main, fontWeight: '700' }}>
                      {Math.round(prop.totalNights > 0 ? prop.revenue / prop.totalNights : 0)}€
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, fontSize: 10 }}>Occupation</Text>
                    <Text style={{
                      ...theme.typography.body2,
                      fontWeight: '700',
                      color: prop.occupancyRate >= 70 ? theme.colors.success.main : prop.occupancyRate >= 40 ? theme.colors.warning.main : theme.colors.error.main,
                    }}>
                      {Math.round(prop.occupancyRate)}%
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, fontSize: 10 }}>Revenu</Text>
                    <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '700' }}>
                      {Math.round(prop.revenue).toLocaleString('fr-FR')}€
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, fontSize: 10 }}>Reserv.</Text>
                    <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '700' }}>
                      {prop.reservationCount}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </View>
  );
}

/* ─── Forecast Tab (AI-powered) ─── */

const SEASON_LABELS: Record<string, { label: string; color: string }> = {
  HIGH: { label: 'Haute saison', color: '#059669' },
  MID: { label: 'Mi-saison', color: '#D97706' },
  LOW: { label: 'Basse saison', color: '#6B7280' },
};

const DAY_TYPE_LABELS: Record<string, string> = {
  WEEKDAY: 'Sem.',
  WEEKEND: 'W-E',
  HOLIDAY: 'Ferie',
};

function ForecastTab({ properties, theme }: {
  properties: Property[];
  theme: ReturnType<typeof useTheme>;
}) {
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const effectivePropertyId = selectedPropertyId ?? properties[0]?.id;

  // Next 30 days
  const from = new Date().toISOString().split('T')[0];
  const to = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const { data: aiData, isLoading } = useAiAnalytics(effectivePropertyId, from, to);

  const forecast = aiData?.forecast ?? [];

  // Group by week for cleaner display
  const weekGroups = useMemo(() => {
    const groups: Array<{ label: string; days: OccupancyForecast[] }> = [];
    let currentWeek: OccupancyForecast[] = [];
    let currentWeekLabel = '';

    forecast.forEach((day, idx) => {
      const d = new Date(day.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay() + 1); // Monday
      const label = `Sem. du ${weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;

      if (label !== currentWeekLabel) {
        if (currentWeek.length > 0) {
          groups.push({ label: currentWeekLabel, days: currentWeek });
        }
        currentWeek = [day];
        currentWeekLabel = label;
      } else {
        currentWeek.push(day);
      }

      if (idx === forecast.length - 1 && currentWeek.length > 0) {
        groups.push({ label: currentWeekLabel, days: currentWeek });
      }
    });

    return groups;
  }, [forecast]);

  // Summary stats
  const avgOccupancy = forecast.length > 0
    ? forecast.reduce((s, d) => s + d.predictedOccupancy, 0) / forecast.length
    : 0;
  const bookedDays = forecast.filter((d) => d.isBooked).length;
  const highConfidenceFree = forecast.filter((d) => !d.isBooked && d.confidence >= 0.7).length;

  function getOccupancyColor(occ: number): string {
    if (occ >= 0.7) return theme.colors.success.main;
    if (occ >= 0.4) return theme.colors.warning.main;
    return theme.colors.error.main;
  }

  return (
    <View style={{ paddingHorizontal: theme.SPACING.lg }}>
      {/* Property selector */}
      {properties.length > 1 && (
        <>
          <SectionHeader title="Propriete" iconName="home-outline" />
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, marginBottom: theme.SPACING.md }}
          >
            {properties.map((p: Property) => (
              <Pressable
                key={p.id}
                onPress={() => setSelectedPropertyId(p.id)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8,
                  borderRadius: theme.BORDER_RADIUS.full,
                  backgroundColor: (selectedPropertyId === p.id || (!selectedPropertyId && p.id === properties[0]?.id))
                    ? theme.colors.primary.main
                    : theme.colors.background.surface,
                }}
              >
                <Text style={{
                  ...theme.typography.caption, fontWeight: '600',
                  color: (selectedPropertyId === p.id || (!selectedPropertyId && p.id === properties[0]?.id))
                    ? '#fff' : theme.colors.text.secondary,
                }} numberOfLines={1}>{p.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      {isLoading ? (
        <View style={{ gap: theme.SPACING.md }}>
          <Skeleton width="100%" height={80} borderRadius={theme.BORDER_RADIUS.lg} />
          <Skeleton width="100%" height={200} borderRadius={theme.BORDER_RADIUS.lg} />
        </View>
      ) : forecast.length === 0 ? (
        <EmptyState
          iconName="sparkles-outline"
          title="Aucune prevision"
          description="Selectionnez une propriete pour voir les previsions d'occupation IA"
          compact
        />
      ) : (
        <>
          {/* AI Summary cards */}
          <SectionHeader title="Previsions 30 jours" iconName="sparkles-outline" />
          <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
            <KpiCard
              label="Occupation prevue"
              value={Math.round(avgOccupancy * 100)}
              unit="%"
              iconName="pie-chart-outline"
              color={avgOccupancy >= 0.7 ? 'success' : avgOccupancy >= 0.4 ? 'warning' : 'error'}
            />
            <KpiCard
              label="Jours reserves"
              value={bookedDays}
              unit={`/ ${forecast.length}`}
              iconName="checkmark-circle-outline"
              color="success"
            />
          </View>
          <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
            <KpiCard
              label="Opportunites"
              value={highConfidenceFree}
              unit="jours libres"
              iconName="bulb-outline"
              color="warning"
            />
            <KpiCard
              label="Confiance moy."
              value={Math.round((forecast.reduce((s, d) => s + d.confidence, 0) / forecast.length) * 100)}
              unit="%"
              iconName="shield-checkmark-outline"
              color="info"
            />
          </View>

          {/* Calendar grid - each week */}
          <SectionHeader title="Calendrier previsionnel" iconName="calendar-outline" />
          {weekGroups.map((week) => (
            <View key={week.label} style={{ marginBottom: theme.SPACING.md }}>
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontWeight: '600', marginBottom: 6 }}>
                {week.label}
              </Text>
              <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                {week.days.map((day) => {
                  const d = new Date(day.date);
                  const dayName = d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 2);
                  const dayNum = d.getDate();
                  const bgColor = day.isBooked
                    ? theme.colors.success.main
                    : getOccupancyColor(day.predictedOccupancy);
                  const bgAlpha = day.isBooked ? 'FF' : Math.round(Math.max(0.2, day.predictedOccupancy) * 255).toString(16).padStart(2, '0');

                  return (
                    <View
                      key={day.date}
                      style={{
                        width: 44,
                        height: 54,
                        borderRadius: theme.BORDER_RADIUS.md,
                        backgroundColor: `${bgColor}${bgAlpha}`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: day.dayType === 'WEEKEND' ? 1.5 : 0,
                        borderColor: day.dayType === 'WEEKEND' ? theme.colors.primary.light : 'transparent',
                      }}
                    >
                      <Text style={{ fontSize: 9, color: '#fff', fontWeight: '600', opacity: 0.8 }}>
                        {dayName}
                      </Text>
                      <Text style={{ fontSize: 16, color: '#fff', fontWeight: '800' }}>
                        {dayNum}
                      </Text>
                      <Text style={{ fontSize: 8, color: '#fff', fontWeight: '600', opacity: 0.7 }}>
                        {day.isBooked ? '●' : `${Math.round(day.predictedOccupancy * 100)}%`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Legend */}
          <View style={{
            flexDirection: 'row',
            gap: theme.SPACING.md,
            paddingVertical: theme.SPACING.sm,
            marginBottom: theme.SPACING.lg,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: theme.colors.success.main }} />
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Reserve/Probable</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: theme.colors.warning.main }} />
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Possible</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: theme.colors.error.main }} />
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Libre</Text>
            </View>
          </View>

          {/* Detailed forecast list */}
          <SectionHeader title="Detail par jour" iconName="list-outline" />
          {forecast.filter((d) => !d.isBooked).slice(0, 10).map((day) => {
            const seasonCfg = SEASON_LABELS[day.season] ?? SEASON_LABELS.LOW;
            return (
              <Card key={day.date} style={{ marginBottom: theme.SPACING.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm }}>
                  {/* Date */}
                  <View style={{ alignItems: 'center', width: 44 }}>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, fontSize: 10 }}>
                      {new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'short' })}
                    </Text>
                    <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary, fontWeight: '800' }}>
                      {new Date(day.date).getDate()}
                    </Text>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, fontSize: 10 }}>
                      {new Date(day.date).toLocaleDateString('fr-FR', { month: 'short' })}
                    </Text>
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <View style={{
                        paddingHorizontal: 6, paddingVertical: 2,
                        borderRadius: theme.BORDER_RADIUS.sm,
                        backgroundColor: `${seasonCfg.color}18`,
                      }}>
                        <Text style={{ fontSize: 10, color: seasonCfg.color, fontWeight: '600' }}>
                          {seasonCfg.label}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 10, color: theme.colors.text.disabled }}>
                        {DAY_TYPE_LABELS[day.dayType] ?? day.dayType}
                      </Text>
                    </View>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }} numberOfLines={2}>
                      {day.reason}
                    </Text>
                  </View>

                  {/* Occupancy indicator */}
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{
                      ...theme.typography.h4,
                      fontWeight: '800',
                      color: getOccupancyColor(day.predictedOccupancy),
                    }}>
                      {Math.round(day.predictedOccupancy * 100)}%
                    </Text>
                    <View style={{
                      width: 40, height: 4, borderRadius: 2,
                      backgroundColor: `${getOccupancyColor(day.predictedOccupancy)}30`,
                      marginTop: 4,
                    }}>
                      <View style={{
                        width: `${Math.round(day.predictedOccupancy * 100)}%`,
                        height: '100%',
                        borderRadius: 2,
                        backgroundColor: getOccupancyColor(day.predictedOccupancy),
                      }} />
                    </View>
                    <Text style={{ fontSize: 9, color: theme.colors.text.disabled, marginTop: 2 }}>
                      conf. {Math.round(day.confidence * 100)}%
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })}
        </>
      )}
    </View>
  );
}

/* ─── Loading skeleton ─── */

function AnalyticsSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
      <Skeleton width="40%" height={28} />
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
        <Skeleton width={80} height={32} borderRadius={theme.BORDER_RADIUS.full} />
        <Skeleton width={80} height={32} borderRadius={theme.BORDER_RADIUS.full} />
        <Skeleton width={80} height={32} borderRadius={theme.BORDER_RADIUS.full} />
      </View>
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginTop: theme.SPACING.md }}>
        <Skeleton height={100} style={{ flex: 1 }} borderRadius={theme.BORDER_RADIUS.lg} />
        <Skeleton height={100} style={{ flex: 1 }} borderRadius={theme.BORDER_RADIUS.lg} />
      </View>
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
        <Skeleton height={100} style={{ flex: 1 }} borderRadius={theme.BORDER_RADIUS.lg} />
        <Skeleton height={100} style={{ flex: 1 }} borderRadius={theme.BORDER_RADIUS.lg} />
      </View>
      <Skeleton height={80} borderRadius={theme.BORDER_RADIUS.lg} />
      <Skeleton height={80} borderRadius={theme.BORDER_RADIUS.lg} />
    </View>
  );
}

/* ─── Main Screen ─── */

export function AnalyticsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const [period, setPeriod] = useState<PeriodKey>('month');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const { startDate, endDate, prevStartDate, prevEndDate } = useMemo(
    () => getPeriodDates(period),
    [period],
  );

  const daysInPeriod = useMemo(() => daysBetween(startDate, endDate), [startDate, endDate]);
  const prevDaysInPeriod = useMemo(() => daysBetween(prevStartDate, prevEndDate), [prevStartDate, prevEndDate]);

  // Fetch data
  const { data: propertiesData, isLoading: propsLoading } = useProperties();
  const { data: reservationsData, isLoading: resLoading, isRefetching, refetch } = useReservations({
    startDate,
    endDate,
    size: '500',
  });
  const { data: prevReservationsData } = useReservations({
    startDate: prevStartDate,
    endDate: prevEndDate,
    size: '500',
  });
  const { data: serviceRequestsData } = useServiceRequests({ status: 'PENDING' });

  const properties = propertiesData?.content ?? [];
  const reservations = reservationsData?.content ?? [];
  const prevReservations = prevReservationsData?.content ?? [];
  const pendingRequests = serviceRequestsData?.content?.length ?? 0;

  const isLoading = propsLoading || resLoading;

  // Compute analytics
  const analytics = useMemo(
    () =>
      computeAnalytics(
        reservations,
        prevReservations,
        properties.length,
        properties.map((p) => ({ id: p.id, name: p.name })),
        daysInPeriod,
        prevDaysInPeriod,
        pendingRequests,
      ),
    [reservations, prevReservations, properties, daysInPeriod, prevDaysInPeriod, pendingRequests],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.SPACING.lg,
        paddingVertical: theme.SPACING.md,
        gap: theme.SPACING.sm,
      }}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: theme.colors.background.paper,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
            ...theme.shadows.sm,
          })}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, flex: 1 }}>
          Analytics
        </Text>
      </View>

      {/* Period selector */}
      <View style={{ flexDirection: 'row', paddingHorizontal: theme.SPACING.lg, gap: theme.SPACING.sm, marginBottom: theme.SPACING.sm }}>
        {PERIODS.map((p) => (
          <Chip
            key={p.value}
            label={p.label}
            selected={period === p.value}
            onPress={() => setPeriod(p.value)}
          />
        ))}
      </View>

      {/* Tab selector */}
      <TabSelector activeTab={activeTab} onTabChange={setActiveTab} theme={theme} />

      {/* Content */}
      {isLoading ? (
        <AnalyticsSkeleton theme={theme} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40, paddingTop: theme.SPACING.sm }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.primary.main}
            />
          }
        >
          {activeTab === 'overview' && <OverviewTab data={analytics} theme={theme} />}
          {activeTab === 'revenue' && <RevenueTab data={analytics} theme={theme} />}
          {activeTab === 'occupancy' && <OccupancyTab data={analytics} theme={theme} />}
          {activeTab === 'performance' && <PerformanceTab data={analytics} theme={theme} />}
          {activeTab === 'forecast' && <ForecastTab properties={properties} theme={theme} />}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
