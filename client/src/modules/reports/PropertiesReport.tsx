import React from 'react';
import {
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
import { usePropertyReport } from './hooks/useReportData';
import { ReportFrame, scaleColor, useReportFormats } from './reportShell';

const NO_INTERVENTIONS: never[] = [];

/** Cible et seuil d'alerte d'un score de performance, sur 100. */
const SCORE_GOOD = 70;
const SCORE_FAIR = 45;

/**
 * Onglet « Biens ».
 *
 * <p>Deux lectures d'un même parc : ce que chaque bien COÛTE en exploitation, et
 * ce qu'il RAPPORTE au regard du reste du portefeuille. L'ancien onglet les
 * séparait par un accordéon « Analyses avancées » que personne n'ouvrait.</p>
 */
const PropertiesReport: React.FC<{ period?: DashboardPeriod }> = ({ period = 'month' }) => {
  const { t } = useTranslation();
  const format = useReportFormats();
  const { data, loading, error, retry } = usePropertyReport();
  const { analytics, loading: analyticsLoading } = useAnalyticsEngine({
    period,
    interventions: NO_INTERVENTIONS,
  });

  const stats = data?.propertyStats ?? [];
  const performance = analytics?.properties ?? [];
  const benchmark = analytics?.benchmark;

  const totalInterventions = stats.reduce((sum, p) => sum + p.interventions, 0);
  const totalCost = stats.reduce((sum, p) => sum + p.cost, 0);
  const avgCost = stats.length > 0 ? totalCost / stats.length : 0;
  const topActive = [...stats].sort((a, b) => b.interventions - a.interventions)[0];
  const bestScore = [...performance].sort((a, b) => b.score - a.score)[0];
  const worstScore = [...performance].sort((a, b) => a.score - b.score)[0];

  const figures: StatFigure[] = [
    {
      key: 'properties',
      value: analytics?.global.activeProperties ?? stats.length,
      label: t('reports.properties.active', 'biens suivis'),
    },
    {
      key: 'interventions',
      value: totalInterventions,
      label: t('reports.properties.interventions', 'interventions'),
    },
    {
      key: 'cost',
      value: format.money(totalCost),
      label: t('reports.properties.totalCost', "de coûts d'exploitation"),
    },
    {
      key: 'avgCost',
      value: format.money(avgCost),
      label: t('reports.properties.avgCost', 'par bien'),
      muted: true,
    },
    {
      key: 'revpan',
      value: format.money(benchmark?.portfolioAvg.revPAN ?? 0),
      label: t('reports.properties.avgRevpan', 'de RevPAN moyen'),
      muted: true,
    },
  ];

  const repere: Highlight[] = [
    {
      label: t('reports.properties.mostActive', 'Bien le plus sollicité'),
      value: topActive ? `${topActive.name} · ${topActive.interventions}` : '—',
    },
    {
      label: t('reports.properties.bestScore', 'Meilleur score de performance'),
      value: bestScore ? `${bestScore.name} · ${Math.round(bestScore.score)}/100` : '—',
    },
    {
      label: t('reports.properties.worstScore', 'Bien à redresser'),
      value: worstScore ? `${worstScore.name} · ${Math.round(worstScore.score)}/100` : '—',
      alert: !!worstScore && worstScore.score < SCORE_FAIR,
    },
    {
      label: t('reports.properties.benchmarkBest', 'Référence du portefeuille'),
      value: benchmark?.bestProperty.name ?? '—',
    },
    {
      label: t('reports.properties.dispersion', 'Dispersion des performances'),
      value: `${Math.round(benchmark?.stdDevPerformance ?? 0)}`,
      alert: (benchmark?.stdDevPerformance ?? 0) > 20,
    },
  ];

  const items = tiles([
    performance.length > 0 && {
      key: 'score',
      title: t('reports.properties.scoreByProperty', 'Score de performance par bien'),
      hint: t('reports.properties.scoreHint', 'Revenu, occupation et marge combinés, sur 100'),
      span: 2,
      render: () => (
        <HistogramChart
          buckets={[...performance]
            .sort((a, b) => b.score - a.score)
            .map((p) => ({ label: p.name, count: Math.round(p.score) }))}
          label={t('reports.properties.score', 'Score')}
          colorFor={(bucket) => scaleColor(bucket.count, SCORE_GOOD, SCORE_FAIR)}
          labelWidth={132}
        />
      ),
    },
    stats.length > 0 && {
      key: 'interventions',
      title: t('reports.charts.interventionsPerProperty'),
      render: () => (
        <HistogramChart
          buckets={[...stats]
            .sort((a, b) => b.interventions - a.interventions)
            .map((p) => ({ label: p.name, count: p.interventions }))}
          label={t('reports.charts.interventions')}
          labelWidth={132}
        />
      ),
    },
    stats.some((p) => p.cost > 0) && {
      key: 'cost',
      title: t('reports.properties.costByProperty', "Coût d'exploitation par bien"),
      render: () => (
        <HistogramChart
          buckets={[...stats]
            .sort((a, b) => b.cost - a.cost)
            .map((p) => ({ label: p.name, count: Math.round(p.cost) }))}
          label={t('reports.charts.cost')}
          formatValue={format.moneyCompact}
          tone="warning"
          labelWidth={132}
        />
      ),
    },
    performance.length > 0 && {
      key: 'margin',
      title: t('reports.properties.marginByProperty', 'Marge nette par bien'),
      hint: t('reports.properties.marginHint', 'Revenus moins coûts constatés'),
      render: () => (
        <HistogramChart
          buckets={[...performance]
            .sort((a, b) => b.netMargin - a.netMargin)
            .map((p) => ({ label: p.name, count: Math.round(p.netMargin) }))}
          label={t('reports.properties.margin', 'Marge nette')}
          formatValue={format.percent}
          colorFor={(bucket) => scaleColor(bucket.count, 30, 10)}
          labelWidth={132}
        />
      ),
    },
    benchmark && {
      key: 'benchmark',
      fluid: true,
      title: t('reports.properties.benchmark', 'Portefeuille vs meilleur bien'),
      hint: t('reports.properties.benchmarkHint', "L'écart dit ce qui reste à gagner"),
      render: () => (
        <HighlightList
          items={[
            {
              label: `RevPAN · ${t('reports.properties.average', 'moyenne')}`,
              value: `${format.money(benchmark.portfolioAvg.revPAN)} → ${format.money(benchmark.bestProperty.revPAN)}`,
            },
            {
              label: `${t('reports.occupancy.rate', 'Occupation')} · ${t('reports.properties.average', 'moyenne')}`,
              value: `${format.percent(benchmark.portfolioAvg.occupancy)} → ${format.percent(benchmark.bestProperty.occupancy)}`,
            },
            {
              label: `${t('reports.properties.margin', 'Marge nette')} · ${t('reports.properties.average', 'moyenne')}`,
              value: `${format.percent(benchmark.portfolioAvg.margin)} → ${format.percent(benchmark.bestProperty.margin)}`,
            },
            {
              label: t('reports.properties.benchmarkBest', 'Référence du portefeuille'),
              value: benchmark.bestProperty.name,
            },
          ]}
        />
      ),
    },
    {
      key: 'highlights',
      fluid: true,
      title: t('reports.properties.highlights', 'Repères'),
      render: () => <HighlightList items={repere} />,
    },
  ] as TileOrNothing[]);

  return (
    <ReportFrame loading={loading || analyticsLoading} error={error} onRetry={retry}>
      <StatsLayout>
        <StatsBand figures={figures} />
        <TileGrid items={items} />
      </StatsLayout>
    </ReportFrame>
  );
};

export default PropertiesReport;
