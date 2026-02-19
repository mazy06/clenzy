import React from 'react';
import { Box, Typography, Card, CardContent, Grid } from '@mui/material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import { PriceChange, TuneOutlined } from '@mui/icons-material';
import GridSection from './GridSection';
import AnalyticsWidgetCard from './AnalyticsWidgetCard';
import { useTranslation } from '../../../hooks/useTranslation';
import type { PricingMetrics } from '../../../hooks/useAnalyticsEngine';

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
  data: PricingMetrics | null;
  loading: boolean;
}

const AnalyticsPricingIntelligence: React.FC<Props> = React.memo(({ data, loading }) => {
  const { t } = useTranslation();

  return (
    <GridSection
      title={t('dashboard.analytics.pricingIntelligence')}
      subtitle={t('dashboard.analytics.pricingDesc')}
    >
      <Grid container spacing={1.5}>
        {/* Avg Price vs RevPAN dual-axis line chart */}
        <Grid item xs={12} sm={6}>
          <Card sx={CHART_CARD_SX}>
            <CardContent sx={CHART_CONTENT_SX}>
              <Typography sx={SECTION_LABEL_SX}>
                {t('dashboard.analytics.priceVsRevPAN')}
              </Typography>
              {loading || !data ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.disabled">...</Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.avgPriceVsRevPAN} margin={{ top: 4, right: 6, left: -18, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis dataKey="month" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${v} €`} />
                      <Line type="monotone" dataKey="avgPrice" name={t('dashboard.analytics.avgPrice')} stroke="#6B8A9A" strokeWidth={1.5} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="revPAN" name="RevPAN" stroke="#4A9B8E" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="5 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Price by property type */}
        <Grid item xs={12} sm={6}>
          <Card sx={CHART_CARD_SX}>
            <CardContent sx={CHART_CONTENT_SX}>
              <Typography sx={SECTION_LABEL_SX}>
                {t('dashboard.analytics.priceByType')}
              </Typography>
              {loading || !data ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.disabled">...</Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byPropertyType} margin={{ top: 4, right: 6, left: -18, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis dataKey="type" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${v} €`} />
                      <Bar dataKey="avgPrice" name={t('dashboard.analytics.avgPrice')} fill="#D4A574" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Optimal price card */}
        <Grid item xs={6} sm={4} md={3}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.optimalPrice')}
            value={data ? `${data.optimalPrice} €` : '-'}
            subtitle={t('dashboard.analytics.optimalPriceDesc')}
            icon={<PriceChange color="success" />}
            tooltip={t('dashboard.analytics.optimalPriceTooltip')}
            loading={loading}
          />
        </Grid>

        {/* Elasticity card */}
        <Grid item xs={6} sm={4} md={3}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.elasticity')}
            value={data ? `${data.elasticity.toFixed(2)}` : '-'}
            subtitle={t('dashboard.analytics.elasticityDesc')}
            icon={<TuneOutlined color="info" />}
            tooltip={t('dashboard.analytics.elasticityTooltip')}
            loading={loading}
          />
        </Grid>
      </Grid>
    </GridSection>
  );
});

AnalyticsPricingIntelligence.displayName = 'AnalyticsPricingIntelligence';

export default AnalyticsPricingIntelligence;
