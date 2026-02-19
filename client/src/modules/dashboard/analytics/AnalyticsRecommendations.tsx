import React from 'react';
import { Box, Typography, Card, CardContent, Chip, Grid } from '@mui/material';
import {
  PriceChange, CalendarMonth, Savings, Warning,
} from '@mui/icons-material';
import GridSection from './GridSection';
import { useTranslation } from '../../../hooks/useTranslation';
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
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card sx={{ ...CARD_SX, opacity: 0.5 }}>
                <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                  <Box sx={{ height: 80 }} />
                </CardContent>
              </Card>
            </Grid>
          ))
        ) : recs.length === 0 ? (
          <Grid item xs={12}>
            <Card sx={CARD_SX}>
              <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', textAlign: 'center', py: 2 }}>
                  {t('dashboard.analytics.noRecommendations')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          recs.map((rec) => (
            <Grid item xs={12} sm={6} md={4} key={rec.id}>
              <Card sx={CARD_SX}>
                <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                  {/* Header: icon + title */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mb: 0.5 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 28,
                        height: 28,
                        borderRadius: 0.75,
                        bgcolor: `${TYPE_COLORS[rec.type]}15`,
                        color: TYPE_COLORS[rec.type],
                        '& .MuiSvgIcon-root': { fontSize: 16 },
                      }}
                    >
                      {TYPE_ICONS[rec.type]}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
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
                    </Box>
                  </Box>

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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    <Typography
                      sx={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        color: 'success.main',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      +{rec.estimatedImpact.toLocaleString('fr-FR')} €
                    </Typography>
                    <Chip
                      label={`${rec.confidence}%`}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.5625rem',
                        fontWeight: 600,
                        bgcolor: 'rgba(107, 138, 154, 0.08)',
                        color: 'text.secondary',
                      }}
                    />
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: PRIORITY_COLORS[rec.priority],
                        ml: 'auto',
                      }}
                      title={rec.priority}
                    />
                  </Box>
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
