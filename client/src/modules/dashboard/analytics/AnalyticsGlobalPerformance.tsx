import React from 'react';
import { Box, Card, CardContent, Grid, Typography, Skeleton } from '@mui/material';
import {
  Euro, Hotel, TrendingUp as TrendIcon, Percent,
  CalendarMonth, ShowChart, AccountBalance, Home,
  Assignment, Build,
  TrendingUp, TrendingDown, Remove,
} from '@mui/icons-material';
import { useTranslation } from '../../../hooks/useTranslation';
import type { GlobalKPIs } from '../../../hooks/useAnalyticsEngine';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Props {
  data: GlobalKPIs | null;
  loading: boolean;
}

interface KpiItem {
  key: string;
  title: string;
  value: string;
  subtitle?: string;
  trend?: number;
  icon: React.ReactNode;
  iconColor: string;
  tooltip?: string;
}

// ─── Stable sx constants ────────────────────────────────────────────────────

const HERO_CARD_SX = {
  height: '100%',
  transition: 'border-color 0.2s ease, transform 0.2s ease',
  '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
} as const;

const SECONDARY_CARD_SX = {
  transition: 'border-color 0.15s ease',
  '&:hover': { borderColor: 'text.secondary' },
} as const;

const SECTION_LABEL_SX = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: 'text.disabled',
  mb: 1,
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

const TrendBadge: React.FC<{ value: number }> = ({ value }) => {
  const isUp = value > 0;
  const isDown = value < 0;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Remove;
  const color = isUp ? 'success.main' : isDown ? 'error.main' : 'text.disabled';

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, mt: 0.25 }}>
      <Icon sx={{ fontSize: 12, color }} />
      <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>
        {isUp ? '+' : ''}{value}%
      </Typography>
    </Box>
  );
};

// ─── Hero KPI Card ──────────────────────────────────────────────────────────

const HeroKpiCard: React.FC<{ item: KpiItem; loading: boolean }> = ({ item, loading }) => (
  <Card sx={HERO_CARD_SX}>
    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
      {loading ? (
        <Box>
          <Skeleton variant="text" width="50%" height={14} />
          <Skeleton variant="text" width="70%" height={28} sx={{ mt: 0.5 }} />
          <Skeleton variant="text" width="40%" height={12} sx={{ mt: 0.5 }} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
            <Box
              sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 1,
                bgcolor: `${item.iconColor}12`,
                '& .MuiSvgIcon-root': { fontSize: 18, color: item.iconColor },
              }}
            >
              {item.icon}
            </Box>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: 'text.secondary', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              {item.title}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {item.value}
          </Typography>
          {item.subtitle && (
            <Typography sx={{ fontSize: '0.5625rem', color: 'text.disabled', mt: 0.25, lineHeight: 1.2 }}>
              {item.subtitle}
            </Typography>
          )}
          {item.trend !== undefined && <TrendBadge value={item.trend} />}
        </>
      )}
    </CardContent>
  </Card>
);

// ─── Secondary KPI row item ─────────────────────────────────────────────────

const SecondaryKpiRow: React.FC<{ item: KpiItem; loading: boolean }> = ({ item, loading }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1, px: 0.5 }}>
    <Box
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: 0.75, flexShrink: 0,
        bgcolor: `${item.iconColor}10`,
        '& .MuiSvgIcon-root': { fontSize: 15, color: item.iconColor },
      }}
    >
      {item.icon}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', fontWeight: 500, lineHeight: 1.2 }}>
        {item.title}
      </Typography>
    </Box>
    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
      {loading ? (
        <Skeleton variant="text" width={48} height={18} />
      ) : (
        <>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
            {item.value}
          </Typography>
          {item.trend !== undefined && <TrendBadge value={item.trend} />}
        </>
      )}
    </Box>
  </Box>
);

// ─── Component ──────────────────────────────────────────────────────────────

