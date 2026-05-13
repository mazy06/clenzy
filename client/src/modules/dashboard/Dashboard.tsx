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
} from '../../icons';
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
import { getVisibleTabs } from '../../config/dashboardConfig';
import type { DashboardPeriod, DateFilterOption } from './DashboardDateFilter';

// ─── Tab icon mapping ────────────────────────────────────────────────────────

const TAB_ICONS: Record<string, React.ReactElement> = {
  overview: <DashboardIcon size={16} strokeWidth={1.75} />,
  noise: <VolumeUpIcon size={16} strokeWidth={1.75} />,
  smartlock: <LockOutlinedIcon size={16} strokeWidth={1.75} />,
  keyexchange: <VpnKeyIcon size={16} strokeWidth={1.75} />,
  simulator: <CalculateIcon size={16} strokeWidth={1.75} />,
};

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

  // Determine primary role for tab filtering
  const primaryRole = useMemo(() => {
    if (!user?.roles?.length) return '';
    const rolePriority = ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST', 'SUPERVISOR', 'TECHNICIAN', 'HOUSEKEEPER', 'LAUNDRY', 'EXTERIOR_TECH'];
    return rolePriority.find((r) => user.roles.includes(r)) ?? user.roles[0];
  }, [user?.roles]);

  // Get visible tabs for this role
  const visibleTabs = useMemo(() => getVisibleTabs(primaryRole), [primaryRole]);

  // Get the tab key for the current selection
  const activeTabKey = visibleTabs[tabValue]?.key ?? 'overview';

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
    if (user?.roles?.includes('TECHNICIAN')) return t('dashboard.titleTechnician');
    if (user?.roles?.includes('HOUSEKEEPER')) return t('dashboard.titleHousekeeper');
    if (user?.roles?.includes('SUPERVISOR')) return t('dashboard.titleSupervisor');
    return t('dashboard.title');
  };

  const getDashboardDescription = () => {
    if (isAdmin) return t('dashboard.subtitleAdmin');
    if (isManager) return t('dashboard.subtitleManager');
    if (isHost) return t('dashboard.subtitleHost');
    if (user?.roles?.includes('TECHNICIAN')) return t('dashboard.subtitleTechnician');
    if (user?.roles?.includes('HOUSEKEEPER')) return t('dashboard.subtitleHousekeeper');
    if (user?.roles?.includes('SUPERVISOR')) return t('dashboard.subtitleSupervisor');
    return t('dashboard.subtitle');
  };

  // ─── Date filter: period chips on Overview and Simulator
  const showDateFilter = activeTabKey === 'overview' || activeTabKey === 'simulator';
  const dateFilterElement = useMemo(() => {
    if (!showDateFilter) return null;
    return (
      <DashboardDateFilter<DashboardPeriod>
        value={period}
        onChange={setPeriod}
        options={PERIOD_OPTIONS}
      />
    );
  }, [showDateFilter, period]);

  // Navigate to tab by key (used by overview for "Voir tout" links)
  const handleNavigateTab = (targetTabIndex: number) => {
    // targetTabIndex is the OLD absolute index. Map to key then find new index.
    const keyMap: Record<number, string> = { 0: 'overview', 1: 'noise', 2: 'smartlock', 3: 'keyexchange', 4: 'simulator' };
    const targetKey = keyMap[targetTabIndex];
    if (!targetKey) return;
    const newIdx = visibleTabs.findIndex((t) => t.key === targetKey);
    if (newIdx >= 0) setTabValue(newIdx);
  };

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
          iconBadge={<DashboardIcon />}
          backPath="/"
          showBackButton={false}
          actions={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              {(isAdmin || isManager || isHost) && (
                <Tooltip title="Channel Manager (bientôt disponible)" arrow>
                  <span>
                    <Chip
                      icon={<SyncIcon size={14} strokeWidth={1.75} />}
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
              )}
              {dateFilterElement && (
                <>
                  <Box sx={{ width: '1px', height: 20, backgroundColor: 'divider', mx: 0.25 }} />
                  {dateFilterElement}
                </>
              )}
            </Box>
          }
        />
      </Box>

      {/* ─── Tabs (dynamic per role) ──────────────────────────────────── */}
      {visibleTabs.length > 1 && (
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
            {visibleTabs.map((tab, idx) => (
              <Tab
                key={tab.key}
                icon={TAB_ICONS[tab.key]}
                iconPosition="start"
                label={t(tab.labelKey) || tab.key}
                {...a11yProps(idx)}
              />
            ))}
          </Tabs>
        </Paper>
      )}

      {/* ─── Tab content ────────────────────────────────────────────────── */}
      {activeTabKey === 'overview' && (
        <Box
          role="tabpanel"
          id="dashboard-tabpanel-0"
          sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', pt: 1 }}
        >
          {isHost && user?.forfait?.toLowerCase() === 'essentiel' && (
            <UpgradeBanner currentForfait={user.forfait} />
          )}
          <DashboardOverview period={period} onNavigateTab={handleNavigateTab} />
        </Box>
      )}

      {activeTabKey === 'noise' && (
        <Box
          role="tabpanel"
          sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', pt: 1 }}
        >
          <DashboardNoiseTab />
        </Box>
      )}

      {activeTabKey === 'smartlock' && (
        <Box
          role="tabpanel"
          sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', pt: 1 }}
        >
          <DashboardSmartLockTab />
        </Box>
      )}

      {activeTabKey === 'keyexchange' && (
        <Box
          role="tabpanel"
          sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', pt: 1 }}
        >
          <DashboardKeyExchangeTab />
        </Box>
      )}

      {activeTabKey === 'simulator' && (
        <Box
          role="tabpanel"
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
