import React from 'react';
import { Card, CardContent } from '../../../components/ui';
import { cn } from '../../../utils/cn';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart,
} from 'recharts';
import { Timeline, TrendingUp as TrendIcon } from '../../../icons';
import GridSection from './GridSection';
import AnalyticsWidgetCard from './AnalyticsWidgetCard';
import { useTranslation } from '../../../hooks/useTranslation';
import { useCurrency } from '../../../hooks/useCurrency';
import { Money } from '../../../components/Money';
import type { ForecastMetrics } from '../../../hooks/useAnalyticsEngine';

const AXIS_TICK = { fontSize: 10, fill: '#94A3B8' } as const;
const TOOLTIP_STYLE = { fontSize: 11, borderRadius: 6, border: '1px solid #E2E8F0', boxShadow: 'none' } as const;
const GRID_STROKE = '#F1F5F9';

// Report en classes des anciens `sx` de carte : la carte du kit porte deja son
// propre gabarit (rayon, anneau), seules la taille et la densite sont reprises.
// `gap-0 py-0` neutralise l'espacement vertical du primitif, l'ancienne carte
// MUI n'ayant que le padding de son CardContent (1.25 = 7,5 px, spacing 6).
const CHART_CARD_CLASS = 'w-full h-[220px] gap-0 py-0';
const CHART_CONTENT_CLASS = 'p-[7.5px] h-full flex flex-col';

const SECTION_LABEL_SX = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  color: 'text.secondary',
  mb: 0.5,
  flexShrink: 0,
} as const;

/** Report en classes de `SECTION_LABEL_SX` (mb 0.5 = 3 px, spacing 6). */
const SECTION_LABEL_CLASS =
  'text-[0.6875rem] font-bold uppercase tracking-[0.04em] text-[var(--muted)] mb-[3px] shrink-0';

interface Props {
  data: ForecastMetrics | null;
  loading: boolean;
}

const AnalyticsForecasts: React.FC<Props> = React.memo(({ data, loading }) => {
  const { t } = useTranslation();
  const { convertAndFormat } = useCurrency();

  return (
    <GridSection
      title={t('dashboard.analytics.forecasts')}
      subtitle={t('dashboard.analytics.forecastsDesc')}
    >
      <div className="grid grid-cols-12 gap-[9px]">
        {/* Forecast chart with confidence zone — left column */}
        <div className="col-span-12 min-[900px]:col-span-8">
          <Card className={CHART_CARD_CLASS}>
            <CardContent className={CHART_CONTENT_CLASS}>
              <p className={cn(SECTION_LABEL_CLASS, 'cn-text-body1')}>
                {t('dashboard.analytics.forecastChart')}
              </p>
              {loading || !data ? (
                <div className="flex-1 flex items-center justify-center">
                  <span className="cn-text-caption text-muted-foreground opacity-60">...</span>
                </div>
              ) : (
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.chartData} margin={{ top: 4, right: 6, left: -18, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis dataKey="month" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => convertAndFormat(Number(v), 'EUR')} />
                      {/* Confidence zone */}
                      <Area type="monotone" dataKey="upper" stroke="none" fill="#6B8A9A" fillOpacity={0.08} />
                      <Area type="monotone" dataKey="lower" stroke="none" fill="#ffffff" fillOpacity={1} />
                      {/* Actual line */}
                      <Line type="monotone" dataKey="actual" name={t('dashboard.analytics.actual')} stroke="#6B8A9A" strokeWidth={2} dot={{ r: 3 }} />
                      {/* Forecast line */}
                      <Line type="monotone" dataKey="forecast" name={t('dashboard.analytics.forecastLabel')} stroke="#4A9B8E" strokeWidth={1.5} strokeDasharray="6 3" dot={{ r: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — KPI cards + Scenarios */}
        <div className="col-span-12 min-[900px]:col-span-4">
          <div className="flex flex-col gap-2 h-full">
            {/* Forecast KPI cards stacked */}
            <AnalyticsWidgetCard
              title={t('dashboard.analytics.forecast30d')}
              value={data ? <Money value={data.revenue30d} from="EUR" /> : '-'}
              valueText={data ? convertAndFormat(data.revenue30d, 'EUR') : undefined}
              subtitle={t('dashboard.analytics.next30days')}
              icon={<Timeline color="primary" />}
              loading={loading}
            />
            <AnalyticsWidgetCard
              title={t('dashboard.analytics.forecast90d')}
              value={data ? <Money value={data.revenue90d} from="EUR" /> : '-'}
              valueText={data ? convertAndFormat(data.revenue90d, 'EUR') : undefined}
              subtitle={t('dashboard.analytics.next90days')}
              icon={<Timeline color="info" />}
              loading={loading}
            />
            <AnalyticsWidgetCard
              title={t('dashboard.analytics.forecast365d')}
              value={data ? <Money value={data.revenue365d} from="EUR" /> : '-'}
              valueText={data ? convertAndFormat(data.revenue365d, 'EUR') : undefined}
              subtitle={t('dashboard.analytics.next365days')}
              icon={<TrendIcon color="success" />}
              loading={loading}
            />

            {/* Scenarios mini-table */}
            <Card className="w-full flex-1 gap-0 py-0">
              <CardContent className="p-[7.5px]">
                <p className={cn(SECTION_LABEL_CLASS, 'cn-text-body1')}>
                  {t('dashboard.analytics.scenarios')}
                </p>
                {loading || !data ? (
                  <div className="h-[60px] flex items-center justify-center">
                    <span className="cn-text-caption text-muted-foreground opacity-60">...</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 mt-0.5">
                    {[data.scenarios.optimistic, data.scenarios.realistic, data.scenarios.pessimistic].map((s, i) => {
                      const colors = ['#4A9B8E', '#6B8A9A', '#C97A7A'];
                      return (
                        <div className="flex items-center gap-1" key={s.label}>
                          <div className="w-[8px] h-[8px] rounded-[50%] shrink-0" style={{ backgroundColor: colors[i] }} />
                          <div className="flex-1">
                            <p className="cn-text-body1 text-[0.6875rem] font-semibold text-foreground leading-[1.2]">
                              {s.label}
                            </p>
                            <p className="cn-text-body1 text-[0.5625rem] text-muted-foreground">
                              <Money value={s.revenue} from="EUR" decimals={0} /> • {s.occupancy}% occ.
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </GridSection>
  );
});

AnalyticsForecasts.displayName = 'AnalyticsForecasts';

export default AnalyticsForecasts;
