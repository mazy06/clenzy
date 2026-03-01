import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRevenueKpis, useOccupancyKpis } from '@/hooks/useKpi';
import { KpiCard } from '@/components/domain/KpiCard';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/theme';

const PERIODS = [
  { value: 'month', label: 'Ce mois' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Annee' },
];

function ReportsSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
      <Skeleton width="40%" height={28} />
      <Skeleton width="55%" height={14} />
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginTop: theme.SPACING.sm }}>
        <Skeleton width={80} height={32} borderRadius={theme.BORDER_RADIUS.lg} />
        <Skeleton width={80} height={32} borderRadius={theme.BORDER_RADIUS.lg} />
        <Skeleton width={80} height={32} borderRadius={theme.BORDER_RADIUS.lg} />
      </View>
      <Skeleton height={20} width="30%" style={{ marginTop: theme.SPACING.md }} />
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
        <Skeleton height={100} style={{ flex: 1 }} borderRadius={theme.BORDER_RADIUS.lg} />
        <Skeleton height={100} style={{ flex: 1 }} borderRadius={theme.BORDER_RADIUS.lg} />
      </View>
      <Skeleton height={20} width="35%" style={{ marginTop: theme.SPACING.md }} />
      <Skeleton height={70} borderRadius={theme.BORDER_RADIUS.lg} />
      <Skeleton height={70} borderRadius={theme.BORDER_RADIUS.lg} />
    </View>
  );
}

export function RevenueReportsScreen() {
  const theme = useTheme();
  const [period, setPeriod] = useState('month');

  const params = { period };
  const { data: revenueData, isLoading: revLoading, isRefetching, refetch } = useRevenueKpis(params);
  const { data: occupancyData } = useOccupancyKpis(params);

  if (revLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <ReportsSkeleton theme={theme} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING['2xl'], paddingBottom: theme.SPACING.lg }}>
          <Text style={{ ...theme.typography.h1, color: theme.colors.text.primary }}>
            Rapports
          </Text>
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: 4 }}>
            Suivi des performances
          </Text>
        </View>

        <View style={{ paddingHorizontal: theme.SPACING.lg }}>
          {/* Period filter */}
          <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginBottom: theme.SPACING['2xl'] }}>
            {PERIODS.map((p) => (
              <Chip
                key={p.value}
                label={p.label}
                selected={period === p.value}
                onPress={() => setPeriod(p.value)}
              />
            ))}
          </View>

          {/* Revenue KPIs */}
          <SectionHeader title="Revenus" iconName="cash-outline" />
          {revenueData && revenueData.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.SPACING.sm, marginBottom: theme.SPACING.xl }}>
              {revenueData.map((kpi, idx) => (
                <KpiCard
                  key={idx}
                  label={kpi.label}
                  value={kpi.value}
                  unit={kpi.unit || '\u20AC'}
                  trend={kpi.trend}
                  iconName="wallet-outline"
                  color="primary"
                />
              ))}
            </View>
          ) : (
            <EmptyState
              iconName="cash-outline"
              title="Aucune donnee de revenu"
              description="Les revenus seront affiches ici"
              compact
              style={{ marginBottom: theme.SPACING.xl }}
            />
          )}

          {/* Occupancy */}
          <SectionHeader title="Taux d'occupation" iconName="pie-chart-outline" />
          {occupancyData && occupancyData.length > 0 ? (
            <View style={{ gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
              {occupancyData.map((kpi, idx) => {
                const occupancyColor = kpi.value >= 70 ? 'success' : kpi.value >= 40 ? 'warning' : 'error';
                const colorMap = {
                  success: theme.colors.success.main,
                  warning: theme.colors.warning.main,
                  error: theme.colors.error.main,
                };

                return (
                  <Card key={idx}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.SPACING.sm }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm }}>
                        <View style={{
                          width: 32,
                          height: 32,
                          borderRadius: theme.BORDER_RADIUS.sm,
                          backgroundColor: `${colorMap[occupancyColor]}0C`,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Ionicons name="stats-chart-outline" size={16} color={colorMap[occupancyColor]} />
                        </View>
                        <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '600' }}>
                          {kpi.label}
                        </Text>
                      </View>
                      <Text style={{ ...theme.typography.h4, color: colorMap[occupancyColor], fontWeight: '700' }}>
                        {kpi.value}%
                      </Text>
                    </View>
                    <ProgressBar
                      progress={kpi.value}
                      color={occupancyColor}
                      height={6}
                    />
                  </Card>
                );
              })}
            </View>
          ) : (
            <EmptyState
              iconName="pie-chart-outline"
              title="Aucune donnee d'occupation"
              description="Les taux d'occupation seront affiches ici"
              compact
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
