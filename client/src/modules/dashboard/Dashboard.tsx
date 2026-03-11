import React, { useState, useMemo } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Chip,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Calculate as CalculateIcon,
  VolumeUp as VolumeUpIcon,
  LockOutlined as LockOutlinedIcon,
  VpnKey as VpnKeyIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useAnalyticsEngine } from '../../hooks/useAnalyticsEngine';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import DashboardNoiseTab from './DashboardNoiseTab';
import DashboardSmartLockTab from './DashboardSmartLockTab';
import DashboardKeyExchangeTab from './DashboardKeyExchangeTab';
import DashboardDateFilter from './DashboardDateFilter';
import DashboardErrorBoundary from './DashboardErrorBoundary';
import DashboardOverview from './DashboardOverview';
import UpgradeBanner from './UpgradeBanner';
import { AnalyticsSimulator } from './analytics';
import type { DashboardPeriod, DateFilterOption } from './DashboardDateFilter';

// ─── Tab helpers ────────────────────────────────────────────────────────────

function a11yProps(index: number) {
  return {
    id: `dashboard-tab-${index}`,
    'aria-controls': `dashboard-tabpanel-${index}`,
  };
}

// ─── Filter option configs ──────────────────────────────────────────────────

const PERIOD_OPTIONS: DateFilterOption<DashboardPeriod>[] = [
  { value: 'week', label: '7j' },
  { value: 'month', label: '30j' },
  { value: 'quarter', label: '90j' },
  { value: 'year', label: '1 an' },
];

const EMPTY_INTERVENTIONS: Array<{ estimatedCost?: number; actualCost?: number; type: string; status: string; scheduledDate?: string; createdAt?: string }> = [];

// ─── Main component ──────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [tabValue, setTabValue] = useState(0);

  // Roles
  const isAdmin = user?.roles?.includes('SUPER_ADMIN') || false;
  const isManager = user?.roles?.includes('SUPER_MANAGER') || false;
  const isHost = user?.roles?.includes('HOST') || false;
  const isTechnician = user?.roles?.includes('TECHNICIAN');
  const isHousekeeper = user?.roles?.includes('HOUSEKEEPER');
  const isSupervisor = user?.roles?.includes('SUPERVISOR');
  const isLaundry = user?.roles?.includes('LAUNDRY');
  const isExteriorTech = user?.roles?.includes('EXTERIOR_TECH');

  // Analytics engine (for simulator tab)
  const { analytics } = useAnalyticsEngine({
    period,
    interventions: EMPTY_INTERVENTIONS,
  });

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

  // ─── Date filter: period chips on Overview (tab 0) and Simulator (tab 4)
  const dateFilterElement = useMemo(() => {
    if (tabValue === 0 || tabValue === 4) {
      return (
        <DashboardDateFilter<DashboardPeriod>
          value={period}
          onChange={setPeriod}
          options={PERIOD_OPTIONS}
        />
      );
    }
    return null;
  }, [tabValue, period]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <Box sx={{ flexShrink: 0 }}>
        <PageHeader
          title={getDashboardTitle()}
          subtitle={getDashboardDescription()}
          backPath="/"
          showBackButton={false}
          actions={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Tooltip title="Channel Manager — Ce service sera bientôt disponible. Restez connecté !" arrow>
                <span>
                  <Chip
                    icon={<SyncIcon sx={{ fontSize: 14 }} />}
                    label="Channel Manager"
                    size="small"
                    variant="outlined"
                    disabled
                    sx={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      height: 28,
                      borderColor: 'divider',
                      color: 'text.disabled',
                      '& .MuiChip-icon': { fontSize: 14, color: 'text.disabled' },
                    }}
                  />
                </span>
              </Tooltip>
              <Box sx={{ width: '1px', height: 20, backgroundColor: 'divider', mx: 0.25 }} />
              {dateFilterElement}
            </Box>
          }
        />
      </Box>

      {/* ─── Tabs (5 onglets : Vue d'ensemble / Nuisance sonore / Serrures / Clés / Simulateur) ── */}
      <Paper sx={{ borderBottom: 1, borderColor: 'divider', mb: 0, flexShrink: 0 }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          sx={{
            minHeight: 36,
            '& .MuiTab-root': {
              minHeight: 36,
              py: 0.5,
              px: 2,
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'none',
              letterSpacing: '0.01em',
              color: 'text.secondary',
              '&.Mui-selected': {
                fontWeight: 700,
                color: 'primary.main',
              },
            },
            '& .MuiTabs-indicator': {
              height: 2,
              borderRadius: 1,
            },
          }}
        >
          <Tab
            icon={<DashboardIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={t('dashboard.tabs.overview') || "Vue d'ensemble"}
            {...a11yProps(0)}
          />
          <Tab
            icon={<VolumeUpIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={t('dashboard.tabs.noise') || 'Nuisance sonore'}
            {...a11yProps(1)}
          />
          <Tab
            icon={<LockOutlinedIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={t('dashboard.tabs.smartLock') || 'Serrures connectées'}
            {...a11yProps(2)}
          />
          <Tab
            icon={<VpnKeyIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={t('dashboard.tabs.keyExchange') || 'Gestion des clés'}
            {...a11yProps(3)}
          />
          <Tab
            icon={<CalculateIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={t('dashboard.tabs.simulator') || 'Simulateur'}
            {...a11yProps(4)}
          />
        </Tabs>
      </Paper>

      {/* ─── Tab 0: Vue d'ensemble ────────────────────────────────────────── */}
      {tabValue === 0 && (
        <Box
          role="tabpanel"
          id="dashboard-tabpanel-0"
          aria-labelledby="dashboard-tab-0"
          sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', pt: 1 }}
        >
          {isHost && user?.forfait?.toLowerCase() === 'essentiel' && (
            <UpgradeBanner currentForfait={user.forfait} />
          )}
          <DashboardOverview period={period} onNavigateTab={setTabValue} />
        </Box>
      )}

      {/* ─── Tab 1: Nuisance sonore ──────────────────────────────────────── */}
      {tabValue === 1 && (
        <Box
          role="tabpanel"
          id="dashboard-tabpanel-1"
          aria-labelledby="dashboard-tab-1"
          sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', pt: 1 }}
        >
          <DashboardNoiseTab />
        </Box>
      )}

      {/* ─── Tab 2: Serrures connectées ────────────────────────────────── */}
      {tabValue === 2 && (
        <Box
          role="tabpanel"
          id="dashboard-tabpanel-2"
          aria-labelledby="dashboard-tab-2"
          sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', pt: 1 }}
        >
          <DashboardSmartLockTab />
        </Box>
      )}

      {/* ─── Tab 3: Gestion des clés ─────────────────────────────────── */}
      {tabValue === 3 && (
        <Box
          role="tabpanel"
          id="dashboard-tabpanel-3"
          aria-labelledby="dashboard-tab-3"
          sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', pt: 1 }}
        >
          <DashboardKeyExchangeTab />
        </Box>
      )}

      {/* ─── Tab 4: Simulateur ───────────────────────────────────────────── */}
      {tabValue === 4 && (
        <Box
          role="tabpanel"
          id="dashboard-tabpanel-4"
          aria-labelledby="dashboard-tab-4"
          sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', pt: 1 }}
        >
          <DashboardErrorBoundary widgetName="Simulateur">
            <AnalyticsSimulator data={analytics} />
          </DashboardErrorBoundary>
        </Box>
      )}

    </Box>
  );
};

export default Dashboard;
