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
  Sync as SyncIcon,
} from '../../icons';
import { useAuth } from '../../hooks/useAuth';
import { useAnalyticsEngine } from '../../hooks/useAnalyticsEngine';
import PageHeader from '../../components/PageHeader';
import {
  PageHeaderActionsProvider,
  usePageHeaderActionsSlot,
  resolveTabHeader,
  type TabHeaderMeta,
} from '../../components/PageHeaderActionsContext';
import { useTranslation } from '../../hooks/useTranslation';
import DashboardDateFilter from './DashboardDateFilter';
import DashboardErrorBoundary from './DashboardErrorBoundary';
import DashboardOverview from './DashboardOverview';
import UpgradeBanner from './UpgradeBanner';
import AnalyticsSimulator from './analytics/AnalyticsSimulator';
import { getVisibleTabs } from '../../config/dashboardConfig';
import ChannexMappingDialog from '../settings/components/ChannexMappingDialog';
import type { DashboardPeriod, DateFilterOption } from './DashboardDateFilter';

// ─── Tab icon mapping ────────────────────────────────────────────────────────

const TAB_ICONS: Record<string, React.ReactElement> = {
  overview: <DashboardIcon size={16} strokeWidth={1.75} />,
  simulator: <CalculateIcon size={16} strokeWidth={1.75} />,
};

// La metadata par tab (breadcrumb + subtitle) est construite dans le composant
// via t() pour reagir au changement de langue (cf. dashboardTabMeta plus bas).

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
  // Channel Manager : ouvre la modale guidee de distribution OTA (Channex).
  const [cmOpen, setCmOpen] = useState(false);

  // Slot DOM pour que chaque tab puisse portaler ses actions dans le PageHeader.
  // /!\ DOIT etre declare AVANT tout early return pour respecter Rules of Hooks.
  const { slot: headerActionsSlot, portalContainer: headerActionsPortal } = usePageHeaderActionsSlot();

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

  // Analytics engine (for simulator tab) — inactif tant que l'onglet Simulateur
  // n'est pas affiché : sinon cette instance doublait les fetchs + l'agrégation
  // lourde de celle de DashboardOverview à chaque montage du dashboard.
  const { analytics } = useAnalyticsEngine({
    period,
    interventions: EMPTY_INTERVENTIONS,
    enabled: activeTabKey === 'simulator',
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

  // Resolution du title/subtitle en fonction du tab actif.
  // Title racine = role-based (getDashboardTitle), subtitle racine = role-based
  // (getDashboardDescription) — utilises comme fallback quand le tab n'a pas de meta.
  const visibleTabLabels = visibleTabs.map((tab) => t(tab.labelKey) || tab.key);
  // Mapping label → subtitle reconstruit a chaque render pour suivre la langue.
  const dashboardTabMeta: Record<string, TabHeaderMeta> = {
    [t('dashboard.tabs.overview', "Vue d'ensemble")]: {
      subtitle: t('tabHeaders.dashboard.subtitle.overview', "Vue d'ensemble : KPIs, planning, alertes critiques et accès rapides à votre activité."),
    },
    [t('dashboard.tabs.simulator', 'Simulateur')]: {
      subtitle: t('tabHeaders.dashboard.subtitle.simulator', 'Simulateur analytique : projection revenus, occupation et performance sur scenarios variables.'),
    },
  };
  const { title, subtitle } = resolveTabHeader(
    getDashboardTitle(),
    getDashboardDescription(),
    visibleTabLabels,
    tabValue,
    dashboardTabMeta,
  );

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

  return (
    <PageHeaderActionsProvider slot={headerActionsSlot}>
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
            title={title}
            subtitle={subtitle}
            iconBadge={<DashboardIcon />}
            backPath="/"
            showBackButton={false}
            actions={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                {headerActionsPortal}
                {(isAdmin || isManager || isHost) && (
                  <Tooltip title="Connecter vos OTA via le Channel Manager (Channex)" arrow>
                    <Chip
                      icon={<SyncIcon size={14} strokeWidth={1.75} />}
                      label="Channel Manager"
                      size="small"
                      variant="outlined"
                      clickable
                      onClick={() => setCmOpen(true)}
                      sx={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        height: 28,
                        cursor: 'pointer',
                        borderColor: 'var(--line-2)',
                        color: 'var(--body)',
                        '& .MuiChip-icon': { fontSize: 14, color: 'var(--accent)' },
                        '&:hover': {
                          borderColor: 'var(--accent)',
                          color: 'var(--accent)',
                          backgroundColor: 'var(--accent-soft)',
                          '& .MuiChip-icon': { color: 'var(--accent)' },
                        },
                        transition: 'border-color .15s, color .15s, background-color .15s',
                        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                      }}
                    />
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
            <DashboardOverview period={period} />
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

        {/* Channel Manager : modale guidee de distribution OTA (Channex).
            Mode guided = formulation end-user + degradation gracieuse. */}
        <ChannexMappingDialog open={cmOpen} guided onClose={() => setCmOpen(false)} />
      </Box>
    </PageHeaderActionsProvider>
  );
};

export default Dashboard;