const AnalyticsGlobalPerformance: React.FC<Props> = React.memo(({ data, loading }) => {
  const { t } = useTranslation();

  // Hero KPIs (4 most important)
  const heroKpis: KpiItem[] = [
    {
      key: 'revenue',
      title: t('dashboard.analytics.totalRevenue'),
      value: data ? `${data.totalRevenue.value.toLocaleString('fr-FR')} €` : '-',
      trend: data?.totalRevenue.growth,
      icon: <TrendIcon />,
      iconColor: '#4A9B8E',
    },
    {
      key: 'occupancy',
      title: t('dashboard.analytics.occupancyRate'),
      value: data ? `${data.occupancyRate.value}%` : '-',
      trend: data?.occupancyRate.growth,
      icon: <Percent />,
      iconColor: '#4A9B8E',
      tooltip: t('dashboard.analytics.occupancyTooltip'),
    },
    {
      key: 'adr',
      title: 'ADR',
      value: data ? `${data.adr.value.toFixed(2)} €` : '-',
      subtitle: t('dashboard.analytics.avgDailyRate'),
      trend: data?.adr.growth,
      icon: <Hotel />,
      iconColor: '#6B8A9A',
      tooltip: t('dashboard.analytics.adrTooltip'),
    },
    {
      key: 'revpan',
      title: 'RevPAN',
      value: data ? `${data.revPAN.value.toFixed(2)} €` : '-',
      subtitle: t('dashboard.analytics.revenuePerNight'),
      trend: data?.revPAN.growth,
      icon: <Euro />,
      iconColor: '#7B68A8',
      tooltip: t('dashboard.analytics.revPANTooltip'),
    },
  ];

  // Financial secondary KPIs
  const financialKpis: KpiItem[] = [
    {
      key: 'margin',
      title: t('dashboard.analytics.netMargin'),
      value: data ? `${data.netMargin.value}%` : '-',
      trend: data?.netMargin.growth,
      icon: <AccountBalance />,
      iconColor: data && data.netMargin.value < 50 ? '#C97A7A' : '#4A9B8E',
    },
    {
      key: 'roi',
      title: 'ROI',
      value: data ? `${data.roi.value}%` : '-',
      trend: data?.roi.growth,
      icon: <ShowChart />,
      iconColor: '#6B8A9A',
    },
    {
      key: 'avgStay',
      title: t('dashboard.analytics.avgStay'),
      value: data ? `${data.avgStayDuration.value} ${t('dashboard.analytics.nights')}` : '-',
      trend: data?.avgStayDuration.growth,
      icon: <CalendarMonth />,
      iconColor: '#6B8A9A',
    },
  ];

  // Operational secondary KPIs
  const operationalKpis: KpiItem[] = [
    {
      key: 'properties',
      title: t('dashboard.analytics.activeProperties'),
      value: data ? `${data.activeProperties}` : '-',
      icon: <Home />,
      iconColor: '#6B8A9A',
    },
    {
      key: 'requests',
      title: t('dashboard.analytics.pendingRequests'),
      value: data ? `${data.pendingRequests}` : '-',
      icon: <Assignment />,
      iconColor: '#D4A574',
    },
    {
      key: 'interventions',
      title: t('dashboard.analytics.activeInterventions'),
      value: data ? `${data.activeInterventions}` : '-',
      icon: <Build />,
      iconColor: '#6B8A9A',
    },
  ];

  return (
    <Box sx={{ mb: 3 }}>
      {/* ─── Hero KPIs ───────────────────────────────────────────── */}
      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        {heroKpis.map((kpi) => (
          <Grid item xs={6} sm={3} key={kpi.key}>
            <HeroKpiCard item={kpi} loading={loading} />
          </Grid>
        ))}
      </Grid>

      {/* ─── Secondary KPIs (2 grouped cards) ────────────────────── */}
      <Grid container spacing={1.5}>
        {/* Financial group */}
        <Grid item xs={12} md={6}>
          <Card sx={SECONDARY_CARD_SX}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography sx={SECTION_LABEL_SX}>
                {t('dashboard.analytics.financialMetrics', 'Indicateurs financiers')}
              </Typography>
              {financialKpis.map((kpi, i) => (
                <React.Fragment key={kpi.key}>
                  {i > 0 && <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}
                  <SecondaryKpiRow item={kpi} loading={loading} />
                </React.Fragment>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Operational group */}
        <Grid item xs={12} md={6}>
          <Card sx={SECONDARY_CARD_SX}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography sx={SECTION_LABEL_SX}>
                {t('dashboard.analytics.operationalMetrics', 'Activite operationnelle')}
              </Typography>
              {operationalKpis.map((kpi, i) => (
                <React.Fragment key={kpi.key}>
                  {i > 0 && <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}
                  <SecondaryKpiRow item={kpi} loading={loading} />
                </React.Fragment>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
});

AnalyticsGlobalPerformance.displayName = 'AnalyticsGlobalPerformance';

export default AnalyticsGlobalPerformance;
