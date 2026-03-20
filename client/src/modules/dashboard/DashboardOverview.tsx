import React, { useMemo, useState, useEffect } from 'react';
import { Box, CircularProgress, Grid, Typography, useTheme } from '@mui/material';
import {
  Percent,
  Euro,
  Hotel,
  TrendingUp as TrendIcon,
  Home,
  Build,
  Schedule,
  CheckCircle,
  Assignment,
  Speed,
  AccountBalanceWallet,
  CalendarMonth,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useDashboardOverview } from '../../hooks/useDashboardOverview';
import { useAnalyticsEngine } from '../../hooks/useAnalyticsEngine';
import { GridSection, AnalyticsWidgetCard } from './analytics';
import DashboardErrorBoundary from './DashboardErrorBoundary';
import OnboardingChecklist from './OnboardingChecklist';
import ContractCTABanner from './ContractCTABanner';
import ChannelHealthWidget from './ChannelHealthWidget';
import ContextualTipsWidget from './ContextualTipsWidget';
import MiniPlanningWidget from './MiniPlanningWidget';
import ActionCountersWidget from './ActionCountersWidget';
import ServicesStatusWidget from './ServicesStatusWidget';
import AiUsageWidget from './AiUsageWidget';
import { useAiFeatureToggles } from '../../hooks/useAi';
import { usePendingPayouts, useMyPendingPayout } from '../../hooks/usePendingPayouts';
import { airbnbApi } from '../../services/api/airbnbApi';
import { channelConnectionApi } from '../../services/api/channelConnectionApi';
import { fiscalProfileApi } from '../../services/api/fiscalProfileApi';
import { propertiesApi } from '../../services/api/propertiesApi';
import { calendarPricingApi } from '../../services/api/calendarPricingApi';
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
  height: '100%',
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

  const { data: pendingPayoutsData, isLoading: pendingPayoutsLoading } = usePendingPayouts();
  const { data: myPayoutData } = useMyPendingPayout();

  // ─── Onboarding: wire hasPricing & hasChannels to real data ───────────
  const hasProperties = (stats?.properties.total ?? 0) > 0;
  const hasPropertyDetails = (stats?.properties.active ?? 0) > 0;

  const [hasPricing, setHasPricing] = useState(false);
  const [hasChannels, setHasChannels] = useState(false);
  const [hasBillingProfile, setHasBillingProfile] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Check if first property has rate plans (dynamic pricing configured)
    (async () => {
      try {
        const props = await propertiesApi.getAll({ size: 1 });
        if (cancelled || props.length === 0) return;
        const ratePlans = await calendarPricingApi.getRatePlans(props[0].id);
        if (!cancelled && ratePlans.length > 0) setHasPricing(true);
      } catch {
        // No properties or no rate plans — leave false
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
    // Check if billing/fiscal profile is configured
    (async () => {
      try {
        const profile = await fiscalProfileApi.get();
        if (!cancelled && profile && (profile.taxIdNumber || profile.legalEntityName)) {
          setHasBillingProfile(true);
        }
      } catch {
        // No profile yet — leave false
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const globalData = analytics?.global ?? null;
  const isKpiLoading = loading || analyticsLoading;

  // Shared hover lift style
  const hoverLift = kpiHoverSx(isDark);

  // ─── Role-based widget visibility ──────────────────────────────────────
  const isOperational = ['TECHNICIAN', 'HOUSEKEEPER', 'LAUNDRY', 'EXTERIOR_TECH'].includes(userRole);
  const isSupervisor = userRole === 'SUPERVISOR';

  // Services (noise, locks, keys, booking engine) — only management & host
  const showServices = isAdmin || isManager || isHost;
  // Financial KPIs (occupation, revenu, ADR, REVPAN) — only management & host
  const showFinancialKpis = isAdmin || isManager || isHost;
  // Sidebar (contract CTA, tips, channel health) — only management & host
  const showSidebar = isAdmin || isManager || isHost;
  // AI usage widget — respect admin toggle + only management & host
  const showAiWidget = hasAnyAiEnabled && (isAdmin || isManager || isHost);

  // ─── Global loading spinner ────────────────────────────────────────────
  if (isKpiLoading) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
          gap: 2,
        }}
      >
        <CircularProgress size={48} thickness={4} sx={{ color: 'primary.main' }} />
        <Typography variant="body2" color="text.secondary">
          {t('dashboard.overview.loading')}
        </Typography>
      </Box>
    );
  }

  // ─── Full dashboard (always rendered, even for new users) ──────────────
  return (
    <Box sx={{ pt: 1.5, pb: 2, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

      {/* ═══ Two-column global layout ═══════════════════════════════════ */}
      <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', lg: 'row' }, alignItems: 'flex-start' }}>

        {/* ── LEFT COLUMN: all main content ────────────────────────── */}
        <Box sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* Onboarding checklist */}
          <OnboardingChecklist />

          {/* Services Status (noise, locks, keys) — management & host only */}
          {showServices && onNavigateTab && (
            <DashboardErrorBoundary widgetName="ServicesStatus">
              <ServicesStatusWidget onNavigateTab={onNavigateTab} />
            </DashboardErrorBoundary>
          )}

          {/* KPIs — adapted per role */}
          <DashboardErrorBoundary widgetName="KPIs">
            <GridSection
              title={t('dashboard.overview.kpisTitle')}
              subtitle={t('dashboard.overview.kpisSubtitle')}
            >
              <Grid container spacing={2}>
                {showFinancialKpis && (
                  <>
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
                          trend={stats && stats.properties.growth !== 0 ? { value: stats.properties.growth } : undefined}
                          icon={<Home color="primary" />}
                          loading={isKpiLoading}
                        />
                      </Box>
                    </Grid>
                  </>
                )}
                <Grid item xs={6} sm={4} md={showFinancialKpis ? 2 : 4}>
                  <Box sx={hoverLift}>
                    <AnalyticsWidgetCard
                      title={t('dashboard.stats.todayInterventions')}
                      value={stats ? `${stats.interventions.today}` : '-'}
                      subtitle={`${stats?.interventions.total ?? 0} ${t('dashboard.overview.total')}`}
                      trend={stats && stats.interventions.growth !== 0 ? { value: stats.interventions.growth } : undefined}
                      icon={<Build color="info" />}
                      loading={isKpiLoading}
                    />
                  </Box>
                </Grid>
                {!showFinancialKpis && (
                  <>
                    <Grid item xs={6} sm={4} md={4}>
                      <Box sx={hoverLift}>
                        <AnalyticsWidgetCard
                          title={t('dashboard.stats.upcomingInterventions')}
                          value={stats ? `${stats.interventions.upcoming}` : '-'}
                          subtitle={t('dashboard.stats.next7days')}
                          icon={<Schedule color="primary" />}
                          loading={isKpiLoading}
                        />
                      </Box>
                    </Grid>
                    <Grid item xs={6} sm={4} md={4}>
                      <Box sx={hoverLift}>
                        <AnalyticsWidgetCard
                          title={t('dashboard.stats.completedInterventions')}
                          value={stats ? `${stats.interventions.completed}` : '-'}
                          subtitle={`${stats?.interventions.completionRate ?? 0}% ${t('dashboard.stats.completionRate')}`}
                          icon={<CheckCircle color="success" />}
                          loading={isKpiLoading}
                        />
                      </Box>
                    </Grid>
                    <Grid item xs={6} sm={4} md={4}>
                      <Box sx={hoverLift}>
                        <AnalyticsWidgetCard
                          title={t('dashboard.stats.serviceRequests')}
                          value={stats ? `${stats.serviceRequests.pending}` : '-'}
                          subtitle={`${stats?.serviceRequests.total ?? 0} ${t('dashboard.overview.total')}`}
                          icon={<Assignment color={stats && stats.serviceRequests.pending > 0 ? 'warning' : 'disabled'} />}
                          loading={isKpiLoading}
                        />
                      </Box>
                    </Grid>
                    <Grid item xs={6} sm={4} md={4}>
                      <Box sx={hoverLift}>
                        <AnalyticsWidgetCard
                          title={t('dashboard.stats.totalEarnings')}
                          value={stats ? `${stats.interventions.totalRevenue.toLocaleString('fr-FR')} €` : '-'}
                          subtitle={t('dashboard.stats.allCompletedInterventions')}
                          icon={<AccountBalanceWallet color="success" />}
                          loading={isKpiLoading}
                        />
                      </Box>
                    </Grid>
                    <Grid item xs={6} sm={4} md={4}>
                      <Box sx={hoverLift}>
                        <AnalyticsWidgetCard
                          title={t('dashboard.stats.nextPayout')}
                          value={myPayoutData ? `${(myPayoutData.totalPendingAmount ?? 0).toLocaleString('fr-FR')} €` : '-'}
                          subtitle={myPayoutData && myPayoutData.pendingCount > 0
                            ? `${myPayoutData.pendingCount} ${t('dashboard.stats.pendingPayouts')}`
                            : t('dashboard.stats.noPayoutPending')}
                          icon={<CalendarMonth color={myPayoutData && myPayoutData.totalPendingAmount > 0 ? 'success' : 'disabled'} />}
                          loading={isKpiLoading}
                        />
                      </Box>
                    </Grid>
                  </>
                )}
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
                  <MiniPlanningWidget navigate={navigate} t={t} isOperational={isOperational} />
                </DashboardErrorBoundary>

                <DashboardErrorBoundary widgetName="ActionCounters">
                  <ActionCountersWidget
                    alerts={alerts}
                    stats={stats}
                    pendingPaymentsCount={pendingPaymentsCount}
                    pendingPayoutsCount={pendingPayoutsData?.pendingCount ?? 0}
                    loading={loading}
                    navigate={navigate}
                    t={t}
                  />
                </DashboardErrorBoundary>

                {showAiWidget && (
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
