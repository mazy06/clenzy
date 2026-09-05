import React from 'react';
import {
  HighlightList,
  HistogramChart,
  StatsBand,
  StatsLayout,
  TileGrid,
  TrendLineChart,
  tiles,
  type Highlight,
  type StatFigure,
  type TileOrNothing,
} from '../../components/stats';
import { useAnalyticsEngine } from '../../hooks/useAnalyticsEngine';
import { useTranslation } from '../../hooks/useTranslation';
import { getPropertyTypeLabel } from '../../utils/statusUtils';
import type { DashboardPeriod } from '../dashboard/DashboardDateFilter';
import { ReportFrame, useReportFormats } from './reportShell';

const NO_INTERVENTIONS: never[] = [];

/**
 * Onglet « Tarifs & prévisions ».
 *
 * <p>Trois mini-graphiques de 220 px et six vignettes serrées dans un tiers de
 * l'onglet Financier : les prévisions y étaient illisibles et les tarifs
 * n'avaient pas la place de montrer un écart. Ils tiennent l'écran, avec la
 * bande de confiance qui accompagne la projection.</p>
 */
const PricingReport: React.FC<{ period?: DashboardPeriod }> = ({ period = 'month' }) => {
  const { t } = useTranslation();
  const format = useReportFormats();
  const { analytics, loading } = useAnalyticsEngine({ period, interventions: NO_INTERVENTIONS });

  const pricing = analytics?.pricing;
  const forecast = analytics?.forecast;

  const figures: StatFigure[] = [
    {
      key: 'optimal',
      value: format.money(pricing?.optimalPrice ?? 0),
      label: t('reports.pricing.optimalPrice', 'de prix conseillé'),
    },
    {
      key: 'f30',
      value: format.money(forecast?.revenue30d ?? 0),
      label: t('reports.pricing.forecast30', 'prévus à 30 jours'),
    },
    {
      key: 'f90',
      value: format.money(forecast?.revenue90d ?? 0),
      label: t('reports.pricing.forecast90', 'à 90 jours'),
      muted: true,
    },
    {
      key: 'f365',
      value: format.money(forecast?.revenue365d ?? 0),
      label: t('reports.pricing.forecast365', 'à 12 mois'),
      muted: true,
    },
    {
      key: 'occ30',
      value: format.percent(forecast?.occupancy30d ?? 0),
      label: t('reports.pricing.forecastOccupancy', "d'occupation prévue"),
      muted: true,
    },
    {
      key: 'elasticity',
      value: (pricing?.elasticity ?? 0).toFixed(2),
      label: t('reports.pricing.elasticity', "d'élasticité prix"),
      muted: true,
    },
  ];

  const scenarios = forecast?.scenarios;
  const scenarioRows: Highlight[] = scenarios
    ? [scenarios.optimistic, scenarios.realistic, scenarios.pessimistic].map((s) => ({
        label: s.label,
        value: `${format.money(s.revenue)} · ${s.occupancy} %`,
      }))
    : [];

  const repere: Highlight[] = [
    {
      label: t('reports.pricing.optimalPriceRow', 'Prix conseillé par nuit'),
      value: format.money(pricing?.optimalPrice ?? 0),
    },
    {
      label: t('reports.pricing.elasticityRow', 'Élasticité prix / demande'),
      value: (pricing?.elasticity ?? 0).toFixed(2),
    },
    {
      label: t('reports.pricing.typesTracked', 'Types de bien tarifés'),
      value: `${pricing?.byPropertyType.length ?? 0}`,
    },
    {
      label: t('reports.pricing.forecastHorizon', 'Points de projection'),
      value: `${forecast?.chartData.length ?? 0}`,
    },
  ];

  const items = tiles([
    forecast && forecast.chartData.length > 0 && {
      key: 'forecast',
      title: t('reports.pricing.forecastChart', 'Projection de revenus'),
      hint: t(
        'reports.pricing.forecastHint',
        'Réalisé plein, projeté en pointillé — la fourchette est dans les scénarios',
      ),
      span: 2,
      render: () => (
        <TrendLineChart
          data={forecast.chartData.map((p) => ({ label: p.month, ...p }))}
          series={[
            { key: 'actual', label: t('reports.pricing.actual', 'Réalisé'), tokenIndex: 0 },
            {
              key: 'forecast',
              label: t('reports.pricing.forecastLabel', 'Projeté'),
              tokenIndex: 1,
              dashed: true,
            },
          ]}
          formatValue={format.moneyCompact}
        />
      ),
    },
    pricing && pricing.avgPriceVsRevPAN.length > 0 && {
      key: 'priceVsRevpan',
      title: t('reports.pricing.priceVsRevPAN', 'Prix moyen vs RevPAN'),
      hint: t('reports.pricing.priceVsRevPANHint', "L'écart entre les deux, c'est le vide"),
      render: () => (
        <TrendLineChart
          data={pricing.avgPriceVsRevPAN.map((p) => ({ label: p.month, ...p }))}
          series={[
            { key: 'avgPrice', label: t('reports.pricing.avgPrice', 'Prix moyen'), tokenIndex: 0 },
            { key: 'revPAN', label: 'RevPAN', tokenIndex: 1, dashed: true },
          ]}
          formatValue={format.moneyCompact}
          referenceValue={pricing.optimalPrice}
          referenceLabel={t('reports.pricing.optimalShort', 'Conseillé')}
        />
      ),
    },
    pricing && pricing.byPropertyType.length > 0 && {
      key: 'byType',
      title: t('reports.pricing.byType', 'Prix moyen par type de bien'),
      render: () => (
        <HistogramChart
          buckets={pricing.byPropertyType.map((p) => ({
            // Le moteur rend le type BRUT (`DUPLEX`, `APARTMENT`) : l'axe
            // affichait des constantes serveur en majuscules anglaises.
            label: getPropertyTypeLabel(p.type, t),
            count: Math.round(p.avgPrice),
          }))}
          label={t('reports.pricing.avgPrice', 'Prix moyen')}
          formatValue={format.moneyCompact}
          tokenIndex={1}
        />
      ),
    },
    scenarioRows.length > 0 && {
      key: 'scenarios',
      fluid: true,
      title: t('reports.pricing.scenarios', 'Scénarios à 12 mois'),
      hint: t('reports.pricing.scenariosHint', "Revenu et taux d'occupation"),
      render: () => <HighlightList items={scenarioRows} />,
    },
    {
      key: 'highlights',
      fluid: true,
      title: t('reports.pricing.highlights', 'Repères'),
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

export default PricingReport;
