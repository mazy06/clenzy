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
import { useTranslation } from '../../hooks/useTranslation';
import {
  getInterventionPriorityLabel,
  getInterventionStatusLabel,
} from '../../utils/statusUtils';
import { useInterventionReport } from './hooks/useReportData';
import { ReportFrame } from './reportShell';

/**
 * Onglet « Interventions ».
 *
 * <p>Les statuts et les priorités s'affichaient bruts — `COMPLETED`,
 * `IN_PROGRESS`, `URGENT` — sur les axes comme dans les légendes. Ils passent
 * maintenant par les libellés localisés du reste de l'application.</p>
 */
const InterventionsReport: React.FC = () => {
  const { t } = useTranslation();
  const { data, loading, error, retry } = useInterventionReport();

  const byStatus = (data?.byStatus ?? []).map((item) => ({
    label: getInterventionStatusLabel(item.name, t),
    count: item.value,
  }));
  const byType = (data?.byType ?? []).map((item) => ({ label: item.name, count: item.value }));
  const byPriority = (data?.byPriority ?? []).map((item) => ({
    label: getInterventionPriorityLabel(item.name, t),
    count: item.value,
  }));
  const byMonth = (data?.byMonth ?? []).map((m) => ({ label: m.month, ...m }));

  const total = byStatus.reduce((sum, s) => sum + s.count, 0);
  const valueOf = (status: string) => data?.byStatus.find((s) => s.name === status)?.value ?? 0;
  const completed = valueOf('COMPLETED');
  const pending = valueOf('PENDING');
  const inProgress = valueOf('IN_PROGRESS');
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const avgPerMonth =
    byMonth.length > 0
      ? Math.round(byMonth.reduce((sum, m) => sum + m.total, 0) / byMonth.length)
      : 0;
  const last = byMonth[byMonth.length - 1];
  const previous = byMonth[byMonth.length - 2];
  const monthTrend =
    previous && previous.total > 0
      ? Math.round(((last.total - previous.total) / previous.total) * 100)
      : null;

  const figures: StatFigure[] = [
    { key: 'total', value: total, label: t('reports.interventionsTab.total', 'interventions') },
    {
      key: 'rate',
      value: `${completionRate} %`,
      label: t('reports.interventionsTab.completionRate', 'de réalisation'),
    },
    {
      key: 'pending',
      value: pending,
      label: t('reports.charts.pending').toLowerCase(),
    },
    {
      key: 'inProgress',
      value: inProgress,
      label: t('reports.charts.inProgress').toLowerCase(),
      muted: true,
    },
    {
      key: 'avg',
      value: avgPerMonth,
      label: t('reports.interventionsTab.perMonth', 'par mois en moyenne'),
      muted: true,
      delta: monthTrend,
      deltaInverted: true,
    },
  ];

  const repere: Highlight[] = [
    {
      label: t('reports.interventionsTab.categories', 'Catégories couvertes'),
      value: `${byType.length}`,
    },
    {
      label: t('reports.interventionsTab.busiestMonth', 'Mois le plus chargé'),
      value:
        byMonth.length > 0
          ? (() => {
              const peak = [...byMonth].sort((a, b) => b.total - a.total)[0];
              return `${peak.label} · ${peak.total}`;
            })()
          : '—',
    },
    {
      label: t('reports.interventionsTab.backlog', 'Reste à traiter'),
      value: `${pending + inProgress}`,
      alert: pending + inProgress > 0,
    },
    {
      label: t('reports.interventionsTab.urgent', 'Priorité haute ou urgente'),
      value: `${(data?.byPriority ?? [])
        .filter((p) => p.name === 'HIGH' || p.name === 'URGENT')
        .reduce((sum, p) => sum + p.value, 0)}`,
      alert: true,
    },
  ];

  const items = tiles([
    byMonth.length > 0 && {
      key: 'trend',
      title: t('reports.charts.interventionsByMonth'),
      hint: t('reports.interventionsTab.trendHint', "L'écart entre total et terminées est l'arriéré"),
      span: 2,
      render: () => (
        <TrendAreaChart
          data={byMonth}
          series={[
            { key: 'total', label: t('reports.charts.total'), tokenIndex: 0 },
            { key: 'completed', label: t('reports.charts.completed'), tone: 'success' },
            { key: 'pending', label: t('reports.charts.pending'), tone: 'warning', dashed: true },
          ]}
        />
      ),
    },
    byStatus.length > 0 && {
      key: 'status',
      title: t('reports.charts.interventionsByStatus'),
      render: () => (
        <DonutChart
          buckets={byStatus}
          totalLabel={t('reports.charts.interventions')}
          otherLabel={t('reports.charts.others', 'Autres')}
        />
      ),
    },
    byType.length > 0 && {
      key: 'type',
      title: t('reports.charts.interventionsByType'),
      render: () => (
        <DonutChart
          buckets={byType}
          totalLabel={t('reports.charts.interventions')}
          otherLabel={t('reports.charts.others', 'Autres')}
        />
      ),
    },
    byPriority.length > 0 && {
      key: 'priority',
      title: t('reports.charts.interventionsByPriority'),
      render: () => (
        <HistogramChart
          buckets={byPriority}
          label={t('reports.charts.interventions')}
          tokenIndex={3}
        />
      ),
    },
    {
      key: 'highlights',
      fluid: true,
      title: t('reports.interventionsTab.highlights', 'Repères'),
      render: () => <HighlightList items={repere} />,
    },
  ] as TileOrNothing[]);

  return (
    <ReportFrame loading={loading} error={error} onRetry={retry}>
      <StatsLayout>
        <StatsBand figures={figures} />
        <TileGrid items={items} />
      </StatsLayout>
    </ReportFrame>
  );
};

export default InterventionsReport;
