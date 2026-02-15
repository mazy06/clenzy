import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Paper,
  Button,
  Tooltip,
} from '@mui/material';
import {
  Home,
  Build,
  Assignment,
  People,
  Euro,
  Notifications,
  CheckCircle,
  CalendarMonth,
  Dashboard as DashboardIcon,
  Timeline as TimelineIcon,
  Sync as SyncIcon,
  CalendarToday as CalendarTodayIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import DashboardPlanning from './DashboardPlanning';
import UpcomingInterventions from './UpcomingInterventions';
import AlertsWidget from './AlertsWidget';
import ServiceRequestsWidget from './ServiceRequestsWidget';
import DashboardStatsCards from './DashboardStatsCards';
import DashboardQuickActions from './DashboardQuickActions';
import DashboardCharts from './DashboardCharts';
import DashboardActivityFeed from './DashboardActivityFeed';
import DashboardDateFilter from './DashboardDateFilter';
import ICalImportModal from './ICalImportModal';
import type { DashboardPeriod } from './DashboardDateFilter';
import type { StatItem } from './DashboardStatsCards';

// ─── Tab helpers (same pattern as PortfoliosPage) ────────────────────────────

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`dashboard-tabpanel-${index}`}
      aria-labelledby={`dashboard-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `dashboard-tab-${index}`,
    'aria-controls': `dashboard-tabpanel-${index}`,
  };
}

// ─── Main component ──────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [tabValue, setTabValue] = useState(0);
  const [icalModalOpen, setIcalModalOpen] = useState(false);

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

  // User role for stats hook
  const userRole = (() => {
    if (isAdmin) return 'ADMIN';
    if (isManager) return 'MANAGER';
    if (isSupervisor) return 'SUPERVISOR';
    if (isTechnician) return 'TECHNICIAN';
    if (isHousekeeper) return 'HOUSEKEEPER';
    if (isHost) return 'HOST';
    return 'USER';
  })();

  const { stats, activities, loading, error, formatGrowth } = useDashboardStats(userRole, user, t, 10);

  // ─── Dynamic stats (same logic as before) ──────────────────────────────

  const getDynamicStats = (): StatItem[] => {
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
  };

  const getFeedActivities = () => (activities || []).slice(0, 10);

  const dynamicStats = getDynamicStats();
  const feedActivities = getFeedActivities();

  // ─── Titles ─────────────────────────────────────────────────────────────

  const getDashboardTitle = () => {
    if (isAdmin) return t('dashboard.titleAdmin');
    if (isManager) return t('dashboard.titleManager');
    if (isHost) return t('dashboard.titleHost');
    if (isTechnician) return t('dashboard.titleTechnician');
    if (isHousekeeper) return t('dashboard.titleHousekeeper');
    if (isSupervisor) return t('dashboard.titleSupervisor');
    return t('dashboard.title');
  };

  const getDashboardDescription = () => {
    if (isAdmin) return t('dashboard.subtitleAdmin');
    if (isManager) return t('dashboard.subtitleManager');
    if (isHost) return t('dashboard.subtitleHost');
    if (isTechnician) return t('dashboard.subtitleTechnician');
    if (isHousekeeper) return t('dashboard.subtitleHousekeeper');
    if (isSupervisor) return t('dashboard.subtitleSupervisor');
    return t('dashboard.subtitle');
  };

  // ─── Check if user has any permission at all ────────────────────────────

  const hasAnyPermission =
    canViewProperties ||
    canViewServiceRequests ||
    canViewInterventions ||
    canViewTeams ||
    canViewUsers ||
    canViewSettings ||
    canViewReports;

  return (
    <Box>
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <PageHeader
        title={getDashboardTitle()}
        subtitle={getDashboardDescription()}
        backPath="/"
        showBackButton={false}
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Channel Manager — Ce service sera bientot disponible. Restez connecte !" arrow>
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  disabled
                  startIcon={<SyncIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    py: 0.5,
                    px: 1.5,
                  }}
                >
                  Channel Manager
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Importer les réservations via un lien iCal (.ics)" arrow>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CalendarTodayIcon sx={{ fontSize: 16 }} />}
                onClick={() => setIcalModalOpen(true)}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  py: 0.5,
                  px: 1.5,
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  '&:hover': { borderColor: 'primary.dark', backgroundColor: 'primary.50' },
                }}
              >
                Import iCal
              </Button>
            </Tooltip>
            <DashboardDateFilter period={period} onPeriodChange={setPeriod} />
          </Box>
        }
      />

      {/* ─── Tabs ──────────────────────────────────────────────────────── */}
      <Paper sx={{ borderBottom: 1, borderColor: 'divider', mb: 0 }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 42,
            '& .MuiTab-root': {
              minHeight: 42,
              py: 0.5,
              fontSize: '0.8125rem',
              textTransform: 'none',
            },
          }}
        >
          <Tab
            icon={<CalendarMonth sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={t('dashboard.tabs.planning') || 'Planning'}
            {...a11yProps(0)}
          />
          <Tab
            icon={<DashboardIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={t('dashboard.tabs.overview') || "Vue d'ensemble"}
            {...a11yProps(1)}
          />
          <Tab
            icon={<TimelineIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={t('dashboard.tabs.activity') || 'Activité'}
            {...a11yProps(2)}
          />
          <Tab
            icon={<Build sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={t('dashboard.tabs.operations') || 'Opérations'}
            {...a11yProps(3)}
          />
        </Tabs>
      </Paper>

      {/* ─── Tab 0: Planning ───────────────────────────────────────────── */}
      {tabValue === 0 && (
        <Box
          role="tabpanel"
          id="dashboard-tabpanel-0"
          aria-labelledby="dashboard-tab-0"
          sx={{
            py: 1,
            // Le planning occupe toute la hauteur restante de l'écran
            height: 'calc(100vh - 220px)',
            minHeight: 400,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <DashboardPlanning />
        </Box>
      )}

      {/* ─── Tab 1: Vue d'ensemble ─────────────────────────────────────── */}
      <TabPanel value={tabValue} index={1}>
        <DashboardStatsCards
          stats={dynamicStats}
          loading={loading}
          error={error}
          navigate={navigate}
        />

        {canViewCharts && <DashboardCharts />}
      </TabPanel>

      {/* ─── Tab 2: Activité ───────────────────────────────────────────── */}
      <TabPanel value={tabValue} index={2}>
        {(canViewProperties ||
          canViewServiceRequests ||
          canViewInterventions ||
          canViewTeams) && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <DashboardActivityFeed
                activities={feedActivities}
                loading={loading}
                navigate={navigate}
                t={t}
              />

              {canViewInterventions && (
                <Box sx={{ mt: 2 }}>
                  <AlertsWidget />
                </Box>
              )}
            </Grid>
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
          </Grid>
        )}
      </TabPanel>

      {/* ─── Tab 3: Opérations ─────────────────────────────────────────── */}
      <TabPanel value={tabValue} index={3}>
        {(canViewInterventions || canViewServiceRequests) && (
          <Grid container spacing={2}>
            {canViewInterventions && (
              <Grid item xs={12} md={6}>
                <UpcomingInterventions />
              </Grid>
            )}
            {canViewServiceRequests && (
              <Grid item xs={12} md={6}>
                <ServiceRequestsWidget />
              </Grid>
            )}
          </Grid>
        )}

        {!canViewInterventions && !canViewServiceRequests && (
          <Card>
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                {t('dashboard.noOperationsPermissions') ||
                  "Vous n'avez pas les permissions nécessaires pour voir les opérations."}
              </Typography>
            </CardContent>
          </Card>
        )}
      </TabPanel>

      {/* ─── No permissions fallback ───────────────────────────────────── */}
      {!hasAnyPermission && (
        <Card sx={{ mt: 2 }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              {t('dashboard.noPermissions')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('dashboard.noPermissionsMessage')}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* ─── iCal Import Modal ──────────────────────────────────────────── */}
      <ICalImportModal
        open={icalModalOpen}
        onClose={() => setIcalModalOpen(false)}
      />
    </Box>
  );
};

export default Dashboard;
