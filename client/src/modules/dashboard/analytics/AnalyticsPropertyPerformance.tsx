import React from 'react';
import { cn } from '../../../utils/cn';
import { Card, CardContent, LinearProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import GridSection from './GridSection';
import { useTranslation } from '../../../hooks/useTranslation';
import { Money } from '../../../components/Money';
import { propertiesApi } from '../../../services/api/propertiesApi';
import { periodToDays } from '../../../hooks/analyticsUtils';
import type { DashboardPeriod } from '../DashboardDateFilter';

// ─── Constants ──────────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score >= 80) return '#4A9B8E'; // success
  if (score >= 50) return '#D4A574'; // warning
  return '#C97A7A'; // error
}

const CARD_SX = {
  width: '100%',
  transition: 'border-color 0.15s ease',
  '&:hover': { borderColor: 'text.secondary' },
} as const;

const LABEL_SX = {
  fontSize: '0.5625rem',
  color: 'text.secondary',
  lineHeight: 1.2,
} as const;

/** Report en classes de `LABEL_SX`. */
const LABEL_CLASS = 'text-[0.5625rem] text-[var(--muted)] leading-[1.2]';

const VALUE_SX = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  color: 'text.primary',
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right' as const,
} as const;

/** Report en classes de `VALUE_SX`. */
const VALUE_CLASS = 'cn-text-body1 text-[0.6875rem] font-bold text-[var(--ink)] tabular-nums text-right';

interface Props {
  /** Fenêtre d'analyse dérivée de la période sélectionnée (défaut « mois »). */
  period?: DashboardPeriod;
}

const AnalyticsPropertyPerformance: React.FC<Props> = React.memo(({ period = 'month' }) => {
  const { t } = useTranslation();

  // Source de vérité serveur (occupation plafonnée, marge avec coûts réels) —
  // remplace le calcul front (interventions=[] → marge 100 %, occupation > 100 %).
  const days = periodToDays(period);
  const { data, isLoading: loading } = useQuery({
    queryKey: ['property-performance-summaries', days],
    queryFn: () => propertiesApi.getPerformanceSummaries(days),
    staleTime: 60_000,
  });

  const items = data || [];

  return (
    <GridSection
      title={t('dashboard.analytics.propertyPerformance')}
      subtitle={t('dashboard.analytics.propertyPerformanceDesc')}
    >
      <div className="grid grid-cols-12 gap-[9px]">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-4" key={i}>
              <Card sx={{ ...CARD_SX, opacity: 0.5 }}>
                <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                  <div className="h-[120px]" />
                </CardContent>
              </Card>
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="col-span-12">
            <Card sx={CARD_SX}>
              <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 }, textAlign: 'center' }}>
                <p className="cn-text-body1 text-[0.75rem] text-muted-foreground py-3">
                  {t('dashboard.analytics.noProperties')}
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          items.map((prop, index) => (
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-4" key={prop.propertyId}>
              <Card sx={CARD_SX}>
                <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                  {/* Rank + Name */}
                  <div className="flex items-center gap-1 mb-1">
                    <div className="flex items-center justify-center min-w-[22px] h-[22px] rounded-[50%] text-[0.625rem] font-bold" style={{ backgroundColor: index < 3 ? `${getScoreColor(prop.score)}15` : 'grey.100', color: index < 3 ? getScoreColor(prop.score) : 'text.disabled' }}>
                      #{index + 1}
                    </div>
                    <p className="cn-text-body1 text-[0.75rem] font-bold text-foreground overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                      {prop.name}
                    </p>
                  </div>

                  {/* Score bar */}
                  <div className="mb-1">
                    <div className="flex justify-between mb-0.5">
                      <p className="cn-text-body1 text-[0.5625rem] text-muted-foreground opacity-60">Score</p>
                      <p className="cn-text-body1 text-[0.625rem] font-bold" style={{ color: getScoreColor(prop.score) }}>
                        {prop.score}/100
                      </p>
                    </div>
                    <LinearProgress
                      variant="determinate"
                      value={prop.score}
                      sx={{
                        height: 4,
                        borderRadius: 2,
                        bgcolor: 'grey.100',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: getScoreColor(prop.score),
                          borderRadius: 2,
                        },
                      }}
                    />
                  </div>

                  {/* Metrics grid */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between">
                      <p className={cn(LABEL_CLASS, 'cn-text-body1')}>RevPAN</p>
                      <p className={VALUE_CLASS}><Money value={prop.revPan} from="EUR" decimals={2} /></p>
                    </div>
                    <div className="flex justify-between">
                      <p className={cn(LABEL_CLASS, 'cn-text-body1')}>{t('dashboard.analytics.occupancyRate')}</p>
                      <p className={VALUE_CLASS}>{Math.round(prop.occupancyRate)}%</p>
                    </div>
                    <div className="flex justify-between">
                      <p className={cn(LABEL_CLASS, 'cn-text-body1')}>{t('dashboard.analytics.totalRevenue')}</p>
                      <p className={VALUE_CLASS}><Money value={prop.revenue} from="EUR" decimals={0} /></p>
                    </div>
                    <div className="flex justify-between">
                      <p className={cn(LABEL_CLASS, 'cn-text-body1')}>{t('dashboard.analytics.netMargin')}</p>
                      {/* Couleur decidee a l'execution selon la marge : elle ne peut pas naitre
                          d'une classe Tailwind, d'ou le style inline (qui prime sur la classe). */}
                      <p
                        className={VALUE_CLASS}
                        style={{ color: prop.netMargin >= 60 ? 'var(--ok)' : prop.netMargin >= 40 ? 'var(--warn)' : 'var(--err)' }}
                      >
                        {Math.round(prop.netMargin)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>
    </GridSection>
  );
});

AnalyticsPropertyPerformance.displayName = 'AnalyticsPropertyPerformance';

export default AnalyticsPropertyPerformance;
