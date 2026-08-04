import React from 'react';
import { Card, CardContent } from '../../../components/ui';
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

/** Report en classes de `CHART_CARD_SX` / `CHART_CONTENT_SX` (p 1.25 = 7,5 px avec spacing 6). */
const CHART_CARD_CLASS = 'w-full h-[220px] gap-0 p-0';
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

/** Report en classes de `SECTION_LABEL_SX` (mb 0.5 = 3 px avec spacing 6). */
const SECTION_LABEL_CLASS =
  'cn-text-body1 text-[0.6875rem] font-bold uppercase tracking-[0.04em] text-[var(--muted)] mb-[3px] shrink-0';

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
      <div className="grid grid-cols-12 gap-[9px]">
        {/* Source distribution donut */}
        <div className="col-span-12 min-[600px]:col-span-6">
          <Card className={CHART_CARD_CLASS}>
            <CardContent className={CHART_CONTENT_CLASS}>
              <p className={SECTION_LABEL_CLASS}>
                {t('dashboard.analytics.bookingsBySource')}
              </p>
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
                        <div className="w-[8px] h-[8px] rounded-[2px] shrink-0" style={{ backgroundColor: ch.color }} />
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
        </div>

        {/* Top properties by popularity */}
        <div className="col-span-12 min-[600px]:col-span-6">
          <Card className={CHART_CARD_CLASS}>
            <CardContent className={CHART_CONTENT_CLASS}>
              <p className={SECTION_LABEL_CLASS}>
                {t('dashboard.analytics.topByPopularity')}
              </p>
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
        </div>

        {/* KPI cards */}
        <div className="col-span-6 min-[600px]:col-span-4">
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.avgStayDuration')}
            value={data ? `${data.avgStayDuration} ${t('dashboard.analytics.nights')}` : '-'}
            icon={<AccessTime color="info" />}
            loading={loading}
          />
        </div>
        <div className="col-span-6 min-[600px]:col-span-4">
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.avgGuestCount')}
            value={data ? `${data.avgGuestCount}` : '-'}
            subtitle={t('dashboard.analytics.guestsPerBooking')}
            icon={<People color="primary" />}
            loading={loading}
          />
        </div>
        <div className="col-span-6 min-[600px]:col-span-4">
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.totalBookings')}
            value={data ? `${data.totalBookings}` : '-'}
            icon={<Luggage color="success" />}
            loading={loading}
          />
        </div>
      </div>
    </GridSection>
  );
});

AnalyticsClientAnalysis.displayName = 'AnalyticsClientAnalysis';

export default AnalyticsClientAnalysis;
