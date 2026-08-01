import React from 'react';
import StatusChip from '../../../components/StatusChip';
import { Typography, Card, CardContent, Grid } from '@mui/material';
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
      <Grid container spacing={1.5}>
        {loading ? (
          // Skeleton placeholders
          Array.from({ length: 3 }).map((_, i) => (
            <Grid item xs={12} key={i}>
              <Card sx={{ ...CARD_SX, opacity: 0.5 }}>
                <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                  <div className="h-[80px]" />
                </CardContent>
              </Card>
            </Grid>
          ))
        ) : recs.length === 0 ? (
          <Grid item xs={12}>
            <Card sx={CARD_SX}>
              <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                <p className="cn-text-body1 text-[0.75rem] text-muted-foreground text-center py-3">
                  {t('dashboard.analytics.noRecommendations')}
                </p>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          recs.map((rec) => (
            <Grid item xs={12} key={rec.id}>
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
                      <Typography
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'text.primary',
                          lineHeight: 1.3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {rec.title}
                      </Typography>
                    </div>
                  </div>

                  {/* Description */}
                  <Typography
                    sx={{
                      fontSize: '0.625rem',
                      color: 'text.secondary',
                      lineHeight: 1.4,
                      mb: 0.75,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {rec.description}
                  </Typography>

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
            </Grid>
          ))
        )}
      </Grid>
    </GridSection>
  );
});

AnalyticsRecommendations.displayName = 'AnalyticsRecommendations';

export default AnalyticsRecommendations;
