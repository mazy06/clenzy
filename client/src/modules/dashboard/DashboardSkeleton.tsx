import React from 'react';
import { Box, Grid, Skeleton, Card, CardContent, Typography, useTheme } from '@mui/material';

// ─── Skeleton card matching AnalyticsWidgetCard dimensions ──────────────────

const KpiCardSkeleton: React.FC = () => (
  <Card
    variant="outlined"
    sx={{
      height: '100%',
      borderRadius: '12px',
      boxShadow: 'none',
      border: '1px solid',
      borderColor: 'divider',
    }}
  >
    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Skeleton variant="circular" width={28} height={28} />
        <Skeleton variant="text" width="60%" height={16} />
      </Box>
      <Skeleton variant="text" width="40%" height={32} sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width="55%" height={14} />
    </CardContent>
  </Card>
);

// ─── Skeleton block for a section (title + content area) ────────────────────

const SectionSkeleton: React.FC<{ height?: number; titleWidth?: string }> = ({
  height = 180,
  titleWidth = '35%',
}) => (
  <Card
    variant="outlined"
    sx={{
      borderRadius: '12px',
      boxShadow: 'none',
      border: '1px solid',
      borderColor: 'divider',
      overflow: 'hidden',
    }}
  >
    <CardContent sx={{ p: 2 }}>
      <Skeleton variant="text" width={titleWidth} height={22} sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width="50%" height={14} sx={{ mb: 2 }} />
      <Skeleton variant="rectangular" width="100%" height={height} sx={{ borderRadius: 1 }} />
    </CardContent>
  </Card>
);

// ─── Sidebar skeleton ───────────────────────────────────────────────────────

const SidebarSkeleton: React.FC = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    {[110, 140, 120].map((h, i) => (
      <Card
        key={i}
        variant="outlined"
        sx={{
          borderRadius: '12px',
          boxShadow: 'none',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <CardContent sx={{ p: 1.5 }}>
          <Skeleton variant="text" width="60%" height={18} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" width="100%" height={h} sx={{ borderRadius: 1 }} />
        </CardContent>
      </Card>
    ))}
  </Box>
);

// ─── Main Dashboard Skeleton ────────────────────────────────────────────────

interface DashboardSkeletonProps {
  showFinancialKpis?: boolean;
  showSidebar?: boolean;
  showServices?: boolean;
}

const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({
  showFinancialKpis = true,
  showSidebar = true,
  showServices = true,
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        pt: 1.5,
        pb: 2,
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          flexDirection: { xs: 'column', lg: 'row' },
          alignItems: 'flex-start',
        }}
      >
        {/* ── LEFT COLUMN ── */}
        <Box sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Services status skeleton */}
          {showServices && (
            <Card
              variant="outlined"
              sx={{
                borderRadius: '12px',
                boxShadow: 'none',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <Box key={i} sx={{ flex: 1 }}>
                      <Skeleton variant="rectangular" height={52} sx={{ borderRadius: 1.5 }} />
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* KPI cards skeleton */}
          <Card
            variant="outlined"
            sx={{
              borderRadius: '12px',
              boxShadow: 'none',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent sx={{ p: 2 }}>
              <Skeleton variant="text" width="25%" height={22} sx={{ mb: 0.5 }} />
              <Skeleton variant="text" width="40%" height={14} sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                {Array.from({ length: showFinancialKpis ? 6 : 6 }).map((_, i) => (
                  <Grid item xs={6} sm={4} md={showFinancialKpis ? 2 : 4} key={i}>
                    <KpiCardSkeleton />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* Command center skeleton (planning + counters) */}
          <SectionSkeleton height={200} titleWidth="30%" />

          {/* Action counters skeleton */}
          <Card
            variant="outlined"
            sx={{
              borderRadius: '12px',
              boxShadow: 'none',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Box key={i} sx={{ flex: 1 }}>
                    <Skeleton variant="rectangular" height={64} sx={{ borderRadius: 1.5 }} />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* ── RIGHT COLUMN (sidebar) ── */}
        {showSidebar && (
          <Box
            sx={{
              flex: '0 0 auto',
              width: { xs: '100%', lg: 280 },
              minWidth: 0,
            }}
          >
            <SidebarSkeleton />
          </Box>
        )}
      </Box>
    </Box>
  );
};

DashboardSkeleton.displayName = 'DashboardSkeleton';

export default React.memo(DashboardSkeleton);
