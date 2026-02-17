import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Skeleton,
  Alert
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Remove,
} from '@mui/icons-material';
import type { NavigateFunction } from 'react-router-dom';

export interface StatItem {
  title: string;
  value: string;
  icon: React.ReactNode;
  growth: { value: string; type: 'up' | 'down' | 'neutral' };
  route: string;
}

interface DashboardStatsCardsProps {
  stats: StatItem[];
  loading: boolean;
  error: string | null;
  navigate: NavigateFunction;
}

// ─── Stable sx constants ────────────────────────────────────────────────────

const CARD_SX = {
  height: '100%',
  transition: 'border-color 0.15s ease',
  '&:hover': { borderColor: 'text.secondary' },
} as const;

const CARD_CONTENT_SX = { p: 1.25, '&:last-child': { pb: 1.25 } } as const;

const ICON_BOX_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 38,
  height: 38,
  borderRadius: 1,
  bgcolor: 'rgba(107, 138, 154, 0.07)',
  '& .MuiSvgIcon-root': { fontSize: 20 },
} as const;

const VALUE_SX = {
  fontWeight: 700,
  lineHeight: 1.2,
  letterSpacing: '-0.02em',
  fontSize: { xs: '1rem', sm: '1.125rem' },
  fontVariantNumeric: 'tabular-nums',
} as const;

const TITLE_SX = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  lineHeight: 1.2,
  letterSpacing: '0.02em',
  textTransform: 'uppercase' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  mt: 0.25,
} as const;

const GROWTH_SX = {
  fontSize: '0.625rem',
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '0.01em',
} as const;

const DashboardStatsCards: React.FC<DashboardStatsCardsProps> = React.memo(({ stats, loading, error, navigate }) => {
  return (
    <Grid container spacing={1} sx={{ mb: 0.5 }}>
      {loading ? (
        Array.from({ length: 4 }).map((_, index) => (
          <Grid item xs={6} sm={6} md={3} key={index}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={CARD_CONTENT_SX}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Skeleton variant="rectangular" width={34} height={34} sx={{ borderRadius: 1 }} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="50%" height={18} />
                    <Skeleton variant="text" width="70%" height={12} />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))
      ) : error ? (
        <Grid item xs={12}>
          <Alert severity="error" sx={{ mb: 1, fontSize: '0.75rem' }}>
            {error}
          </Alert>
        </Grid>
      ) : (
        stats.map((stat, index) => (
          <Grid item xs={6} sm={6} md={3} key={index}>
            <Card sx={CARD_SX}>
              <CardActionArea onClick={() => navigate(stat.route)}>
                <CardContent sx={CARD_CONTENT_SX}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {/* Icon */}
                    <Box sx={ICON_BOX_SX}>
                      {stat.icon}
                    </Box>

                    {/* Content */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="h6" component="div" sx={VALUE_SX}>
                        {stat.value}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={TITLE_SX}>
                        {stat.title}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.375, mt: 0.25 }}>
                        {stat.growth.type === 'up' ? (
                          <TrendingUp color="success" sx={{ fontSize: 11 }} />
                        ) : stat.growth.type === 'down' ? (
                          <TrendingDown color="error" sx={{ fontSize: 11 }} />
                        ) : (
                          <Remove sx={{ fontSize: 11, color: 'text.disabled' }} />
                        )}
                        <Typography
                          variant="caption"
                          sx={{
                            ...GROWTH_SX,
                            color: stat.growth.type === 'up'
                              ? 'success.main'
                              : stat.growth.type === 'down'
                              ? 'error.main'
                              : 'text.disabled',
                          }}
                        >
                          {stat.growth.value}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))
      )}
    </Grid>
  );
});

DashboardStatsCards.displayName = 'DashboardStatsCards';

export default DashboardStatsCards;
