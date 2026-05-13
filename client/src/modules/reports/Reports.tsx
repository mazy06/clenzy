import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
import {
  Euro as EuroIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  Home as HomeIcon,
  BarChart as BarChartIcon,
} from '../../icons';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
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

const TAB_PANEL_SX = { pt: 1.5 } as const;

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
        iconBadge={<BarChartIcon />}
        backPath="/dashboard"
        showBackButton={false}
      />

      <PageTabs
        options={REPORT_TABS.map((tab, index) => ({
          label: t(tab.labelKey),
          icon: tab.icon,
          disabled: !allowedTabs[index],
        }))}
        value={activeTab}
        onChange={setActiveTab}
      />

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
