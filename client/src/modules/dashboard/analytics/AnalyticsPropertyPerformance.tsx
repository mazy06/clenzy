import React from 'react';
import { Box, Typography, Card, CardContent, LinearProgress, Grid } from '@mui/material';
import GridSection from './GridSection';
import { useTranslation } from '../../../hooks/useTranslation';
import type { PropertyPerformanceItem } from '../../../hooks/useAnalyticsEngine';

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

const VALUE_SX = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  color: 'text.primary',
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right' as const,
} as const;

interface Props {
  data: PropertyPerformanceItem[] | null;
  loading: boolean;
}

const AnalyticsPropertyPerformance: React.FC<Props> = React.memo(({ data, loading }) => {
  const { t } = useTranslation();

  const items = data || [];

  return (
    <GridSection
      title={t('dashboard.analytics.propertyPerformance')}
      subtitle={t('dashboard.analytics.propertyPerformanceDesc')}
    >
      <Grid container spacing={1.5}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card sx={{ ...CARD_SX, opacity: 0.5 }}>
                <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                  <Box sx={{ height: 120 }} />
                </CardContent>
              </Card>
            </Grid>
          ))
        ) : items.length === 0 ? (
          <Grid item xs={12}>
            <Card sx={CARD_SX}>
              <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 }, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', py: 2 }}>
                  {t('dashboard.analytics.noProperties')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          items.map((prop, index) => (
            <Grid item xs={12} sm={6} md={4} key={prop.propertyId}>
              <Card sx={CARD_SX}>
                <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                  {/* Rank + Name */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 22,
                        height: 22,
                        borderRadius: '50%',
                        bgcolor: index < 3 ? `${getScoreColor(prop.score)}15` : 'grey.100',
                        color: index < 3 ? getScoreColor(prop.score) : 'text.disabled',
                        fontSize: '0.625rem',
                        fontWeight: 700,
                      }}
                    >
                      #{index + 1}
                    </Box>
                    <Typography
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'text.primary',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {prop.name}
                    </Typography>
                  </Box>

                  {/* Score bar */}
                  <Box sx={{ mb: 0.75 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                      <Typography sx={{ fontSize: '0.5625rem', color: 'text.disabled' }}>Score</Typography>
                      <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: getScoreColor(prop.score) }}>
                        {prop.score}/100
                      </Typography>
                    </Box>
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
                  </Box>

                  {/* Metrics grid */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.375 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={LABEL_SX}>RevPAN</Typography>
                      <Typography sx={VALUE_SX}>{prop.revPAN.toFixed(2)} €</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={LABEL_SX}>{t('dashboard.analytics.occupancyRate')}</Typography>
                      <Typography sx={VALUE_SX}>{prop.occupancyRate}%</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={LABEL_SX}>{t('dashboard.analytics.totalRevenue')}</Typography>
                      <Typography sx={VALUE_SX}>{prop.revenue.toLocaleString('fr-FR')} €</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={LABEL_SX}>{t('dashboard.analytics.netMargin')}</Typography>
                      <Typography sx={{ ...VALUE_SX, color: prop.netMargin >= 60 ? 'success.main' : prop.netMargin >= 40 ? 'warning.main' : 'error.main' }}>
                        {prop.netMargin}%
                      </Typography>
                    </Box>
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

AnalyticsPropertyPerformance.displayName = 'AnalyticsPropertyPerformance';

export default AnalyticsPropertyPerformance;
