import React from 'react';
import { Card, CardContent } from '@mui/material';
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

const CHART_CARD_SX = {
  width: '100%',
  height: 240,
} as const;

const CHART_CONTENT_SX = {
  p: 1.25,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  '&:last-child': { pb: 1.25 },
} as const;

const SECTION_LABEL_SX = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  color: 'text.secondary',
  mb: 0.5,
  flexShrink: 0,
} as const;

/** Report en classes de `SECTION_LABEL_SX` (mb 0.5 = 3 px, theme.spacing vaut 6). */
const SECTION_LABEL_CLASS =
  'cn-text-body1 text-[0.6875rem] font-bold uppercase tracking-[0.04em] text-[var(--muted)] mb-[3px] shrink-0';

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
        <div className="col-span-12 min-[900px]:col-span-6">
          <Card sx={CHART_CARD_SX}>
            <CardContent sx={CHART_CONTENT_SX}>
              <p className={SECTION_LABEL_CLASS}>
                {t('dashboard.analytics.portfolioVsBest')}
              </p>
              {loading || !data || data.radarData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <span className="cn-text-caption text-muted-foreground opacity-60">...</span>
                </div>
              ) : (
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={data.radarData}>
                      <PolarGrid stroke="#E2E8F0" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                      <PolarRadiusAxis tick={{ fontSize: 8, fill: '#CBD5E1' }} />
                      <Radar
                        name={t('dashboard.analytics.portfolioAvg')}
                        dataKey="portfolio"
                        stroke="#6B8A9A"
                        fill="#6B8A9A"
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                      />
                      <Radar
                        name={t('dashboard.analytics.bestProperty')}
                        dataKey="best"
                        stroke="#4A9B8E"
                        fill="#4A9B8E"
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
        <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-2">
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.portfolioAvg')}
            value={data ? <Money value={data.portfolioAvg.revPAN} from="EUR" decimals={2} /> : '-'}
            valueText={data ? convertAndFormat(data.portfolioAvg.revPAN, 'EUR') : undefined}
            subtitle={`${t('dashboard.analytics.occupancyRate')}: ${data?.portfolioAvg.occupancy ?? '-'}% • ${t('dashboard.analytics.netMargin')}: ${data?.portfolioAvg.margin ?? '-'}%`}
            icon={<Compare color="primary" />}
            loading={loading}
          />
        </div>

        {/* Best property */}
        <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-2">
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.bestProperty')}
            value={data ? data.bestProperty.name : '-'}
            subtitle={data ? `RevPAN: ${convertAndFormat(data.bestProperty.revPAN, 'EUR')} • Occ: ${data.bestProperty.occupancy}%` : ''}
            icon={<EmojiEvents color="warning" />}
            loading={loading}
          />
        </div>

        {/* Std dev */}
        <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-2">
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.perfDispersion')}
            value={data ? `${data.stdDevPerformance}` : '-'}
            subtitle={t('dashboard.analytics.perfDispersionDesc')}
            icon={<BarChartIcon color="info" />}
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
