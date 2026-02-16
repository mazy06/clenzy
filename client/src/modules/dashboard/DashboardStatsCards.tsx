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
  Star
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

const DashboardStatsCards: React.FC<DashboardStatsCardsProps> = React.memo(({ stats, loading, error, navigate }) => {
  return (
    <Grid container spacing={1.5} sx={{ mb: 0.5 }}>
      {loading ? (
        Array.from({ length: 4 }).map((_, index) => (
          <Grid item xs={6} sm={6} md={3} key={index}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Skeleton variant="rectangular" width={36} height={36} sx={{ borderRadius: 1 }} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="60%" height={22} sx={{ mb: 0.25 }} />
                    <Skeleton variant="text" width="80%" height={14} />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))
      ) : error ? (
        <Grid item xs={12}>
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        </Grid>
      ) : (
        stats.map((stat, index) => (
          <Grid item xs={6} sm={6} md={3} key={index}>
            <Card
              sx={{
                height: '100%',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 4,
                }
              }}
            >
              <CardActionArea onClick={() => navigate(stat.route)}>
                <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {/* Icone */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 36,
                        height: 36,
                        borderRadius: 1,
                        bgcolor: 'rgba(166, 192, 206, 0.1)',
                        '& .MuiSvgIcon-root': {
                          fontSize: 20,
                        }
                      }}
                    >
                      {stat.icon}
                    </Box>

                    {/* Contenu principal */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="h6"
                        component="div"
                        sx={{
                          fontWeight: 700,
                          lineHeight: 1.2,
                          mb: 0.125,
                          fontSize: { xs: '0.9375rem', sm: '1rem' }
                        }}
                      >
                        {stat.value}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontSize: '0.6875rem',
                          lineHeight: 1.2,
                          mb: 0.125,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {stat.title}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {stat.growth.type === 'up' ? (
                          <TrendingUp color="success" sx={{ fontSize: 12 }} />
                        ) : stat.growth.type === 'down' ? (
                          <TrendingDown color="error" sx={{ fontSize: 12 }} />
                        ) : (
                          <Star color="info" sx={{ fontSize: 12 }} />
                        )}
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            color: stat.growth.type === 'up'
                              ? 'success.main'
                              : stat.growth.type === 'down'
                              ? 'error.main'
                              : 'text.secondary'
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
