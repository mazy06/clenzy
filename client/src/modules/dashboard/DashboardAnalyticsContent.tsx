import React, { useMemo } from 'react';
import {
  Box,
  Typography,
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
import { useDashboardOverview, formatGrowth } from '../../hooks/useDashboardOverview';
import { useTranslation } from '../../hooks/useTranslation';
import DashboardStatsCards from './DashboardStatsCards';
import DashboardCharts from './DashboardCharts';
import DashboardErrorBoundary from './DashboardErrorBoundary';
import type { StatItem } from './DashboardStatsCards';
import type { DashboardPeriod } from './DashboardDateFilter';

// ─── Props ───────────────────────────────────────────────────────────────────

interface DashboardAnalyticsContentProps {
  period?: DashboardPeriod;
}

const DashboardAnalyticsContent: React.FC<DashboardAnalyticsContentProps> = React.memo(({ period = 'month' }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  // Roles
  const isAdmin = user?.roles?.includes('ADMIN') || false;
  const isManager = user?.roles?.includes('MANAGER') || false;
  const isHost = user?.roles?.includes('HOST') || false;
  const isTechnician = user?.roles?.includes('TECHNICIAN');
  const isHousekeeper = user?.roles?.includes('HOUSEKEEPER');
  const isSupervisor = user?.roles?.includes('SUPERVISOR');

  const userRole = (() => {
    if (isAdmin) return 'ADMIN';
    if (isManager) return 'MANAGER';
    if (isSupervisor) return 'SUPERVISOR';
    if (isTechnician) return 'TECHNICIAN';
    if (isHousekeeper) return 'HOUSEKEEPER';
    if (isHost) return 'HOST';
    return 'USER';
  })();

  // ─── React Query hook ─────────────────────────────────────────────────────
  const {
    stats,
    charts,
    loading,
    error,
  } = useDashboardOverview({
    userRole,
    user,
    t,
    isAdmin,
    isManager,
    isHost,
    period,
  });

  // Permissions
  const canViewProperties = user?.permissions?.includes('properties:view') || false;
  const canViewServiceRequests = user?.permissions?.includes('service-requests:view') || false;
  const canViewInterventions = user?.permissions?.includes('interventions:view') || false;
  const canViewTeams = user?.permissions?.includes('teams:view') || false;
  const canViewReports = user?.permissions?.includes('reports:view') || false;

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
    canViewReports;

  return (
    <Box
      sx={{
        pt: 0.5,
        pb: 0,
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {hasAnyPermission ? (
        <>
          {/* ── Row 1 : Stats KPI (auto height) ──────────────────────── */}
          <Box sx={{ flexShrink: 0 }}>
            <DashboardStatsCards
              stats={dynamicStats}
              loading={loading}
              error={error}
              navigate={navigate}
            />
          </Box>

          {/* ── Row 2 : Charts ──────────────────────────────────────────── */}
          {canViewCharts && (
            <Box sx={{ flex: 1, minHeight: 200, mt: 0.5 }}>
              <DashboardErrorBoundary widgetName="Graphiques">
                <DashboardCharts charts={charts} loading={loading} />
              </DashboardErrorBoundary>
            </Box>
          )}
        </>
      ) : (
        <Card>
          <CardContent sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
              {t('dashboard.noPermissions')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.75rem' }}>
              {t('dashboard.noPermissionsMessage')}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
});

DashboardAnalyticsContent.displayName = 'DashboardAnalyticsContent';

export default DashboardAnalyticsContent;
