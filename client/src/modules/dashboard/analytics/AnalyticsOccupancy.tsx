import React from 'react';
import { Card, CardContent, Grid } from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { NightsStay } from '../../../icons';
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

// `mb: 0.5` avec theme.spacing = 6 vaut 3 px, pas un pas nomme de Tailwind.
const SECTION_LABEL_CLS =
  'cn-text-body1 text-[0.6875rem] font-bold uppercase tracking-[0.04em] text-[var(--muted)] mb-[3px] shrink-0';

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
              <p className={SECTION_LABEL_CLS}>
                {t('dashboard.analytics.occupancyByMonth')}
              </p>
              {loading || !data ? (
                <div className="flex-1 flex items-center justify-center">
                  <span className="cn-text-caption text-muted-foreground opacity-60">...</span>
                </div>
              ) : (
                <div className="flex-1 min-h-0">
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
                </div>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* By property horizontal bar */}
        <Grid item xs={12} sm={6}>
          <Card sx={CHART_CARD_SX}>
            <CardContent sx={CHART_CONTENT_SX}>
              <p className={SECTION_LABEL_CLS}>
                {t('dashboard.analytics.occupancyByProperty')}
              </p>
              {loading || !data ? (
                <div className="flex-1 flex items-center justify-center">
                  <span className="cn-text-caption text-muted-foreground opacity-60">...</span>
                </div>
              ) : (
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byProperty.slice(0, 6)} layout="vertical" margin={{ top: 4, right: 6, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                      <XAxis type="number" tick={AXIS_TICK} domain={[0, 100]} unit="%" />
                      <YAxis dataKey="name" type="category" tick={AXIS_TICK} width={90} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${v}%`} />
                      <Bar dataKey="rate" fill="#6B8A9A" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
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
              <p className={SECTION_LABEL_CLS}>
                {t('dashboard.analytics.heatmap')}
              </p>
              {loading || !data ? (
                <div className="h-[100px] flex items-center justify-center">
                  <span className="cn-text-caption text-muted-foreground opacity-60">...</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-0.5 mt-[3px]">
                  {data.heatmap.map((day) => (
                    <div
                      key={day.date}
                      // transform explicite : `scale-*` de Tailwind v4 ecrit la propriete
                      // `scale`, que la transition sur `transform` n'animerait pas.
                      className="w-[14px] h-[14px] rounded-[2px] [transition:transform_0.1s] hover:[transform:scale(1.3)]"
                      style={{ backgroundColor: getHeatmapColor(day.rate) }}
                      title={`${day.date}: ${Math.round(day.rate * 100)}%`}
                    />
                  ))}
                </div>
              )}
              {/* Legend */}
              <div className="flex gap-1 mt-1 items-center">
                {[
                  { label: '0%', color: '#F1F5F9' },
                  { label: '20%', color: '#C97A7A' },
                  { label: '50%', color: '#D4A574' },
                  { label: '80%', color: '#6B8A9A' },
                  { label: '100%', color: '#4A9B8E' },
                ].map((item) => (
                  <div className="flex items-center gap-0.5" key={item.label}>
                    <div className="w-[8px] h-[8px] rounded-[2px]" style={{ backgroundColor: item.color }} />
                    <p className="cn-text-body1 text-[0.5rem] text-muted-foreground opacity-60">{item.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </GridSection>
  );
});

AnalyticsOccupancy.displayName = 'AnalyticsOccupancy';

export default AnalyticsOccupancy;
