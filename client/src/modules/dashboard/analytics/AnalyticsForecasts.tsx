import React from 'react';
import { Box, Typography, Card, CardContent, Grid } from '@mui/material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart,
} from 'recharts';
import { Timeline, TrendingUp as TrendIcon } from '@mui/icons-material';
import GridSection from './GridSection';
import AnalyticsWidgetCard from './AnalyticsWidgetCard';
import { useTranslation } from '../../../hooks/useTranslation';
import type { ForecastMetrics } from '../../../hooks/useAnalyticsEngine';

const AXIS_TICK = { fontSize: 10, fill: '#94A3B8' } as const;
const TOOLTIP_STYLE = { fontSize: 11, borderRadius: 6, border: '1px solid #E2E8F0', boxShadow: 'none' } as const;
const GRID_STROKE = '#F1F5F9';

const CHART_CARD_SX = {
  width: '100%',
  height: 220,
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
  data: ForecastMetrics | null;
  loading: boolean;
}

const AnalyticsForecasts: React.FC<Props> = React.memo(({ data, loading }) => {
  const { t } = useTranslation();

  return (
    <GridSection
      title={t('dashboard.analytics.forecasts')}
      subtitle={t('dashboard.analytics.forecastsDesc')}
    >
      <Grid container spacing={1.5}>
        {/* Forecast KPI cards */}
        <Grid item xs={6} sm={4}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.forecast30d')}
            value={data ? `${data.revenue30d.toLocaleString('fr-FR')} €` : '-'}
            subtitle={t('dashboard.analytics.next30days')}
            icon={<Timeline color="primary" />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.forecast90d')}
            value={data ? `${data.revenue90d.toLocaleString('fr-FR')} €` : '-'}
            subtitle={t('dashboard.analytics.next90days')}
            icon={<Timeline color="info" />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.forecast365d')}
            value={data ? `${data.revenue365d.toLocaleString('fr-FR')} €` : '-'}
            subtitle={t('dashboard.analytics.next365days')}
            icon={<TrendIcon color="success" />}
            loading={loading}
          />
        </Grid>

        {/* Forecast chart with confidence zone */}
        <Grid item xs={12} md={8}>
          <Card sx={CHART_CARD_SX}>
            <CardContent sx={CHART_CONTENT_SX}>
              <Typography sx={SECTION_LABEL_SX}>
                {t('dashboard.analytics.forecastChart')}
              </Typography>
              {loading || !data ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.disabled">...</Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.chartData} margin={{ top: 4, right: 6, left: -18, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis dataKey="month" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${Number(v).toLocaleString('fr-FR')} €`} />
                      {/* Confidence zone */}
                      <Area type="monotone" dataKey="upper" stroke="none" fill="#6B8A9A" fillOpacity={0.08} />
                      <Area type="monotone" dataKey="lower" stroke="none" fill="#ffffff" fillOpacity={1} />
                      {/* Actual line */}
                      <Line type="monotone" dataKey="actual" name={t('dashboard.analytics.actual')} stroke="#6B8A9A" strokeWidth={2} dot={{ r: 3 }} />
                      {/* Forecast line */}
                      <Line type="monotone" dataKey="forecast" name={t('dashboard.analytics.forecastLabel')} stroke="#4A9B8E" strokeWidth={1.5} strokeDasharray="6 3" dot={{ r: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Scenarios mini-table */}
        <Grid item xs={12} md={4}>
          <Card sx={{ width: '100%' }}>
            <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
              <Typography sx={SECTION_LABEL_SX}>
                {t('dashboard.analytics.scenarios')}
              </Typography>
              {loading || !data ? (
                <Box sx={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.disabled">...</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.5 }}>
                  {[data.scenarios.optimistic, data.scenarios.realistic, data.scenarios.pessimistic].map((s, i) => {
                    const colors = ['#4A9B8E', '#6B8A9A', '#C97A7A'];
                    return (
                      <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colors[i], flexShrink: 0 }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: 'text.primary', lineHeight: 1.2 }}>
                            {s.label}
                          </Typography>
                          <Typography sx={{ fontSize: '0.5625rem', color: 'text.secondary' }}>
                            {s.revenue.toLocaleString('fr-FR')} € • {s.occupancy}% occ.
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </GridSection>
  );
});

AnalyticsForecasts.displayName = 'AnalyticsForecasts';

export default AnalyticsForecasts;
