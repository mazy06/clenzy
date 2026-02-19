import React from 'react';
import { Box, Typography, Card, CardContent, Grid } from '@mui/material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import GridSection from './GridSection';
import AnalyticsWidgetCard from './AnalyticsWidgetCard';
import { useTranslation } from '../../../hooks/useTranslation';
import type { RevenueMetrics } from '../../../hooks/useAnalyticsEngine';

// ─── Chart constants (Clenzy palette) ────────────────────────────────────────

const AXIS_TICK = { fontSize: 10, fill: '#94A3B8' } as const;
const TOOLTIP_STYLE = { fontSize: 11, borderRadius: 6, border: '1px solid #E2E8F0', boxShadow: 'none' } as const;
const GRID_STROKE = '#F1F5F9';
const CHART_SUCCESS = '#4A9B8E';
const CHART_ERROR = '#C97A7A';

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
  data: RevenueMetrics | null;
  loading: boolean;
}

const AnalyticsRevenue: React.FC<Props> = React.memo(({ data, loading }) => {
  const { t } = useTranslation();

  return (
    <GridSection
      title={t('dashboard.analytics.revenue')}
      subtitle={t('dashboard.analytics.revenueDesc')}
    >
      <Grid container spacing={1.5}>
        {/* Revenue trend area chart */}
        <Grid item xs={12} sm={6}>
          <Card sx={CHART_CARD_SX}>
            <CardContent sx={CHART_CONTENT_SX}>
              <Typography sx={SECTION_LABEL_SX}>
                {t('dashboard.analytics.revenueTrend')}
              </Typography>
              {loading || !data ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.disabled">...</Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.byMonth} margin={{ top: 4, right: 6, left: -18, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis dataKey="month" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${Number(v).toLocaleString('fr-FR')} €`} />
                      <Area type="monotone" dataKey="revenue" stroke={CHART_SUCCESS} fill={CHART_SUCCESS} fillOpacity={0.1} strokeWidth={1.5} />
                      <Area type="monotone" dataKey="expenses" stroke={CHART_ERROR} fill={CHART_ERROR} fillOpacity={0.08} strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Channel distribution donut */}
        <Grid item xs={12} sm={6}>
          <Card sx={CHART_CARD_SX}>
            <CardContent sx={CHART_CONTENT_SX}>
              <Typography sx={SECTION_LABEL_SX}>
                {t('dashboard.analytics.byChannel')}
              </Typography>
              {loading || !data ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.disabled">...</Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.byChannel}
                          cx="50%" cy="50%"
                          innerRadius="38%" outerRadius="62%"
                          paddingAngle={2} dataKey="value"
                          cornerRadius={3} stroke="none"
                        >
                          {data.byChannel.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${Number(v).toLocaleString('fr-FR')} €`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                  {/* Legend */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                    {data.byChannel.map((ch) => (
                      <Box key={ch.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.375 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: ch.color, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.5625rem', color: 'text.secondary' }}>
                          {ch.name}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Top properties bar chart */}
        <Grid item xs={12} sm={6}>
          <Card sx={CHART_CARD_SX}>
            <CardContent sx={CHART_CONTENT_SX}>
              <Typography sx={SECTION_LABEL_SX}>
                {t('dashboard.analytics.topProperties')}
              </Typography>
              {loading || !data ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.disabled">...</Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byProperty} layout="vertical" margin={{ top: 4, right: 6, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                      <XAxis type="number" tick={AXIS_TICK} />
                      <YAxis dataKey="name" type="category" tick={AXIS_TICK} width={90} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${Number(v).toLocaleString('fr-FR')} €`} />
                      <Bar dataKey="revenue" fill="#6B8A9A" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Avg revenue per booking */}
        <Grid item xs={12} sm={6} md={3}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.avgPerBooking')}
            value={data ? `${data.avgRevenuePerBooking.toLocaleString('fr-FR')} €` : '-'}
            trend={data ? { value: data.revenueGrowth } : undefined}
            tooltip={t('dashboard.analytics.avgPerBookingTooltip')}
            loading={loading}
          />
        </Grid>
      </Grid>
    </GridSection>
  );
});

AnalyticsRevenue.displayName = 'AnalyticsRevenue';

export default AnalyticsRevenue;
