import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDashboardOverview } from '../../hooks/useDashboardOverview';
import { useTranslation } from '../../hooks/useTranslation';
import UpcomingInterventions from './UpcomingInterventions';
import AlertsWidget from './AlertsWidget';
import PendingPaymentsWidget from './PendingPaymentsWidget';
import ServiceRequestsWidget from './ServiceRequestsWidget';
import DashboardQuickActions from './DashboardQuickActions';
import DashboardActivityFeed from './DashboardActivityFeed';
import DashboardErrorBoundary from './DashboardErrorBoundary';

// ─── Component ──────────────────────────────────────────────────────────────

const DashboardActivityContent: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  // Roles
  const isAdmin = user?.roles?.includes('SUPER_ADMIN') || false;
  const isManager = user?.roles?.includes('SUPER_MANAGER') || false;
  const isHost = user?.roles?.includes('HOST') || false;
  const isTechnician = user?.roles?.includes('TECHNICIAN');
  const isHousekeeper = user?.roles?.includes('HOUSEKEEPER');
  const isSupervisor = user?.roles?.includes('SUPERVISOR');
  const isLaundry = user?.roles?.includes('LAUNDRY');
  const isExteriorTech = user?.roles?.includes('EXTERIOR_TECH');

  const userRole = (() => {
    if (user?.roles?.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
    if (isAdmin) return 'SUPER_ADMIN';
    if (user?.roles?.includes('SUPER_MANAGER')) return 'SUPER_MANAGER';
    if (isManager) return 'SUPER_MANAGER';
    if (isSupervisor) return 'SUPERVISOR';
    if (isTechnician) return 'TECHNICIAN';
    if (isHousekeeper) return 'HOUSEKEEPER';
    if (isHost) return 'HOST';
    if (isLaundry) return 'LAUNDRY';
    if (isExteriorTech) return 'EXTERIOR_TECH';
    return 'USER';
  })();

  // ─── React Query hook ─────────────────────────────────────────────────────
  const {
    activities,
    upcomingInterventions,
    pendingPayments,
    serviceRequests,
    alerts,
    loading,
  } = useDashboardOverview({
    userRole,
    user,
    t,
    isAdmin,
    isManager,
    isHost,
    period: 'month',
  });

  // Permissions
  const canViewProperties = user?.permissions?.includes('properties:view') || false;
  const canViewServiceRequests = user?.permissions?.includes('service-requests:view') || false;
  const canViewInterventions = user?.permissions?.includes('interventions:view') || false;
  const canViewTeams = user?.permissions?.includes('teams:view') || false;
  const canViewUsers = user?.permissions?.includes('users:manage') || false;
  const canViewSettings = user?.permissions?.includes('settings:view') || false;

  const hasOperationsContent = canViewInterventions || canViewServiceRequests;
  const hasActivityContent =
    canViewProperties || canViewServiceRequests || canViewInterventions || canViewTeams;

  const hasAnyContent = hasActivityContent || hasOperationsContent;

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
      {hasAnyContent ? (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <Grid container spacing={1} sx={{ height: '100%' }}>
            {/* ─ Left column: Activity + Payments ─────────────────── */}
            <Grid item xs={12} md={5} sx={{ height: '100%' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, height: '100%' }}>
                {hasActivityContent && (
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <DashboardErrorBoundary widgetName="Activites">
                      <DashboardActivityFeed
                        activities={activities}
                        loading={loading}
                        navigate={navigate}
                        t={t}
                      />
                    </DashboardErrorBoundary>
                  </Box>
                )}
                {canViewInterventions && (
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <DashboardErrorBoundary widgetName="Paiements">
                      <PendingPaymentsWidget
                        pendingPayments={pendingPayments}
                        loading={loading}
                      />
                    </DashboardErrorBoundary>
                  </Box>
                )}
              </Box>
            </Grid>

            {/* ─ Center column: Operations ─────────────────────────── */}
            <Grid item xs={12} md={4} sx={{ height: '100%' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, height: '100%' }}>
                {canViewInterventions && (
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <DashboardErrorBoundary widgetName="Interventions">
                      <UpcomingInterventions
                        upcomingInterventions={upcomingInterventions}
                        loading={loading}
                      />
                    </DashboardErrorBoundary>
                  </Box>
                )}
                {canViewServiceRequests && (
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <DashboardErrorBoundary widgetName="Demandes">
                      <ServiceRequestsWidget
                        serviceRequests={serviceRequests}
                        loading={loading}
                      />
                    </DashboardErrorBoundary>
                  </Box>
                )}
              </Box>
            </Grid>

            {/* ─ Right column: Quick actions + Alerts ──────────────── */}
            <Grid item xs={12} md={3} sx={{ height: '100%' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, height: '100%' }}>
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
                      <AlertsWidget
                        alerts={alerts}
                        loading={loading}
                      />
                    </DashboardErrorBoundary>
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
        </Box>
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

DashboardActivityContent.displayName = 'DashboardActivityContent';

export default DashboardActivityContent;
