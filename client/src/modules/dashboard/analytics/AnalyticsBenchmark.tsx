import React from 'react';
import { Card, CardContent, Skeleton } from '../../../components/ui';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend,
} from 'recharts';
import { Compare, EmojiEvents, BarChart as BarChartIcon } from '../../../icons';
import GridSection from './GridSection';
import AnalyticsWidgetCard from './AnalyticsWidgetCard';
import { useTranslation } from '../../../hooks/useTranslation';
import { useCurrency } from '../../../hooks/useCurrency';
import { Money } from '../../../components/Money';
import type { BenchmarkMetrics } from '../../../hooks/useAnalyticsEngine';

const LEGEND_STYLE = { fontSize: 10, letterSpacing: '0.02em' } as const;

/** Intitule de section — recette d'overline Baitly UI (§3 du contrat). */
const SECTION_LABEL_CLASS =
  'text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-[3px] shrink-0';

interface Props {
  data: BenchmarkMetrics | null;
  loading: boolean;
}

const AnalyticsBenchmark: React.FC<Props> = React.memo(({ data, loading }) => {
  const { t } = useTranslation();
  const { convertAndFormat } = useCurrency();

  return (
    <GridSection
      title={t('dashboard.analytics.benchmark')}
      subtitle={t('dashboard.analytics.benchmarkDesc')}
    >
      <div className="grid grid-cols-12 gap-[9px]">
        {/* Radar chart */}
        <div className="col-span-12 @[900px]:col-span-6">
          <Card className="w-full h-[240px] gap-0 p-0">
            <CardContent className="p-2 h-full flex flex-col">
              <p className={SECTION_LABEL_CLASS}>
                {t('dashboard.analytics.portfolioVsBest')}
              </p>
              {loading || !data || data.radarData.length === 0 ? (
                <div className="flex-1 min-h-0">
                  <Skeleton className="size-full rounded-lg" />
                </div>
              ) : (
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={data.radarData}>
                      <PolarGrid stroke="var(--bui-border)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: 'var(--bui-faint)' }} />
                      <PolarRadiusAxis tick={{ fontSize: 8, fill: 'var(--bui-faint)' }} />
                      <Radar
                        name={t('dashboard.analytics.portfolioAvg')}
                        dataKey="portfolio"
                        stroke="var(--bui-chart-1)"
                        fill="var(--bui-chart-1)"
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                      />
                      <Radar
                        name={t('dashboard.analytics.bestProperty')}
                        dataKey="best"
                        stroke="var(--bui-chart-2)"
                        fill="var(--bui-chart-2)"
                        fillOpacity={0.1}
                        strokeWidth={1.5}
                      />
                      <Legend wrapperStyle={LEGEND_STYLE} iconSize={6} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Portfolio average */}
        <div className="col-span-6 @[600px]:col-span-4 @[900px]:col-span-2">
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.portfolioAvg')}
            value={data ? <Money value={data.portfolioAvg.revPAN} from="EUR" decimals={2} /> : '-'}
            valueText={data ? convertAndFormat(data.portfolioAvg.revPAN, 'EUR') : undefined}
            subtitle={`${t('dashboard.analytics.occupancyRate')}: ${data?.portfolioAvg.occupancy ?? '-'}% • ${t('dashboard.analytics.netMargin')}: ${data?.portfolioAvg.margin ?? '-'}%`}
            icon={<Compare className="text-primary" />}
            loading={loading}
          />
        </div>

        {/* Best property */}
        <div className="col-span-6 @[600px]:col-span-4 @[900px]:col-span-2">
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.bestProperty')}
            value={data ? data.bestProperty.name : '-'}
            subtitle={data ? `RevPAN: ${convertAndFormat(data.bestProperty.revPAN, 'EUR')} • Occ: ${data.bestProperty.occupancy}%` : ''}
            icon={<EmojiEvents className="text-warning" />}
            loading={loading}
          />
        </div>

        {/* Std dev */}
        <div className="col-span-6 @[600px]:col-span-4 @[900px]:col-span-2">
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.perfDispersion')}
            value={data ? `${data.stdDevPerformance}` : '-'}
            subtitle={t('dashboard.analytics.perfDispersionDesc')}
            icon={<BarChartIcon className="text-info" />}
            tooltip={t('dashboard.analytics.perfDispersionTooltip')}
            loading={loading}
          />
        </div>
      </div>
    </GridSection>
  );
});

AnalyticsBenchmark.displayName = 'AnalyticsBenchmark';

export default AnalyticsBenchmark;
