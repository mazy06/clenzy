import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  Home,
  Build,
  Assignment,
  People,
  Euro,
  Notifications,
  CheckCircle,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDashboardData, formatGrowth } from '../../hooks/useDashboardData';
import { useTranslation } from '../../hooks/useTranslation';
import UpcomingInterventions from './UpcomingInterventions';
import AlertsWidget from './AlertsWidget';
import PendingPaymentsWidget from './PendingPaymentsWidget';
import ServiceRequestsWidget from './ServiceRequestsWidget';
import DashboardStatsCards from './DashboardStatsCards';
import DashboardQuickActions from './DashboardQuickActions';
import DashboardCharts from './DashboardCharts';
import DashboardActivityFeed from './DashboardActivityFeed';
import DashboardErrorBoundary from './DashboardErrorBoundary';
import type { StatItem } from './DashboardStatsCards';

const DashboardOverviewContent: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { stats, loading, error } = useDashboardData();

  // Permissions
  const canViewProperties = user?.permissions?.includes('properties:view') || false;
  const canViewServiceRequests = user?.permissions?.includes('service-requests:view') || false;
  const canViewInterventions = user?.permissions?.includes('interventions:view') || false;
  const canViewTeams = user?.permissions?.includes('teams:view') || false;
  const canViewUsers = user?.permissions?.includes('users:manage') || false;
  const canViewSettings = user?.permissions?.includes('settings:view') || false;
  const canViewReports = user?.permissions?.includes('reports:view') || false;

  // Roles
  const isAdmin = user?.roles?.includes('ADMIN');
  const isManager = user?.roles?.includes('MANAGER');
  const isHost = user?.roles?.includes('HOST');
  const isTechnician = user?.roles?.includes('TECHNICIAN');
  const isHousekeeper = user?.roles?.includes('HOUSEKEEPER');
  const isSupervisor = user?.roles?.includes('SUPERVISOR');

  const canViewCharts = isAdmin || isManager || isSupervisor;

  // ─── Dynamic stats (memoized) ──────────────────────────────────────────
  const dynamicStats = useMemo((): StatItem[] => {
    if (!stats) return [];

    if (isAdmin || isManager || isSupervisor) {
      const adminStats: StatItem[] = [];
      if (canViewProperties) {
        adminStats.push({
          title: t('dashboard.stats.activeProperties'),
          value: stats.properties.active.toString(),
          icon: <Home color="primary" />,
          growth: formatGrowth(stats.properties.growth),
          route: '/properties',
        });
      }
      if (canViewServiceRequests) {
        adminStats.push({
          title: t('dashboard.stats.pendingRequests'),
          value: stats.serviceRequests.pending.toString(),
          icon: <Assignment color="secondary" />,
          growth: formatGrowth(stats.serviceRequests.growth),
          route: '/service-requests',
        });
      }
      if (canViewInterventions) {
        adminStats.push({
          title: t('dashboard.stats.todayInterventions'),
          value: stats.interventions.today.toString(),
          icon: <Build color="success" />,
          growth: formatGrowth(stats.interventions.growth),
          route: '/interventions',
        });
      }
      if (canViewReports) {
        const revenueValue =
          stats.revenue.current > 0
            ? `\u20AC${stats.revenue.current.toLocaleString('fr-FR')}`
            : '\u20AC0';
        adminStats.push({
          title: t('dashboard.stats.monthlyRevenue'),
          value: revenueValue,
          icon: <Euro color="warning" />,
          growth: formatGrowth(stats.revenue.growth),
          route: '/reports',
        });
      }
      return adminStats;
    } else if (isHost) {
      const hostStats: StatItem[] = [];
      if (canViewProperties) {
        hostStats.push({
          title: t('dashboard.stats.myProperties'),
          value: stats.properties.active.toString(),
          icon: <Home color="primary" />,
          growth: formatGrowth(stats.properties.growth),
          route: '/properties',
        });
      }
      if (canViewServiceRequests) {
        hostStats.push({
          title: t('dashboard.stats.myPendingRequests'),
          value: stats.serviceRequests.pending.toString(),
          icon: <Assignment color="secondary" />,
          growth: formatGrowth(stats.serviceRequests.growth),
          route: '/service-requests',
        });
      }
      if (canViewInterventions) {
        hostStats.push({
          title: t('dashboard.stats.myScheduledInterventions'),
          value: stats.interventions.today.toString(),
          icon: <Build color="success" />,
          growth: formatGrowth(stats.interventions.growth),
          route: '/interventions',
        });
      }
      hostStats.push({
        title: t('dashboard.stats.myNotifications'),
        value: '0',
        icon: <Notifications color="info" />,
        growth: { value: '0%', type: 'neutral' },
        route: '/notifications',
      });
      return hostStats;
    } else if (isTechnician || isHousekeeper) {
      const workerStats: StatItem[] = [];
      if (canViewInterventions) {
        workerStats.push({
          title: t('dashboard.stats.assignedInterventions'),
          value: stats.interventions.total.toString(),
          icon: <Build color="primary" />,
          growth: formatGrowth(stats.interventions.growth),
          route: '/interventions',
        });
        workerStats.push({
          title: t('dashboard.stats.completedInterventions'),
          value: '0',
          icon: <CheckCircle color="success" />,
          growth: { value: '0%', type: 'neutral' },
          route: '/interventions',
        });
      }
      if (canViewReports) {
        workerStats.push({
          title: t('dashboard.stats.workTime'),
          value: '0h',
          icon: <Assignment color="info" />,
          growth: { value: '0%', type: 'neutral' },
          route: '/reports',
        });
      }
      if (canViewTeams) {
        workerStats.push({
          title: t('dashboard.stats.team'),
          value: t('dashboard.stats.team'),
          icon: <People color="secondary" />,
          growth: { value: 'Active', type: 'neutral' },
          route: '/teams',
        });
      }
      return workerStats;
    }

    return [];
  }, [stats, isAdmin, isManager, isSupervisor, isHost, isTechnician, isHousekeeper,
      canViewProperties, canViewServiceRequests, canViewInterventions, canViewReports, canViewTeams, t]);

  const hasAnyPermission =
    canViewProperties ||
    canViewServiceRequests ||
    canViewInterventions ||
    canViewTeams ||
    canViewUsers ||
    canViewSettings ||
    canViewReports;

  const hasOperationsContent = canViewInterventions || canViewServiceRequests;
  const hasActivityContent =
    canViewProperties || canViewServiceRequests || canViewInterventions || canViewTeams;

  return (
    <Box
      sx={{
        pt: 1,
        pb: 0,
        height: 'calc(100vh - 190px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Row 1 : Stats KPI (hauteur auto) ─────────────────────── */}
      <Box sx={{ flexShrink: 0 }}>
        <DashboardStatsCards
          stats={dynamicStats}
          loading={loading}
          error={error}
          navigate={navigate}
        />
      </Box>

      {/* ── Row 2 : Charts (flex proportionnel ~35%) ─────────────── */}
      {canViewCharts && (
        <Box sx={{ flex: '0 0 35%', minHeight: 0 }}>
          <DashboardErrorBoundary widgetName="Graphiques">
            <DashboardCharts />
          </DashboardErrorBoundary>
        </Box>
      )}

      {/* ── Row 3 : Widgets 3 colonnes (flex restant) ────────────── */}
      {(hasActivityContent || hasOperationsContent) && (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <Grid container spacing={1} sx={{ height: '100%' }}>
            {/* ─ Colonne gauche : Activite + Paiements ──────────────── */}
            <Grid item xs={12} md={5} sx={{ height: '100%' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
                {hasActivityContent && (
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <DashboardErrorBoundary widgetName="Activites">
                      <DashboardActivityFeed
                        navigate={navigate}
                        t={t}
                      />
                    </DashboardErrorBoundary>
                  </Box>
                )}
                {canViewInterventions && (
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <DashboardErrorBoundary widgetName="Paiements">
                      <PendingPaymentsWidget />
                    </DashboardErrorBoundary>
                  </Box>
                )}
              </Box>
            </Grid>

            {/* ─ Colonne centre : Operations ──────────────────────────── */}
            <Grid item xs={12} md={4} sx={{ height: '100%' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
                {canViewInterventions && (
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <DashboardErrorBoundary widgetName="Interventions">
                      <UpcomingInterventions />
                    </DashboardErrorBoundary>
                  </Box>
                )}
                {canViewServiceRequests && (
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <DashboardErrorBoundary widgetName="Demandes">
                      <ServiceRequestsWidget />
                    </DashboardErrorBoundary>
                  </Box>
                )}
              </Box>
            </Grid>

            {/* ─ Colonne droite : Actions rapides + Alertes ────────── */}
            <Grid item xs={12} md={3} sx={{ height: '100%' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
                <Box sx={{ flexShrink: 0 }}>
                  <DashboardQuickActions
                    canViewProperties={canViewProperties}
                    canViewServiceRequests={canViewServiceRequests}
                    canViewInterventions={canViewInterventions}
                    canViewTeams={canViewTeams}
                    canViewUsers={canViewUsers}
                    canViewSettings={canViewSettings}
                    isAdmin={isAdmin}
                    isManager={isManager}
                    isHost={isHost}
                    navigate={navigate}
                    t={t}
                  />
                </Box>
                {canViewInterventions && (
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <DashboardErrorBoundary widgetName="Alertes">
                      <AlertsWidget />
                    </DashboardErrorBoundary>
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* ── Aucune permission ──────────────────────────────────────── */}
      {!hasAnyPermission && (
        <Card>
          <CardContent sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
              {t('dashboard.noPermissions')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.8125rem' }}>
              {t('dashboard.noPermissionsMessage')}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
});

DashboardOverviewContent.displayName = 'DashboardOverviewContent';

export default DashboardOverviewContent;
