import React, { useMemo, useState, useEffect } from 'react';
import { Box, Grid, useTheme } from '@mui/material';
import {
  Percent,
  Euro,
  Hotel,
  TrendingUp as TrendIcon,
  Home,
  Build,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useDashboardOverview } from '../../hooks/useDashboardOverview';
import { useAnalyticsEngine } from '../../hooks/useAnalyticsEngine';
import { GridSection, AnalyticsWidgetCard } from './analytics';
import DashboardErrorBoundary from './DashboardErrorBoundary';
import DashboardEmptyState from './DashboardEmptyState';
import OnboardingChecklist from './OnboardingChecklist';
import ContractCTABanner from './ContractCTABanner';
import ChannelHealthWidget from './ChannelHealthWidget';
import ContextualTipsWidget from './ContextualTipsWidget';
import MiniPlanningWidget from './MiniPlanningWidget';
import ActionCountersWidget from './ActionCountersWidget';
import ServicesStatusWidget from './ServicesStatusWidget';
import AiUsageWidget from './AiUsageWidget';
import { useAiFeatureToggles } from '../../hooks/useAi';
import { pricingConfigApi } from '../../services/api/pricingConfigApi';
import { airbnbApi } from '../../services/api/airbnbApi';
import { channelConnectionApi } from '../../services/api/channelConnectionApi';
import type { DashboardPeriod } from './DashboardDateFilter';

// ─── Props ──────────────────────────────────────────────────────────────────

interface DashboardOverviewProps {
  period: DashboardPeriod;
  onNavigateTab?: (tabIndex: number) => void;
}

// ─── Empty interventions for analytics engine ───────────────────────────────

const EMPTY_INTERVENTIONS: Array<{
  estimatedCost?: number;
  actualCost?: number;
  type: string;
  status: string;
  scheduledDate?: string;
  createdAt?: string;
}> = [];

// ─── Hover lift wrapper sx (shared across all KPI cards) ────────────────────

const kpiHoverSx = (isDark: boolean) => ({
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  borderRadius: '12px',
  '&:hover': {
    transform: 'translateY(-3px)',
    '& > .MuiCard-root': {
      borderColor: 'primary.main',
      boxShadow: isDark
        ? '0 8px 24px rgba(0,0,0,0.25)'
        : '0 8px 24px rgba(107,138,154,0.15)',
    },
  },
}) as const;

// ─── Component ──────────────────────────────────────────────────────────────

