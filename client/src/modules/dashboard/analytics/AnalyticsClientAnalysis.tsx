import React from 'react';
import { Box, Typography, Card, CardContent, Grid } from '@mui/material';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { People, AccessTime, Luggage } from '../../../icons';
import GridSection from './GridSection';
import AnalyticsWidgetCard from './AnalyticsWidgetCard';
import { useTranslation } from '../../../hooks/useTranslation';
import type { ClientMetrics } from '../../../hooks/useAnalyticsEngine';

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
  data: ClientMetrics | null;
  loading: boolean;
}

const AnalyticsClientAnalysis: React.FC<Props> = React.memo(({ data, loading }) => {
  const { t } = useTranslation();

  return (
    <GridSection
      title={t('dashboard.analytics.clientAnalysis')}
      subtitle={t('dashboard.analytics.clientAnalysisDesc')}
    >
      <Grid container spacing={1.5}>
        {/* Source distribution donut */}
        <Grid item xs={12} sm={6}>
          <Card sx={CHART_CARD_SX}>
            <CardContent sx={CHART_CONTENT_SX}>
              <Typography sx={SECTION_LABEL_SX}>
                {t('dashboard.analytics.bookingsBySource')}
              </Typography>
              {loading || !data ? (
                <div className="flex-1 flex items-center justify-center">
                  <span className="cn-text-caption text-muted-foreground opacity-60">...</span>
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.bySource}
                          cx="50%" cy="50%"
                          innerRadius="38%" outerRadius="62%"
                          paddingAngle={2} dataKey="value"
                          cornerRadius={3} stroke="none"
                        >
                          {data.bySource.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {data.bySource.map((ch) => (
                      <div className="flex items-center gap-0.5" key={ch.name}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: ch.color, flexShrink: 0 }} />
                        <p className="cn-text-body1 text-[0.5625rem] text-muted-foreground">
                          {ch.name} ({ch.value})
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Top properties by popularity */}
        <Grid item xs={12} sm={6}>
          <Card sx={CHART_CARD_SX}>
            <CardContent sx={CHART_CONTENT_SX}>
              <Typography sx={SECTION_LABEL_SX}>
                {t('dashboard.analytics.topByPopularity')}
              </Typography>
              {loading || !data ? (
                <div className="flex-1 flex items-center justify-center">
                  <span className="cn-text-caption text-muted-foreground opacity-60">...</span>
                </div>
              ) : (
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.topProperties} layout="vertical" margin={{ top: 4, right: 6, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                      <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} />
                      <YAxis dataKey="name" type="category" tick={AXIS_TICK} width={90} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="bookings" name={t('dashboard.analytics.bookings')} fill="#7BA3C2" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* KPI cards */}
        <Grid item xs={6} sm={4}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.avgStayDuration')}
            value={data ? `${data.avgStayDuration} ${t('dashboard.analytics.nights')}` : '-'}
            icon={<AccessTime color="info" />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.avgGuestCount')}
            value={data ? `${data.avgGuestCount}` : '-'}
            subtitle={t('dashboard.analytics.guestsPerBooking')}
            icon={<People color="primary" />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.totalBookings')}
            value={data ? `${data.totalBookings}` : '-'}
            icon={<Luggage color="success" />}
            loading={loading}
          />
        </Grid>
      </Grid>
    </GridSection>
  );
});

AnalyticsClientAnalysis.displayName = 'AnalyticsClientAnalysis';

export default AnalyticsClientAnalysis;
