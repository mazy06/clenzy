import React from 'react';
import StatusChip from '../../../components/StatusChip';
import { Card, CardContent } from '@mui/material';
import {
  PriceChange, CalendarMonth, Savings, Warning,
} from '../../../icons';
import GridSection from './GridSection';
import { useTranslation } from '../../../hooks/useTranslation';
import { Money } from '../../../components/Money';
import type { Recommendation, RecommendationType, RecommendationPriority } from '../../../hooks/useAnalyticsEngine';

// ─── Constants ──────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<RecommendationType, React.ReactNode> = {
  pricing: <PriceChange />,
  calendar: <CalendarMonth />,
  cost: <Savings />,
  risk: <Warning />,
};

const PRIORITY_COLORS: Record<RecommendationPriority, string> = {
  high: '#C97A7A',
  medium: '#D4A574',
  low: '#6B8A9A',
};

const TYPE_COLORS: Record<RecommendationType, string> = {
  pricing: '#6B8A9A',
  calendar: '#4A9B8E',
  cost: '#D4A574',
  risk: '#C97A7A',
};

const CARD_SX = {
  width: '100%',
  transition: 'border-color 0.15s ease',
  '&:hover': { borderColor: 'text.secondary' },
} as const;

interface Props {
  data: Recommendation[] | null;
  loading: boolean;
}

const AnalyticsRecommendations: React.FC<Props> = React.memo(({ data, loading }) => {
  const { t } = useTranslation();

  const recs = data || [];

  return (
    <GridSection
      title={t('dashboard.analytics.recommendations')}
      subtitle={t('dashboard.analytics.recommendationsDesc')}
      badge={recs.length}
    >
      <div className="grid grid-cols-12 gap-[9px]">
        {loading ? (
          // Skeleton placeholders
          Array.from({ length: 3 }).map((_, i) => (
            <div className="col-span-12" key={i}>
              <Card sx={{ ...CARD_SX, opacity: 0.5 }}>
                <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                  <div className="h-[80px]" />
                </CardContent>
              </Card>
            </div>
          ))
        ) : recs.length === 0 ? (
          <div className="col-span-12">
            <Card sx={CARD_SX}>
              <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                <p className="cn-text-body1 text-[0.75rem] text-muted-foreground text-center py-3">
                  {t('dashboard.analytics.noRecommendations')}
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          recs.map((rec) => (
            <div className="col-span-12" key={rec.id}>
              <Card sx={CARD_SX}>
                <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                  {/* Header: icon + title */}
                  <div className="flex items-start gap-1 mb-0.5">
                    {/* bg et couleur derivent du type a l'execution : style inline obligatoire */}
                    <div
                      className="flex items-center justify-center min-w-[28px] h-[28px] rounded-[6px] [&_.MuiSvgIcon-root]:text-[16px]"
                      style={{ backgroundColor: `${TYPE_COLORS[rec.type]}15`, color: TYPE_COLORS[rec.type] }}
                    >
                      {TYPE_ICONS[rec.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* line-clamp-N porte deja overflow/display/-webkit-box-orient */}
                      <p className="cn-text-body1 text-[0.75rem] font-bold text-[var(--ink)] leading-[1.3] text-ellipsis line-clamp-2">
                        {rec.title}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  {/* mb: 0.75 avec theme.spacing = 6 -> 4.5px, hors echelle Tailwind */}
                  <p className="cn-text-body1 text-[0.625rem] text-[var(--muted)] leading-[1.4] mb-[4.5px] text-ellipsis line-clamp-3">
                    {rec.description}
                  </p>

                  {/* Bottom row: impact + confidence + priority */}
                  <div className="flex items-center gap-0.5 flex-wrap">
                    <p className="cn-text-body1 text-[0.6875rem] font-bold text-[var(--bui-success-ink)] tabular-nums">
                      +<Money value={rec.estimatedImpact} from="EUR" decimals={0} />
                    </p>
                    <StatusChip size="sm" tokens={{ color: 'text.secondary', bg: 'rgba(107, 138, 154, 0.08)' }} label={`${rec.confidence}%`} className="text-[0.5625rem]" />
                    <div className="w-[6px] h-[6px] rounded-[50%] ms-auto" style={{ backgroundColor: PRIORITY_COLORS[rec.priority] }} title={rec.priority} />
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

AnalyticsRecommendations.displayName = 'AnalyticsRecommendations';

export default AnalyticsRecommendations;
