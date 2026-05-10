import React, { useState, useEffect, useCallback } from 'react';
import { Box, Tab, Tabs, CircularProgress, Alert } from '@mui/material';
import {
  Euro as EuroIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  Home as HomeIcon,
} from '../../icons';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import {
  FinancialReport,
  InterventionsReport,
  TeamsReport,
  PropertiesReport,
} from './ReportDetails';

// ─── Tab configuration ──────────────────────────────────────────────────────

interface ReportTab {
  id: string;
  labelKey: string;
  icon: React.ReactElement;
  permission: string;
  Component: React.FC;
}

const REPORT_TABS: ReportTab[] = [
  {
    id: 'financial',
    labelKey: 'reports.sections.financial.title',
    icon: <EuroIcon />,
    permission: 'reports:view',
    Component: FinancialReport,
  },
  {
    id: 'interventions',
    labelKey: 'reports.sections.interventions.title',
    icon: <ScheduleIcon />,
    permission: 'reports:view',
    Component: InterventionsReport,
  },
  {
    id: 'teams',
    labelKey: 'reports.sections.teams.title',
    icon: <PeopleIcon />,
    permission: 'reports:view',
    Component: TeamsReport,
  },
  {
    id: 'properties',
    labelKey: 'reports.sections.properties.title',
    icon: <HomeIcon />,
    permission: 'reports:view',
    Component: PropertiesReport,
  },
];

// ─── Stable sx constants ────────────────────────────────────────────────────

const TABS_SX = {
  minHeight: 42,
  '& .MuiTab-root': {
    minHeight: 42,
    textTransform: 'none' as const,
    fontWeight: 600,
    fontSize: '0.8125rem',
    gap: 0.75,
  },
  '& .MuiTabs-indicator': {
    height: 2.5,
    borderRadius: '2px 2px 0 0',
  },
} as const;

const TAB_PANEL_SX = { pt: 2.5 } as const;

// ─── Component ──────────────────────────────────────────────────────────────

const Reports: React.FC = () => {
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [allowedTabs, setAllowedTabs] = useState<boolean[]>([]);

  // Check permissions for all tabs
  useEffect(() => {
    const checkPermissions = async () => {
      const results = await Promise.all(
        REPORT_TABS.map((tab) => hasPermissionAsync(tab.permission)),
      );
      setAllowedTabs(results);
      setPermissionsLoaded(true);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  }, []);

  if (!permissionsLoaded) {
    return (
      <Box>
        <PageHeader
          title={t('reports.title')}
          subtitle={t('reports.subtitle')}
          backPath="/dashboard"
          showBackButton={false}
        />
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  // No tabs accessible
  const hasAnyAccess = allowedTabs.some(Boolean);
  if (!hasAnyAccess) {
    return (
      <Box>
        <PageHeader
          title={t('reports.title')}
          subtitle={t('reports.subtitle')}
          backPath="/dashboard"
          showBackButton={false}
        />
        <Alert severity="info" sx={{ mt: 1 }}>
          {t('reports.noPermissions')}
        </Alert>
      </Box>
    );
  }

  const currentTab = REPORT_TABS[activeTab];
  const CurrentComponent = currentTab.Component;

  return (
    <Box>
      <PageHeader
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
        backPath="/dashboard"
        showBackButton={false}
      />

      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={TABS_SX}
      >
        {REPORT_TABS.map((tab, index) => (
          <Tab
            key={tab.id}
            icon={tab.icon}
            iconPosition="start"
            label={t(tab.labelKey)}
            disabled={!allowedTabs[index]}
          />
        ))}
      </Tabs>

      <Box sx={TAB_PANEL_SX}>
        {allowedTabs[activeTab] ? (
          <CurrentComponent />
        ) : (
          <Alert severity="warning">
            {t('reports.noPermission')}
          </Alert>
        )}
      </Box>
    </Box>
  );
};

export default Reports;
