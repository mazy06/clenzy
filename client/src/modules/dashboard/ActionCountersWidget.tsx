import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Skeleton,
} from '@mui/material';
import {
  Warning,
  Payment,
  Assignment,
  Build,
  AccountBalance,
} from '../../icons';
import type { NavigateFunction } from 'react-router-dom';
import type { AlertItem, DashboardStats } from '../../types/dashboard';

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

// ─── Props ──────────────────────────────────────────────────────────────────

interface ActionCountersWidgetProps {
  alerts: AlertItem[];
  stats: DashboardStats | null;
  pendingPaymentsCount: number;
  pendingPayoutsCount: number;
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
  soft: string;
  route: string;
}

// ─── Stable sx constants ────────────────────────────────────────────────────

const COUNTER_CARD_SX = () => ({
  borderRadius: 'var(--radius-lg)',
  cursor: 'pointer',
  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    transform: 'translateY(-2px)',
    borderColor: 'var(--line-2)',
    boxShadow: 'var(--shadow-card)',
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '&:hover': { transform: 'none' },
  },
}) as const;

const CARD_CONTENT_SX = {
  p: 1.25,
  '&:last-child': { pb: 1.25 },
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 0.5,
} as const;

const ICON_CIRCLE_SX = (soft: string) => ({
  width: 32,
  height: 32,
  borderRadius: 'var(--radius-md)',
  bgcolor: soft,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}) as const;

const VALUE_SX = {
  fontFamily: 'var(--font-display)',
  fontSize: '1.15rem',
  fontWeight: 600,
  lineHeight: 1,
  letterSpacing: '-0.025em',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--ink)',
} as const;

const LABEL_SX = {
  fontSize: '0.625rem',
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
  pendingPayoutsCount,
  loading,
  navigate,
  t,
}) => {
  const counters = useMemo((): CounterItem[] => {
    const urgentAlert = alerts.find((a) => a.type === 'urgent');

    return [
      {
        key: 'urgencies',
        label: t('dashboard.actionCounters.urgencies'),
        value: urgentAlert?.count ?? 0,
        icon: <Warning size={16} strokeWidth={1.75} color='var(--err)' />,
        soft: 'var(--err-soft)',
        route: urgentAlert?.route ?? '/interventions?priority=URGENT',
      },
      {
        key: 'payments',
        label: t('dashboard.actionCounters.pendingPayments'),
        value: pendingPaymentsCount,
        icon: <Payment size={16} strokeWidth={1.75} color='var(--warn)' />,
        soft: 'var(--warn-soft)',
        route: '/billing',
      },
      {
        key: 'payouts',
        label: t('dashboard.actionCounters.pendingPayouts'),
        value: pendingPayoutsCount,
        icon: <AccountBalance size={16} strokeWidth={1.75} color='var(--ok)' />,
        soft: 'var(--ok-soft)',
        route: '/billing',
      },
      {
        key: 'requests',
        label: t('dashboard.actionCounters.pendingRequests'),
        value: stats?.serviceRequests.pending ?? 0,
        icon: <Assignment size={16} strokeWidth={1.75} color='var(--accent)' />,
        soft: 'var(--accent-soft)',
        route: '/service-requests',
      },
      {
        key: 'interventions',
        label: t('dashboard.actionCounters.todayInterventions'),
        value: stats?.interventions.today ?? 0,
        icon: <Build size={16} strokeWidth={1.75} color='var(--info)' />,
        soft: 'var(--info-soft)',
        route: '/interventions',
      },
    ];
  }, [alerts, stats, pendingPaymentsCount, pendingPayoutsCount, t]);

  const cardSx = useMemo(() => COUNTER_CARD_SX(), []);

  if (loading) {
    return (
      <Grid container spacing={1.5}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Grid item xs={6} sm key={i}>
            <Card sx={{ borderRadius: 'var(--radius-lg)' }}>
              <CardContent sx={CARD_CONTENT_SX}>
                <Skeleton variant="circular" width={32} height={32} />
                <Skeleton variant="text" width={32} height={22} />
                <Skeleton variant="text" width={50} height={12} />
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
        <Grid item xs={6} sm key={counter.key}>
          <Card
            sx={cardSx}
            onClick={() => navigate(counter.route)}
          >
            <CardContent sx={CARD_CONTENT_SX}>
              <Box sx={ICON_CIRCLE_SX(counter.soft)}>
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
