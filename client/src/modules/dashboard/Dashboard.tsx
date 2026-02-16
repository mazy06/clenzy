import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Button,
  Tooltip,
} from '@mui/material';
import {
  CalendarMonth,
  Dashboard as DashboardIcon,
  Sync as SyncIcon,
  CalendarToday as CalendarTodayIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { DashboardDataProvider } from '../../hooks/useDashboardData';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import DashboardPlanning from './DashboardPlanning';
import DashboardOverviewContent from './DashboardOverviewContent';
import DashboardDateFilter from './DashboardDateFilter';
import ICalImportModal from './ICalImportModal';
import UpgradeBanner from './UpgradeBanner';
import type { DashboardPeriod } from './DashboardDateFilter';

// ─── Tab helpers ────────────────────────────────────────────────────────────

function a11yProps(index: number) {
  return {
    id: `dashboard-tab-${index}`,
    'aria-controls': `dashboard-tabpanel-${index}`,
  };
}

// ─── Main component ──────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [period, setPeriod] = useState<DashboardPeriod>('month');
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
            <Tooltip title="Importer les reservations via un lien iCal (.ics)" arrow>
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

      {/* ─── Tabs (2 onglets seulement : Planning / Vue d'ensemble) ──── */}
      <Paper sx={{ borderBottom: 1, borderColor: 'divider', mb: 0 }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          sx={{
            minHeight: 38,
            '& .MuiTab-root': {
              minHeight: 38,
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
            height: 'calc(100vh - 220px)',
            minHeight: 400,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {isHost && user?.forfait?.toLowerCase() === 'essentiel' && (
            <UpgradeBanner currentForfait={user.forfait} />
          )}
          <DashboardPlanning forfait={user?.forfait} />
        </Box>
      )}

      {/* ─── Tab 1: Vue d'ensemble (wrapped with DashboardDataProvider) ── */}
      {tabValue === 1 && (
        <Box
          role="tabpanel"
          id="dashboard-tabpanel-1"
          aria-labelledby="dashboard-tab-1"
        >
          <DashboardDataProvider
            userRole={userRole}
            user={user}
            t={t}
            isAdmin={isAdmin}
            isManager={isManager}
            isHost={isHost}
          >
            <DashboardOverviewContent />
          </DashboardDataProvider>
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
