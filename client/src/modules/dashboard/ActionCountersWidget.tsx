import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Skeleton,
  useTheme,
} from '@mui/material';
import {
  Warning,
  Payment,
  Assignment,
  Build,
} from '@mui/icons-material';
import type { NavigateFunction } from 'react-router-dom';
import type { AlertItem, DashboardStats } from '../../types/dashboard';

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

// ─── Props ──────────────────────────────────────────────────────────────────

interface ActionCountersWidgetProps {
  alerts: AlertItem[];
  stats: DashboardStats | null;
  pendingPaymentsCount: number;
  loading: boolean;
  navigate: NavigateFunction;
  t: TranslationFn;
}

// ─── Counter definition ─────────────────────────────────────────────────────

interface CounterItem {
  key: string;
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  route: string;
}

// ─── Stable sx constants ────────────────────────────────────────────────────

const COUNTER_CARD_SX = (isDark: boolean) => ({
  borderRadius: '12px',
  cursor: 'pointer',
  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    transform: 'translateY(-2px)',
    borderColor: 'primary.main',
    boxShadow: isDark
      ? '0 6px 20px rgba(0,0,0,0.25)'
      : '0 6px 20px rgba(107,138,154,0.15)',
  },
}) as const;

const CARD_CONTENT_SX = {
  p: 1.5,
  '&:last-child': { pb: 1.5 },
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 0.75,
} as const;

const ICON_CIRCLE_SX = (color: string) => ({
  width: 40,
  height: 40,
  borderRadius: '50%',
  bgcolor: `${color}14`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}) as const;

const VALUE_SX = {
  fontSize: '1.5rem',
  fontWeight: 700,
  lineHeight: 1,
  fontVariantNumeric: 'tabular-nums',
  color: 'text.primary',
} as const;

const LABEL_SX = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: 'text.secondary',
  textAlign: 'center',
  lineHeight: 1.2,
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

const ActionCountersWidget: React.FC<ActionCountersWidgetProps> = React.memo(({
  alerts,
  stats,
  pendingPaymentsCount,
  loading,
  navigate,
  t,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const counters = useMemo((): CounterItem[] => {
    const urgentAlert = alerts.find((a) => a.type === 'urgent');

    return [
      {
        key: 'urgencies',
        label: t('dashboard.actionCounters.urgencies'),
        value: urgentAlert?.count ?? 0,
        icon: <Warning sx={{ fontSize: 20, color: '#C97A7A' }} />,
        color: '#C97A7A',
        route: urgentAlert?.route ?? '/interventions?priority=URGENT',
      },
      {
        key: 'payments',
        label: t('dashboard.actionCounters.pendingPayments'),
        value: pendingPaymentsCount,
        icon: <Payment sx={{ fontSize: 20, color: '#D4A574' }} />,
        color: '#D4A574',
        route: '/billing',
      },
      {
        key: 'requests',
        label: t('dashboard.actionCounters.pendingRequests'),
        value: stats?.serviceRequests.pending ?? 0,
        icon: <Assignment sx={{ fontSize: 20, color: '#6B8A9A' }} />,
        color: '#6B8A9A',
        route: '/service-requests',
      },
      {
        key: 'interventions',
        label: t('dashboard.actionCounters.todayInterventions'),
        value: stats?.interventions.today ?? 0,
        icon: <Build sx={{ fontSize: 20, color: '#7BA3C2' }} />,
        color: '#7BA3C2',
        route: '/interventions',
      },
    ];
  }, [alerts, stats, pendingPaymentsCount, t]);

  const cardSx = useMemo(() => COUNTER_CARD_SX(isDark), [isDark]);

  if (loading) {
    return (
      <Grid container spacing={1.5}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Grid item xs={6} sm={3} key={i}>
            <Card sx={{ borderRadius: '12px' }}>
              <CardContent sx={CARD_CONTENT_SX}>
                <Skeleton variant="circular" width={40} height={40} />
                <Skeleton variant="text" width={40} height={28} />
                <Skeleton variant="text" width={60} height={14} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  return (
    <Grid container spacing={1.5}>
      {counters.map((counter) => (
        <Grid item xs={6} sm={3} key={counter.key}>
          <Card
            sx={cardSx}
            onClick={() => navigate(counter.route)}
          >
            <CardContent sx={CARD_CONTENT_SX}>
              <Box sx={ICON_CIRCLE_SX(counter.color)}>
                {counter.icon}
              </Box>
              <Typography sx={VALUE_SX}>
                {counter.value}
              </Typography>
              <Typography sx={LABEL_SX}>
                {counter.label}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
});

ActionCountersWidget.displayName = 'ActionCountersWidget';

export default ActionCountersWidget;
