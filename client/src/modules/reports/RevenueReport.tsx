import React from 'react';
import {
  DonutChart,
  HighlightList,
  HistogramChart,
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
import { useFinancialReport } from './hooks/useReportData';
import { ReportFrame, useReportFormats } from './reportShell';

const NO_INTERVENTIONS: never[] = [];

/**
 * Onglet « Revenus ».
 *
 * <p>L'ancien onglet « Financier » portait tout : les KPI globaux, les alertes,
 * les recommandations, les tarifs, les prévisions ET les données comptables. Il
 * demandait quatre écrans de défilement pour une question — combien, d'où, et à
 * quel coût. Les alertes sont passées à la Synthèse, les tarifs et prévisions à
 * leur propre onglet ; il ne reste ici que l'argent.</p>
 */
const RevenueReport: React.FC<{ period?: DashboardPeriod }> = ({ period = 'month' }) => {
  const { t } = useTranslation();
  const format = useReportFormats();
  const { analytics, loading } = useAnalyticsEngine({ period, interventions: NO_INTERVENTIONS });
  const financial = useFinancialReport();

  const global = analytics?.global;
  const revenue = analytics?.revenue;

  const figures: StatFigure[] = [
    {
      key: 'total',
      value: format.money(global?.totalRevenue.value ?? 0),
      label: t('reports.revenue.total', 'de revenus'),
      delta: global ? Math.round(global.totalRevenue.growth) : null,
    },
    {
      key: 'margin',
      value: format.percent(global?.netMargin.value ?? 0),
      label: t('reports.revenue.margin', 'de marge nette'),
      delta: global ? Math.round(global.netMargin.growth) : null,
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
      key: 'perBooking',
      value: format.money(revenue?.avgRevenuePerBooking ?? 0),
      label: t('reports.revenue.perBooking', 'par réservation'),
      muted: true,
    },
    {
      key: 'roi',
      value: format.percent(global?.roi.value ?? 0),
      label: 'ROI',
      muted: true,
    },
  ];

  const repere: Highlight[] = [
    {
      label: t('reports.revenue.growth', 'Croissance vs période précédente'),
      value: `${(revenue?.revenueGrowth ?? 0) > 0 ? '+' : ''}${Math.round(revenue?.revenueGrowth ?? 0)} %`,
      alert: (revenue?.revenueGrowth ?? 0) < 0,
    },
    {
      label: t('reports.revenue.bookings', 'Réservations'),
      value: `${analytics?.clients.totalBookings ?? 0}`,
    },
    {
      label: t('reports.revenue.topProperty', 'Bien le plus rentable'),
      value: revenue?.byProperty[0]?.name ?? '—',
    },
    {
      label: t('reports.revenue.channels', 'Canaux actifs'),
      value: `${revenue?.byChannel.length ?? 0}`,
    },
    {
      label: t('reports.revenue.costCategories', 'Postes de coût'),
      value: `${financial.data?.costBreakdown.length ?? 0}`,
    },
  ];

  const items = tiles([
    revenue && {
      key: 'trend',
      title: t('reports.charts.revenueByMonth'),
      hint: t('reports.revenue.trendHint', 'Revenus, dépenses et bénéfice mois par mois'),
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
      title: t('reports.revenue.byChannel', 'Revenus par canal'),
      hint: t('reports.revenue.byChannelHint', 'Où la demande arrive'),
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
    revenue && revenue.byProperty.length > 0 && {
      key: 'properties',
      title: t('reports.revenue.byProperty', 'Revenus par bien'),
      render: () => (
        <HistogramChart
          buckets={revenue.byProperty.map((p) => ({ label: p.name, count: Math.round(p.revenue) }))}
          label={t('reports.charts.revenue')}
          formatValue={format.moneyCompact}
          tokenIndex={1}
          labelWidth={132}
        />
      ),
    },
    financial.data && financial.data.costBreakdown.length > 0 && {
      key: 'costs',
      title: t('reports.charts.costBreakdown'),
      hint: t('reports.revenue.costsHint', "Coûts d'intervention constatés"),
      render: () => (
        <DonutChart
          buckets={financial.data!.costBreakdown.map((c) => ({
            label: c.name,
            count: Math.round(c.value),
          }))}
          totalLabel={t('reports.charts.cost')}
          formatValue={format.money}
          formatTotal={format.moneyCompact}
          otherLabel={t('reports.charts.others', 'Autres')}
        />
      ),
    },
    {
      key: 'highlights',
      fluid: true,
      title: t('reports.revenue.highlights', 'Repères'),
      hint: t('reports.revenue.highlightsHint', 'Ce que les courbes ne disent pas'),
      render: () => <HighlightList items={repere} />,
    },
  ] as TileOrNothing[]);

  return (
    <ReportFrame loading={loading} error={financial.error} onRetry={financial.retry}>
      <StatsLayout>
        <StatsBand figures={figures} />
        <TileGrid items={items} />
      </StatsLayout>
    </ReportFrame>
  );
};

export default RevenueReport;
