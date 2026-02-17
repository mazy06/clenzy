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
  CalendarMonth,
  Dashboard as DashboardIcon,
  Sync as SyncIcon,
  CalendarToday as CalendarTodayIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import DashboardPlanning from './DashboardPlanning';
import DashboardOverviewContent from './DashboardOverviewContent';
import DashboardDateFilter from './DashboardDateFilter';
import ICalImportModal from './ICalImportModal';
import UpgradeBanner from './UpgradeBanner';
import type { DashboardPeriod, DateFilterOption } from './DashboardDateFilter';
import type { ZoomLevel } from './PlanningToolbar';

// ─── Tab helpers ────────────────────────────────────────────────────────────

function a11yProps(index: number) {
  return {
    id: `dashboard-tab-${index}`,
    'aria-controls': `dashboard-tabpanel-${index}`,
  };
}

// ─── Filter option configs ──────────────────────────────────────────────────

const ZOOM_OPTIONS: DateFilterOption<ZoomLevel>[] = [
  { value: 'compact', label: '1j' },
  { value: 'standard', label: '1h' },
  { value: 'detailed', label: '30min' },
];

const PERIOD_OPTIONS: DateFilterOption<DashboardPeriod>[] = [
  { value: 'week', label: '7j' },
  { value: 'month', label: '30j' },
  { value: 'quarter', label: '90j' },
  { value: 'year', label: '1 an' },
];

// ─── Main component ──────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(isMobile ? 'compact' : 'standard');
  const [tabValue, setTabValue] = useState(0);
  const [icalModalOpen, setIcalModalOpen] = useState(false);

  // Roles
  const isAdmin = user?.roles?.includes('ADMIN') || false;
  const isManager = user?.roles?.includes('MANAGER') || false;
  const isHost = user?.roles?.includes('HOST') || false;
  const isTechnician = user?.roles?.includes('TECHNICIAN');
  const isHousekeeper = user?.roles?.includes('HOUSEKEEPER');
  const isSupervisor = user?.roles?.includes('SUPERVISOR');

  // User role string
  const userRole = (() => {
    if (isAdmin) return 'ADMIN';
    if (isManager) return 'MANAGER';
    if (isSupervisor) return 'SUPERVISOR';
    if (isTechnician) return 'TECHNICIAN';
    if (isHousekeeper) return 'HOUSEKEEPER';
    if (isHost) return 'HOST';
    return 'USER';
  })();

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

  // ─── Date filter: shows zoom chips on Planning tab, period chips on Overview
  const dateFilterElement = useMemo(() => {
    if (tabValue === 0) {
      return (
        <DashboardDateFilter<ZoomLevel>
          value={zoomLevel}
          onChange={setZoomLevel}
          options={ZOOM_OPTIONS}
        />
      );
    }
    return (
      <DashboardDateFilter<DashboardPeriod>
        value={period}
        onChange={setPeriod}
        options={PERIOD_OPTIONS}
      />
    );
  }, [tabValue, zoomLevel, period]);

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
              <Tooltip title="Importer les réservations via un lien iCal (.ics)" arrow>
                <Chip
                  icon={<CalendarTodayIcon sx={{ fontSize: 14 }} />}
                  label="Import iCal"
                  size="small"
                  variant="outlined"
                  onClick={() => setIcalModalOpen(true)}
                  sx={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    height: 28,
                    cursor: 'pointer',
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    '& .MuiChip-icon': { fontSize: 14, color: 'primary.main' },
                    '&:hover': {
                      backgroundColor: 'rgba(107, 138, 154, 0.08)',
                      borderColor: 'primary.dark',
                    },
                  }}
                />
              </Tooltip>
              <Box sx={{ width: '1px', height: 20, backgroundColor: 'divider', mx: 0.25 }} />
              {dateFilterElement}
            </Box>
          }
        />
      </Box>

      {/* ─── Tabs (2 onglets seulement : Planning / Vue d'ensemble) ──── */}
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
            icon={<CalendarMonth sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={t('dashboard.tabs.planning') || 'Planning'}
            {...a11yProps(0)}
          />
          <Tab
            icon={<DashboardIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={t('dashboard.tabs.overview') || "Vue d'ensemble"}
            {...a11yProps(1)}
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
            pt: 1,
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {isHost && user?.forfait?.toLowerCase() === 'essentiel' && (
            <UpgradeBanner currentForfait={user.forfait} />
          )}
          <DashboardPlanning
            forfait={user?.forfait}
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
          />
        </Box>
      )}

      {/* ─── Tab 1: Vue d'ensemble ─────────────────────────────────────── */}
      {tabValue === 1 && (
        <Box
          role="tabpanel"
          id="dashboard-tabpanel-1"
          aria-labelledby="dashboard-tab-1"
          sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          <DashboardOverviewContent period={period} />
        </Box>
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
