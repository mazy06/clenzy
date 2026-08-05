import React from 'react';
import { Card, CardContent, Spinner } from '../../../components/ui';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import { PriceChange, TuneOutlined } from '../../../icons';
import GridSection from './GridSection';
import AnalyticsWidgetCard from './AnalyticsWidgetCard';
import { useTranslation } from '../../../hooks/useTranslation';
import { useCurrency } from '../../../hooks/useCurrency';
import { Money } from '../../../components/Money';
import type { PricingMetrics } from '../../../hooks/useAnalyticsEngine';

const AXIS_TICK = { fontSize: 10, fill: '#94A3B8' } as const;
const TOOLTIP_STYLE = { fontSize: 11, borderRadius: 6, border: '1px solid #E2E8F0', boxShadow: 'none' } as const;
const GRID_STROKE = '#F1F5F9';

const CHART_CARD_CLASS = 'w-full h-[220px]';

const CHART_CONTENT_CLASS = 'p-[7.5px] h-full flex flex-col';

/** Etiquette de section, rôle « overline » de l'échelle Baitly UI. */
const SECTION_LABEL_CLASS =
  'text-[0.6875rem] font-bold uppercase tracking-[0.04em] text-muted-foreground mb-[3px] shrink-0';

interface Props {
  data: PricingMetrics | null;
  loading: boolean;
}

const AnalyticsPricingIntelligence: React.FC<Props> = React.memo(({ data, loading }) => {
  const { t } = useTranslation();
  const { convertAndFormat } = useCurrency();

  return (
    <GridSection
      title={t('dashboard.analytics.pricingIntelligence')}
      subtitle={t('dashboard.analytics.pricingDesc')}
    >
      <div className="grid grid-cols-12 gap-[9px]">
        {/* Avg Price vs RevPAN dual-axis line chart */}
        <div className="col-span-12 min-[600px]:col-span-6">
          <Card className={CHART_CARD_CLASS}>
            <CardContent className={CHART_CONTENT_CLASS}>
              <p className={SECTION_LABEL_CLASS}>
                {t('dashboard.analytics.priceVsRevPAN')}
              </p>
              {loading || !data ? (
                <div className="flex-1 flex items-center justify-center">
                  <Spinner className="text-muted-foreground" />
                </div>
              ) : (
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.avgPriceVsRevPAN} margin={{ top: 4, right: 6, left: -18, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis dataKey="month" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => convertAndFormat(Number(v), 'EUR')} />
                      <Line type="monotone" dataKey="avgPrice" name={t('dashboard.analytics.avgPrice')} stroke="#6B8A9A" strokeWidth={1.5} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="revPAN" name="RevPAN" stroke="#4A9B8E" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="5 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Price by property type */}
        <div className="col-span-12 min-[600px]:col-span-6">
          <Card className={CHART_CARD_CLASS}>
            <CardContent className={CHART_CONTENT_CLASS}>
              <p className={SECTION_LABEL_CLASS}>
                {t('dashboard.analytics.priceByType')}
              </p>
              {loading || !data ? (
                <div className="flex-1 flex items-center justify-center">
                  <Spinner className="text-muted-foreground" />
                </div>
              ) : (
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byPropertyType} margin={{ top: 4, right: 6, left: -18, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis dataKey="type" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => convertAndFormat(Number(v), 'EUR')} />
                      <Bar dataKey="avgPrice" name={t('dashboard.analytics.avgPrice')} fill="#D4A574" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Optimal price card */}
        <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-3">
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.optimalPrice')}
            value={data ? <Money value={data.optimalPrice} from="EUR" decimals={0} /> : '-'}
            valueText={data ? convertAndFormat(data.optimalPrice, 'EUR') : undefined}
            subtitle={t('dashboard.analytics.optimalPriceDesc')}
            icon={<PriceChange className="text-success" />}
            tooltip={t('dashboard.analytics.optimalPriceTooltip')}
            loading={loading}
          />
        </div>

        {/* Elasticity card */}
        <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-3">
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.elasticity')}
            value={data ? `${data.elasticity.toFixed(2)}` : '-'}
            subtitle={t('dashboard.analytics.elasticityDesc')}
            icon={<TuneOutlined className="text-info" />}
            tooltip={t('dashboard.analytics.elasticityTooltip')}
            loading={loading}
          />
        </div>
      </div>
    </GridSection>
  );
});

AnalyticsPricingIntelligence.displayName = 'AnalyticsPricingIntelligence';

export default AnalyticsPricingIntelligence;
