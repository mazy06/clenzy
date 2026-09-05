import React from 'react';
import {
  DonutChart,
  GroupedBarChart,
  HighlightList,
  HistogramChart,
  StatsBand,
  StatsLayout,
  TileGrid,
  tiles,
  type Highlight,
  type StatFigure,
  type TileOrNothing,
} from '../../components/stats';
import { useAnalyticsEngine } from '../../hooks/useAnalyticsEngine';
import { useTranslation } from '../../hooks/useTranslation';
import type { DashboardPeriod } from '../dashboard/DashboardDateFilter';
import { ReportFrame, scaleColor, useReportFormats } from './reportShell';

const NO_INTERVENTIONS: never[] = [];

/** Cible et seuil d'alerte d'un taux d'occupation, en points de pourcentage. */
const OCCUPANCY_GOOD = 60;
const OCCUPANCY_FAIR = 40;

/**
 * Onglet « Occupation ».
 *
 * <p>L'occupation était enterrée dans un accordéon de l'onglet Propriétés, à
 * côté de la maintenance : deux sujets qui n'ont pas le même interlocuteur.
 * Elle a son écran, parce que la nuit vacante est la seule marchandise
 * périssable du métier.</p>
 */
const OccupancyReport: React.FC<{ period?: DashboardPeriod }> = ({ period = 'month' }) => {
  const { t } = useTranslation();
  const format = useReportFormats();
  const { analytics, loading } = useAnalyticsEngine({ period, interventions: NO_INTERVENTIONS });

  const occupancy = analytics?.occupancy;
  const clients = analytics?.clients;
  const global = analytics?.global;

  const worst = [...(occupancy?.byProperty ?? [])].sort((a, b) => a.rate - b.rate)[0];
  const best = [...(occupancy?.byProperty ?? [])].sort((a, b) => b.rate - a.rate)[0];

  const figures: StatFigure[] = [
    {
      key: 'rate',
      value: format.percent(occupancy?.globalRate ?? 0),
      label: t('reports.occupancy.globalRate', "d'occupation"),
      delta: global ? Math.round(global.occupancyRate.growth) : null,
    },
    {
      key: 'gap',
      value: `${occupancy?.gapNights ?? 0}`,
      label: t('reports.occupancy.gapNights', 'nuits vacantes'),
    },
    {
      key: 'bookings',
      value: `${clients?.totalBookings ?? 0}`,
      label: t('reports.occupancy.bookings', 'réservations'),
    },
    {
      key: 'stay',
      value: (clients?.avgStayDuration ?? 0).toFixed(1),
      label: t('reports.occupancy.avgStay', 'nuits par séjour'),
      muted: true,
    },
    {
      key: 'guests',
      value: (clients?.avgGuestCount ?? 0).toFixed(1),
      label: t('reports.occupancy.avgGuests', 'voyageurs par séjour'),
      muted: true,
    },
  ];

  const repere: Highlight[] = [
    {
      label: t('reports.occupancy.bestProperty', 'Bien le mieux rempli'),
      value: best ? `${best.name} · ${Math.round(best.rate)} %` : '—',
    },
    {
      label: t('reports.occupancy.worstProperty', 'Bien le moins rempli'),
      value: worst ? `${worst.name} · ${Math.round(worst.rate)} %` : '—',
      alert: !!worst && worst.rate < OCCUPANCY_FAIR,
    },
    {
      label: t('reports.occupancy.belowTarget', 'Biens sous la cible de 60 %'),
      value: `${(occupancy?.byProperty ?? []).filter((p) => p.rate < OCCUPANCY_GOOD).length}`,
      alert: (occupancy?.byProperty ?? []).some((p) => p.rate < OCCUPANCY_GOOD),
    },
    {
      label: t('reports.occupancy.trackedProperties', 'Biens suivis'),
      value: `${occupancy?.byProperty.length ?? 0}`,
    },
  ];

  const items = tiles([
    occupancy && occupancy.byMonth.length > 0 && {
      key: 'byMonth',
      title: t('reports.occupancy.byMonth', 'Nuits occupées et vacantes'),
      hint: t('reports.occupancy.byMonthHint', 'La part claire est du stock invendu'),
      span: 2,
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
    occupancy && occupancy.byProperty.length > 0 && {
      key: 'byProperty',
      title: t('reports.occupancy.byProperty', 'Taux par bien'),
      hint: t('reports.occupancy.byPropertyHint', 'Rouge sous 40 %, ambre sous 60 %'),
      render: () => (
        <HistogramChart
          buckets={[...occupancy.byProperty]
            .sort((a, b) => b.rate - a.rate)
            .map((p) => ({ label: p.name, count: Math.round(p.rate) }))}
          label={t('reports.occupancy.rate', 'Occupation')}
          formatValue={format.percent}
          colorFor={(bucket) => scaleColor(bucket.count, OCCUPANCY_GOOD, OCCUPANCY_FAIR)}
          labelWidth={132}
        />
      ),
    },
    clients && clients.bySource.length > 0 && {
      key: 'sources',
      title: t('reports.occupancy.bySource', 'Réservations par source'),
      render: () => (
        <DonutChart
          buckets={clients.bySource.map((s) => ({ label: s.name, count: Math.round(s.value) }))}
          totalLabel={t('reports.occupancy.bookings', 'réservations')}
          otherLabel={t('reports.charts.others', 'Autres')}
        />
      ),
    },
    clients && clients.topProperties.length > 0 && {
      key: 'topProperties',
      title: t('reports.occupancy.topProperties', 'Biens les plus réservés'),
      render: () => (
        <HistogramChart
          buckets={clients.topProperties.map((p) => ({ label: p.name, count: p.bookings }))}
          label={t('reports.occupancy.bookings', 'réservations')}
          tokenIndex={1}
          labelWidth={132}
        />
      ),
    },
    {
      key: 'highlights',
      fluid: true,
      title: t('reports.occupancy.highlights', 'Repères'),
      hint: t('reports.occupancy.highlightsHint', 'Où le remplissage décroche'),
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

export default OccupancyReport;