const DashboardOverview: React.FC<DashboardOverviewProps> = React.memo(({ period, onNavigateTab }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { data: aiToggles } = useAiFeatureToggles();
  const hasAnyAiEnabled = useMemo(() => {
    if (!aiToggles) return true; // show by default while loading
    return aiToggles.some((t) => t.enabled);
  }, [aiToggles]);

  // ─── Roles ──────────────────────────────────────────────────────────────
  const isAdmin = user?.roles?.includes('SUPER_ADMIN') || false;
  const isManager = user?.roles?.includes('SUPER_MANAGER') || false;
  const isHost = user?.roles?.includes('HOST') || false;

  const userRole = useMemo(() => {
    if (user?.roles?.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
    if (user?.roles?.includes('SUPER_MANAGER')) return 'SUPER_MANAGER';
    if (user?.roles?.includes('SUPERVISOR')) return 'SUPERVISOR';
    if (user?.roles?.includes('TECHNICIAN')) return 'TECHNICIAN';
    if (user?.roles?.includes('HOUSEKEEPER')) return 'HOUSEKEEPER';
    if (user?.roles?.includes('HOST')) return 'HOST';
    if (user?.roles?.includes('LAUNDRY')) return 'LAUNDRY';
    if (user?.roles?.includes('EXTERIOR_TECH')) return 'EXTERIOR_TECH';
    return 'USER';
  }, [user?.roles]);

  // ─── Data sources ───────────────────────────────────────────────────────
  const {
    stats,
    alerts,
    pendingPaymentsCount,
    loading,
  } = useDashboardOverview({
    userRole,
    user,
    t,
    isAdmin,
    isManager,
    isHost,
    period,
  });

  const { analytics, loading: analyticsLoading } = useAnalyticsEngine({
    period,
    interventions: EMPTY_INTERVENTIONS,
  });

  // ─── Onboarding: wire hasPricing & hasChannels to real data ───────────
  const hasProperties = (stats?.properties.total ?? 0) > 0;
  const hasPropertyDetails = (stats?.properties.active ?? 0) > 0;

  const [hasPricing, setHasPricing] = useState(false);
  const [hasChannels, setHasChannels] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Check if pricing config exists
    (async () => {
      try {
        const config = await pricingConfigApi.get();
        if (!cancelled && config) setHasPricing(true);
      } catch {
        // No config yet — leave false
      }
    })();
    // Check if any channel is connected
    (async () => {
      try {
        const [airbnb, connections] = await Promise.allSettled([
          airbnbApi.getConnectionStatus(),
          channelConnectionApi.getAll(),
        ]);
        if (cancelled) return;
        const airbnbOk = airbnb.status === 'fulfilled' && airbnb.value.connected;
        const connectionsOk = connections.status === 'fulfilled' && connections.value.some((c) => c.connected);
        if (airbnbOk || connectionsOk) setHasChannels(true);
      } catch {
        // No channels — leave false
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isNewUser = !loading && !hasProperties;

  const globalData = analytics?.global ?? null;
  const isKpiLoading = loading || analyticsLoading;

  // Shared hover lift style
  const hoverLift = kpiHoverSx(isDark);

  // Show sidebar widgets? (admin/manager see channel health + tips + contract CTA)
  const showSidebar = isAdmin || isManager;

  // ─── New user: onboarding + empty state ─────────────────────────────────
  if (isNewUser) {
    return (
      <Box sx={{ pt: 1.5, pb: 2, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexDirection: { xs: 'column', lg: 'row' }, alignItems: 'flex-start' }}>
          <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
            <OnboardingChecklist
              hasProperties={hasProperties}
              hasPropertyDetails={hasPropertyDetails}
              hasPricing={hasPricing}
              hasChannels={hasChannels}
            />
          </Box>
          {showSidebar && (
            <Box sx={{ flex: '0 0 auto', width: { xs: '100%', lg: 280 }, minWidth: 0 }}>
              <ContractCTABanner />
            </Box>
          )}
        </Box>
        <DashboardEmptyState />
      </Box>
    );
  }

  // ─── Full dashboard ─────────────────────────────────────────────────────
  return (
    <Box sx={{ pt: 1.5, pb: 2, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

      {/* ═══ Two-column global layout ═══════════════════════════════════ */}
      <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', lg: 'row' }, alignItems: 'flex-start' }}>

        {/* ── LEFT COLUMN: all main content ────────────────────────── */}
        <Box sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* Onboarding checklist */}
          <OnboardingChecklist
            hasProperties={hasProperties}
            hasPropertyDetails={hasPropertyDetails}
            hasPricing={hasPricing}
            hasChannels={hasChannels}
          />

          {/* Services Status (noise, locks, keys) */}
          {onNavigateTab && (
            <DashboardErrorBoundary widgetName="ServicesStatus">
              <ServicesStatusWidget onNavigateTab={onNavigateTab} />
            </DashboardErrorBoundary>
          )}

          {/* KPIs */}
          <DashboardErrorBoundary widgetName="KPIs">
            <GridSection
              title={t('dashboard.overview.kpisTitle')}
              subtitle={t('dashboard.overview.kpisSubtitle')}
            >
              <Grid container spacing={2}>
                <Grid item xs={6} sm={4} md={2}>
                  <Box sx={hoverLift}>
                    <AnalyticsWidgetCard
                      title={t('dashboard.analytics.occupancyRate')}
                      value={globalData ? `${globalData.occupancyRate.value}%` : '-'}
                      subtitle={t('dashboard.analytics.occupancySubtitle')}
                      trend={globalData ? { value: globalData.occupancyRate.growth } : undefined}
                      icon={<Percent color="success" />}
                      tooltip={t('dashboard.analytics.occupancyTooltip')}
                      loading={isKpiLoading}
                    />
                  </Box>
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <Box sx={hoverLift}>
                    <AnalyticsWidgetCard
                      title={t('dashboard.analytics.totalRevenue')}
                      value={globalData ? `${globalData.totalRevenue.value.toLocaleString('fr-FR')} €` : '-'}
                      subtitle={t('dashboard.analytics.totalRevenueSubtitle')}
                      trend={globalData ? { value: globalData.totalRevenue.growth } : undefined}
                      icon={<TrendIcon color="success" />}
                      loading={isKpiLoading}
                    />
                  </Box>
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <Box sx={hoverLift}>
                    <AnalyticsWidgetCard
                      title="ADR"
                      value={globalData ? `${globalData.adr.value.toFixed(2)} €` : '-'}
                      subtitle={t('dashboard.analytics.avgDailyRate')}
                      trend={globalData ? { value: globalData.adr.growth } : undefined}
                      icon={<Hotel color="info" />}
                      tooltip={t('dashboard.analytics.adrTooltip')}
                      loading={isKpiLoading}
                    />
                  </Box>
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <Box sx={hoverLift}>
                    <AnalyticsWidgetCard
                      title="RevPAN"
                      value={globalData ? `${globalData.revPAN.value.toFixed(2)} €` : '-'}
                      subtitle={t('dashboard.analytics.revenuePerNight')}
                      trend={globalData ? { value: globalData.revPAN.growth } : undefined}
                      icon={<Euro color="primary" />}
                      tooltip={t('dashboard.analytics.revPANTooltip')}
                      loading={isKpiLoading}
                    />
                  </Box>
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <Box sx={hoverLift}>
                    <AnalyticsWidgetCard
                      title={t('dashboard.analytics.activeProperties')}
                      value={stats ? `${stats.properties.active}` : '-'}
                      subtitle={`${stats?.properties.total ?? 0} ${t('dashboard.overview.total')}`}
                      trend={stats ? { value: stats.properties.growth } : undefined}
                      icon={<Home color="primary" />}
                      loading={isKpiLoading}
                    />
                  </Box>
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <Box sx={hoverLift}>
                    <AnalyticsWidgetCard
                      title={t('dashboard.stats.todayInterventions')}
                      value={stats ? `${stats.interventions.today}` : '-'}
                      subtitle={`${stats?.interventions.total ?? 0} ${t('dashboard.overview.total')}`}
                      trend={stats ? { value: stats.interventions.growth } : undefined}
                      icon={<Build color="info" />}
                      loading={isKpiLoading}
                    />
                  </Box>
                </Grid>
              </Grid>
            </GridSection>
          </DashboardErrorBoundary>

          {/* Command Center: Planning + Action counters */}
          <DashboardErrorBoundary widgetName="CommandCenter">
            <GridSection
              title={t('dashboard.overview.commandCenterTitle')}
              subtitle={t('dashboard.overview.commandCenterSubtitle')}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <DashboardErrorBoundary widgetName="MiniPlanning">
                  <MiniPlanningWidget navigate={navigate} t={t} />
                </DashboardErrorBoundary>

                <DashboardErrorBoundary widgetName="ActionCounters">
                  <ActionCountersWidget
                    alerts={alerts}
                    stats={stats}
                    pendingPaymentsCount={pendingPaymentsCount}
                    loading={loading}
                    navigate={navigate}
                    t={t}
                  />
                </DashboardErrorBoundary>

                {hasAnyAiEnabled && (
                  <DashboardErrorBoundary widgetName="AiUsage">
                    <AiUsageWidget layout="inline" />
                  </DashboardErrorBoundary>
                )}
              </Box>
            </GridSection>
          </DashboardErrorBoundary>
        </Box>

        {/* ── RIGHT COLUMN: sidebar widgets ─────────────────────────── */}
        {showSidebar && (
          <Box
            sx={{
              flex: '0 0 auto',
              width: { xs: '100%', lg: 280 },
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              position: { lg: 'sticky' },
              top: { lg: 8 },
            }}
          >
            {/* 1. Contract CTA */}
            <DashboardErrorBoundary widgetName="ContractCTA">
              <ContractCTABanner />
            </DashboardErrorBoundary>

            {/* 2. Contextual Tips */}
            <DashboardErrorBoundary widgetName="ContextualTips">
              <ContextualTipsWidget />
            </DashboardErrorBoundary>

            {/* 3. Channel Health */}
            <DashboardErrorBoundary widgetName="ChannelHealth">
              <ChannelHealthWidget />
            </DashboardErrorBoundary>
          </Box>
        )}
      </Box>
    </Box>
  );
});

DashboardOverview.displayName = 'DashboardOverview';

export default DashboardOverview;
