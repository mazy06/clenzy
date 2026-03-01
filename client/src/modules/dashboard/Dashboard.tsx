import React, { useState, useMemo } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Chip,
  Tooltip,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  VolumeUp as VolumeUpIcon,
  LockOutlined as LockOutlinedIcon,
  Sync as SyncIcon,
  CalendarToday as CalendarTodayIcon,
  Dashboard as DashboardIcon,
  Euro as EuroIcon,
  Groups as GroupsIcon,
  Tune as TuneIcon,
  Calculate as CalculateIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import DashboardAnalyticsContent from './DashboardAnalyticsContent';
import DashboardNoiseTab from './DashboardNoiseTab';
import DashboardSmartLockTab from './DashboardSmartLockTab';
import DashboardDateFilter from './DashboardDateFilter';
import ICalImportModal from './ICalImportModal';
import UpgradeBanner from './UpgradeBanner';
import { useICalFeeds } from './useICalImport';
import type { DashboardPeriod, DateFilterOption } from './DashboardDateFilter';

// ─── Source logos for connected iCal feeds ──────────────────────────────────
import airbnbLogoSmall from '../../assets/logo/airbnb-logo-small.png';
import bookingLogoSmall from '../../assets/logo/logo-booking-planning.png';
import clenzyLogo from '../../assets/logo/clenzy-logo.png';
import homeAwayLogo from '../../assets/logo/HomeAway-logo.png';
import expediaLogo from '../../assets/logo/expedia-logo.png';
import leboncoinLogo from '../../assets/logo/Leboncoin-logo.png';

const SOURCE_LOGO_MAP: Record<string, { logo: string; label: string }> = {
  airbnb:            { logo: airbnbLogoSmall, label: 'Airbnb' },
  'booking.com':     { logo: bookingLogoSmall, label: 'Booking.com' },
  booking:           { logo: bookingLogoSmall, label: 'Booking.com' },
  vrbo:              { logo: homeAwayLogo, label: 'Vrbo' },
  homeaway:          { logo: homeAwayLogo, label: 'HomeAway' },
  expedia:           { logo: expediaLogo, label: 'Expedia' },
  leboncoin:         { logo: leboncoinLogo, label: 'Leboncoin' },
  direct:            { logo: clenzyLogo, label: 'Direct' },
  'google calendar': { logo: '', label: 'Google Calendar' },
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

// ─── Main component ──────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [tabValue, setTabValue] = useState(0);
  const [analyticsSubTab, setAnalyticsSubTab] = useState(0);
  const [icalModalOpen, setIcalModalOpen] = useState(false);

  // Connected iCal feeds → unique source icons
  const { data: icalFeeds } = useICalFeeds();
  const connectedSources = useMemo(() => {
    if (!icalFeeds?.length) return [];
    const seen = new Set<string>();
    return icalFeeds
      .map(f => f.sourceName?.toLowerCase().trim())
      .filter((s): s is string => !!s && !seen.has(s) && (seen.add(s), true))
      .map(key => SOURCE_LOGO_MAP[key])
      .filter((entry): entry is { logo: string; label: string } => !!entry && !!entry.logo);
  }, [icalFeeds]);

  // Roles
  const isAdmin = user?.roles?.includes('SUPER_ADMIN') || false;
  const isManager = user?.roles?.includes('SUPER_MANAGER') || false;
  const isHost = user?.roles?.includes('HOST') || false;
  const isTechnician = user?.roles?.includes('TECHNICIAN');
  const isHousekeeper = user?.roles?.includes('HOUSEKEEPER');
  const isSupervisor = user?.roles?.includes('SUPERVISOR');
  const isLaundry = user?.roles?.includes('LAUNDRY');
  const isExteriorTech = user?.roles?.includes('EXTERIOR_TECH');

  // User role string
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

  // ─── Date filter: period chips on Analytics (tab 0), none on others
  const dateFilterElement = useMemo(() => {
    if (tabValue === 0) {
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
              {/* Icônes des sources OTA connectées */}
              {connectedSources.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                  {connectedSources.map((src) => (
                    <Tooltip key={src.label} title={src.label} arrow>
                      <Box
                        sx={{
                          width: 22,
                          height: 22,
                          minWidth: 22,
                          borderRadius: '50%',
                          border: '1.5px solid',
                          borderColor: 'divider',
                          backgroundColor: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <img
                          src={src.logo}
                          alt={src.label}
                          width={14}
                          height={14}
                          style={{ objectFit: 'contain', borderRadius: '50%' }}
                        />
                      </Box>
                    </Tooltip>
                  ))}
                </Box>
              )}
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

      {/* ─── Tabs (3 onglets : Analytics / Nuisance sonore / Serrures) ── */}
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
            icon={<BarChartIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={t('dashboard.tabs.analytics') || 'Analytics'}
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
        </Tabs>

        {/* ─── Analytics sub-tabs (dropdown-style continuation) ───────── */}
        {tabValue === 0 && (
          <>
            <Divider sx={{ borderColor: 'divider' }} />
            <Box sx={{ bgcolor: 'rgba(107, 138, 154, 0.03)' }}>
              <Tabs
                value={analyticsSubTab}
                onChange={(_, v) => setAnalyticsSubTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  minHeight: 34,
                  '& .MuiTab-root': {
                    minHeight: 34,
                    py: 0.5,
                    px: 1.5,
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    textTransform: 'none',
                    letterSpacing: '0.01em',
                    color: 'text.secondary',
                    '&.Mui-selected': {
                      fontWeight: 700,
                      color: '#6B8A9A',
                    },
                  },
                  '& .MuiTabs-indicator': {
                    height: 2,
                    borderRadius: 1,
                    bgcolor: '#6B8A9A',
                  },
                }}
              >
                <Tab
                  icon={<DashboardIcon sx={{ fontSize: 15 }} />}
                  iconPosition="start"
                  label={t('dashboard.analytics.subTabs.overview')}
                />
                <Tab
                  icon={<EuroIcon sx={{ fontSize: 15 }} />}
                  iconPosition="start"
                  label={t('dashboard.analytics.subTabs.revenueAndPricing')}
                />
                <Tab
                  icon={<GroupsIcon sx={{ fontSize: 15 }} />}
                  iconPosition="start"
                  label={t('dashboard.analytics.subTabs.occupancyAndClients')}
                />
                <Tab
                  icon={<TuneIcon sx={{ fontSize: 15 }} />}
                  iconPosition="start"
                  label={t('dashboard.analytics.subTabs.performanceAndTools')}
                />
                <Tab
                  icon={<CalculateIcon sx={{ fontSize: 15 }} />}
                  iconPosition="start"
                  label={t('dashboard.analytics.subTabs.simulator')}
                />
              </Tabs>
            </Box>
          </>
        )}
      </Paper>

      {/* ─── Tab 0: Analytics ──────────────────────────────────────────── */}
      {tabValue === 0 && (
        <Box
          role="tabpanel"
          id="dashboard-tabpanel-0"
          aria-labelledby="dashboard-tab-0"
          sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          {isHost && user?.forfait?.toLowerCase() === 'essentiel' && (
            <UpgradeBanner currentForfait={user.forfait} />
          )}
          <DashboardAnalyticsContent period={period} subTab={analyticsSubTab} />
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

      {/* ─── iCal Import Modal ──────────────────────────────────────────── */}
      <ICalImportModal
        open={icalModalOpen}
        onClose={() => setIcalModalOpen(false)}
      />
    </Box>
  );
};

export default Dashboard;
