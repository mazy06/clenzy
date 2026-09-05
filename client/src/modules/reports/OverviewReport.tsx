import React from 'react';
import {
  DonutChart,
  GroupedBarChart,
  HighlightList,
  StatsBand,
  StatsLayout,
  TileGrid,
  TrendAreaChart,
  tiles,
  type Highlight,
  type StatFigure,
  type TileOrNothing,
} from '../../components/stats';
import { useAnalyticsEngine } from '../../hooks/useAnalyticsEngine';
import { useTranslation } from '../../hooks/useTranslation';
import type { DashboardPeriod } from '../dashboard/DashboardDateFilter';
import { ReportFrame, SignalList, useReportFormats, type SignalItem } from './reportShell';

const NO_INTERVENTIONS: never[] = [];

/**
 * Onglet « Synthèse ».
 *
 * <p>Une page qui répond aux trois questions qu'on se pose en ouvrant les
 * rapports : combien la période a-t-elle rapporté, comment le parc a-t-il
 * tourné, et qu'est-ce qui appelle une décision. Les onglets suivants creusent ;
 * celui-ci oriente.</p>
 */
const OverviewReport: React.FC<{ period?: DashboardPeriod }> = ({ period = 'month' }) => {
  const { t } = useTranslation();
  const format = useReportFormats();
  const { analytics, loading } = useAnalyticsEngine({ period, interventions: NO_INTERVENTIONS });

  const global = analytics?.global;
  const revenue = analytics?.revenue;
  const occupancy = analytics?.occupancy;

  const figures: StatFigure[] = [
    {
      key: 'revenue',
      value: format.money(global?.totalRevenue.value ?? 0),
      label: t('reports.overview.totalRevenue', 'de revenus'),
      delta: global ? Math.round(global.totalRevenue.growth) : null,
    },
    {
      key: 'occupancy',
      value: format.percent(global?.occupancyRate.value ?? 0),
      label: t('reports.overview.occupancy', "d'occupation"),
      delta: global ? Math.round(global.occupancyRate.growth) : null,
    },
    {
      key: 'adr',
      value: format.money(global?.adr.value ?? 0),
      label: 'ADR',
      delta: global ? Math.round(global.adr.growth) : null,
    },
    {
      key: 'revpan',
      value: format.money(global?.revPAN.value ?? 0),
      label: 'RevPAN',
      delta: global ? Math.round(global.revPAN.growth) : null,
    },
    {
      key: 'margin',
      value: format.percent(global?.netMargin.value ?? 0),
      label: t('reports.overview.netMargin', 'de marge nette'),
      muted: true,
    },
    {
      key: 'stay',
      value: `${(global?.avgStayDuration.value ?? 0).toFixed(1)}`,
      label: t('reports.overview.avgStay', 'nuits par séjour'),
      muted: true,
    },
  ];

  const alerts: SignalItem[] = (analytics?.alerts ?? []).map((alert) => ({
    id: alert.id,
    tone: alert.severity,
    title: alert.title,
    description: alert.description,
    meta: alert.action,
  }));

  const recommendations: SignalItem[] = (analytics?.recommendations ?? []).map((reco) => ({
    id: reco.id,
    tone: reco.priority === 'high' ? 'warning' : reco.priority === 'medium' ? 'info' : 'success',
    title: reco.title,
    description: reco.description,
    meta: `${format.money(reco.estimatedImpact)} · ${reco.confidence} % ${t('reports.overview.confidence', 'de confiance')}`,
  }));

  const repere: Highlight[] = [
    {
      label: t('reports.overview.activeProperties', 'Biens actifs'),
      value: `${global?.activeProperties ?? 0}`,
    },
    {
      label: t('reports.overview.bookings', 'Réservations sur la période'),
      value: `${analytics?.clients.totalBookings ?? 0}`,
    },
    {
      label: t('reports.overview.gapNights', 'Nuits vacantes'),
      value: `${occupancy?.gapNights ?? 0}`,
      alert: (occupancy?.gapNights ?? 0) > 0,
    },
    {
      label: t('reports.overview.pendingRequests', 'Demandes en cours'),
      value: `${global?.pendingRequests ?? 0}`,
      alert: (global?.pendingRequests ?? 0) > 0,
    },
    {
      label: t('reports.overview.activeInterventions', 'Interventions en cours'),
      value: `${global?.activeInterventions ?? 0}`,
    },
    {
      label: 'ROI',
      value: format.percent(global?.roi.value ?? 0),
    },
  ];

  const items = tiles([
    revenue && {
      key: 'revenueTrend',
      title: t('reports.overview.revenueTrend', 'Revenus, dépenses et bénéfice'),
      hint: t('reports.overview.revenueTrendHint', 'Six derniers mois de séjour'),
      span: 2,
      render: () => (
        <TrendAreaChart
          data={revenue.byMonth.map((m) => ({ label: m.month, ...m }))}
          series={[
            { key: 'revenue', label: t('reports.charts.revenue'), tone: 'success' },
            { key: 'expenses', label: t('reports.charts.expenses'), tone: 'destructive' },
            { key: 'profit', label: t('reports.charts.profit'), tokenIndex: 0, dashed: true },
          ]}
          formatValue={format.moneyCompact}
        />
      ),
    },
    revenue && revenue.byChannel.length > 0 && {
      key: 'channels',
      title: t('reports.overview.byChannel', 'Revenus par canal'),
      render: () => (
        <DonutChart
          buckets={revenue.byChannel.map((c) => ({ label: c.name, count: Math.round(c.value) }))}
          totalLabel={t('reports.charts.revenue')}
          formatValue={format.money}
          formatTotal={format.moneyCompact}
          otherLabel={t('reports.charts.others', 'Autres')}
        />
      ),
    },
    occupancy && occupancy.byMonth.length > 0 && {
      key: 'occupancy',
      title: t('reports.overview.occupancyByMonth', 'Nuits occupées et vacantes'),
      hint: t('reports.overview.occupancyHint', 'Une barre haute et claire est du stock invendu'),
      render: () => (
        <GroupedBarChart
          data={occupancy.byMonth.map((m) => ({ label: m.month, ...m }))}
          series={[
            {
              key: 'occupied',
              label: t('reports.overview.occupied', 'Occupées'),
              tone: 'success',
              stackId: 'nights',
            },
            {
              key: 'vacant',
              label: t('reports.overview.vacant', 'Vacantes'),
              tone: 'warning',
              stackId: 'nights',
            },
          ]}
        />
      ),
    },
    {
      key: 'alerts',
      fluid: true,
      title: t('reports.overview.alerts', 'Ce qui appelle une décision'),
      hint: t('reports.overview.alertsHint', 'Alertes ouvertes sur la période'),
      render: () => (
        <SignalList
          items={alerts}
          emptyLabel={t('reports.overview.noAlerts', 'Aucune alerte sur la période.')}
        />
      ),
    },
    {
      key: 'recommendations',
      fluid: true,
      title: t('reports.overview.recommendations', 'Actions suggérées'),
      hint: t('reports.overview.recommendationsHint', 'Classées par impact estimé'),
      render: () => (
        <SignalList
          items={recommendations}
          emptyLabel={t('reports.overview.noRecommendations', 'Rien à suggérer pour le moment.')}
        />
      ),
    },
    {
      key: 'highlights',
      fluid: true,
      title: t('reports.overview.highlights', 'Repères'),
      hint: t('reports.overview.highlightsHint', "Ce que les courbes ne disent pas"),
      render: () => <HighlightList items={repere} />,
    },
  ] as TileOrNothing[]);

  return (
    <ReportFrame loading={loading}>
      <StatsLayout>
        <StatsBand figures={figures} />
        <TileGrid items={items} />
      </StatsLayout>
    </ReportFrame>
  );
};

export default OverviewReport;
