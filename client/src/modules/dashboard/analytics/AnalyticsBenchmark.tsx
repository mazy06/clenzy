import React from 'react';
import { Box, Typography, Card, CardContent, Grid } from '@mui/material';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend,
} from 'recharts';
import { Compare, EmojiEvents, BarChart as BarChartIcon } from '@mui/icons-material';
import GridSection from './GridSection';
import AnalyticsWidgetCard from './AnalyticsWidgetCard';
import { useTranslation } from '../../../hooks/useTranslation';
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

interface Props {
  data: BenchmarkMetrics | null;
  loading: boolean;
}

const AnalyticsBenchmark: React.FC<Props> = React.memo(({ data, loading }) => {
  const { t } = useTranslation();

  return (
    <GridSection
      title={t('dashboard.analytics.benchmark')}
      subtitle={t('dashboard.analytics.benchmarkDesc')}
    >
      <Grid container spacing={1.5}>
        {/* Radar chart */}
        <Grid item xs={12} md={6}>
          <Card sx={CHART_CARD_SX}>
            <CardContent sx={CHART_CONTENT_SX}>
              <Typography sx={SECTION_LABEL_SX}>
                {t('dashboard.analytics.portfolioVsBest')}
              </Typography>
              {loading || !data || data.radarData.length === 0 ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.disabled">...</Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1, minHeight: 0 }}>
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
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Portfolio average */}
        <Grid item xs={6} sm={4} md={2}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.portfolioAvg')}
            value={data ? `${data.portfolioAvg.revPAN.toFixed(2)} €` : '-'}
            subtitle={`${t('dashboard.analytics.occupancyRate')}: ${data?.portfolioAvg.occupancy ?? '-'}% • ${t('dashboard.analytics.netMargin')}: ${data?.portfolioAvg.margin ?? '-'}%`}
            icon={<Compare color="primary" />}
            loading={loading}
          />
        </Grid>

        {/* Best property */}
        <Grid item xs={6} sm={4} md={2}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.bestProperty')}
            value={data ? data.bestProperty.name : '-'}
            subtitle={data ? `RevPAN: ${data.bestProperty.revPAN.toFixed(2)} € • Occ: ${data.bestProperty.occupancy}%` : ''}
            icon={<EmojiEvents color="warning" />}
            loading={loading}
          />
        </Grid>

        {/* Std dev */}
        <Grid item xs={6} sm={4} md={2}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.perfDispersion')}
            value={data ? `${data.stdDevPerformance}` : '-'}
            subtitle={t('dashboard.analytics.perfDispersionDesc')}
            icon={<BarChartIcon color="info" />}
            tooltip={t('dashboard.analytics.perfDispersionTooltip')}
            loading={loading}
          />
        </Grid>
      </Grid>
    </GridSection>
  );
});

AnalyticsBenchmark.displayName = 'AnalyticsBenchmark';

export default AnalyticsBenchmark;
