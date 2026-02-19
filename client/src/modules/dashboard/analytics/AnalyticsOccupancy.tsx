import React from 'react';
import { Box, Typography, Card, CardContent, Grid } from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { NightsStay } from '@mui/icons-material';
import GridSection from './GridSection';
import AnalyticsWidgetCard from './AnalyticsWidgetCard';
import { useTranslation } from '../../../hooks/useTranslation';
import type { OccupancyMetrics } from '../../../hooks/useAnalyticsEngine';

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

// Heatmap color scale
function getHeatmapColor(rate: number): string {
  if (rate >= 0.8) return '#4A9B8E'; // success
  if (rate >= 0.5) return '#6B8A9A'; // primary
  if (rate >= 0.2) return '#D4A574'; // warning
  if (rate > 0) return '#C97A7A'; // error
  return '#F1F5F9'; // empty
}

interface Props {
  data: OccupancyMetrics | null;
  loading: boolean;
}

const AnalyticsOccupancy: React.FC<Props> = React.memo(({ data, loading }) => {
  const { t } = useTranslation();

  return (
    <GridSection
      title={t('dashboard.analytics.occupancy')}
      subtitle={t('dashboard.analytics.occupancyDesc')}
    >
      <Grid container spacing={1.5}>
        {/* Stacked bar: occupied vs vacant by month */}
        <Grid item xs={12} sm={6}>
          <Card sx={CHART_CARD_SX}>
            <CardContent sx={CHART_CONTENT_SX}>
              <Typography sx={SECTION_LABEL_SX}>
                {t('dashboard.analytics.occupancyByMonth')}
              </Typography>
              {loading || !data ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.disabled">...</Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byMonth} margin={{ top: 4, right: 6, left: -18, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis dataKey="month" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="occupied" name={t('dashboard.analytics.occupied')} fill="#4A9B8E" stackId="a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="vacant" name={t('dashboard.analytics.vacant')} fill="#E2E8F0" stackId="a" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* By property horizontal bar */}
        <Grid item xs={12} sm={6}>
          <Card sx={CHART_CARD_SX}>
            <CardContent sx={CHART_CONTENT_SX}>
              <Typography sx={SECTION_LABEL_SX}>
                {t('dashboard.analytics.occupancyByProperty')}
              </Typography>
              {loading || !data ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.disabled">...</Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byProperty.slice(0, 6)} layout="vertical" margin={{ top: 4, right: 6, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                      <XAxis type="number" tick={AXIS_TICK} domain={[0, 100]} unit="%" />
                      <YAxis dataKey="name" type="category" tick={AXIS_TICK} width={90} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${v}%`} />
                      <Bar dataKey="rate" fill="#6B8A9A" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Gap nights card */}
        <Grid item xs={12} sm={6} md={3}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.vacantNights')}
            value={data ? `${data.gapNights}` : '-'}
            subtitle={t('dashboard.analytics.vacantNightsDesc')}
            icon={<NightsStay color={data && data.gapNights > 20 ? 'error' : 'info'} />}
            loading={loading}
          />
        </Grid>

        {/* Heatmap calendar */}
        <Grid item xs={12} sm={6} md={9}>
          <Card sx={{ width: '100%' }}>
            <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
              <Typography sx={SECTION_LABEL_SX}>
                {t('dashboard.analytics.heatmap')}
              </Typography>
              {loading || !data ? (
                <Box sx={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.disabled">...</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '2px', mt: 0.5 }}>
                  {data.heatmap.map((day) => (
                    <Box
                      key={day.date}
                      sx={{
                        width: 14,
                        height: 14,
                        borderRadius: '2px',
                        bgcolor: getHeatmapColor(day.rate),
                        transition: 'transform 0.1s',
                        '&:hover': { transform: 'scale(1.3)' },
                      }}
                      title={`${day.date}: ${Math.round(day.rate * 100)}%`}
                    />
                  ))}
                </Box>
              )}
              {/* Legend */}
              <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, alignItems: 'center' }}>
                {[
                  { label: '0%', color: '#F1F5F9' },
                  { label: '20%', color: '#C97A7A' },
                  { label: '50%', color: '#D4A574' },
                  { label: '80%', color: '#6B8A9A' },
                  { label: '100%', color: '#4A9B8E' },
                ].map((item) => (
                  <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: item.color }} />
                    <Typography sx={{ fontSize: '0.5rem', color: 'text.disabled' }}>{item.label}</Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </GridSection>
  );
});

AnalyticsOccupancy.displayName = 'AnalyticsOccupancy';

export default AnalyticsOccupancy;
