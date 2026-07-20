import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
import {
  Euro as EuroIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  Home as HomeIcon,
  BarChart as BarChartIcon,
  TrendingUp as TrendingUpIcon,
  Tune as TuneIcon,
} from '../../icons';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import { useTabKeyParam } from '../../components/tabKeyParam';
import {
  PageHeaderActionsProvider,
  usePageHeaderActionsSlot,
  resolveTabHeader,
  type TabHeaderMeta,
} from '../../components/PageHeaderActionsContext';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import {
  FinancialReport,
  InterventionsReport,
  TeamsReport,
  PropertiesReport,
} from './ReportDetails';
import PaceReport from './PaceReport';
import CustomReport from './CustomReport';
import type {
  DashboardPeriod,
  DateFilterOption,
} from '../dashboard/DashboardDateFilter';
import PeriodSegmented from './PeriodSegmented';

// ─── Tab configuration ──────────────────────────────────────────────────────

interface ReportTabComponentProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
}

interface ReportTab {
  id: string;
  labelKey: string;
  icon: React.ReactElement;
  permission: string;
  Component: React.FC<Partial<ReportTabComponentProps>>;
  hasPeriodFilter: boolean;
}

const REPORT_TABS: ReportTab[] = [
  {
    id: 'financial',
    labelKey: 'reports.sections.financial.title',
    icon: <EuroIcon />,
    permission: 'reports:view',
    Component: FinancialReport,
    hasPeriodFilter: true,
  },
  {
    id: 'interventions',
    labelKey: 'reports.sections.interventions.title',
    icon: <ScheduleIcon />,
    permission: 'reports:view',
    Component: InterventionsReport,
    hasPeriodFilter: false,
  },
  {
    id: 'teams',
    labelKey: 'reports.sections.teams.title',
    icon: <PeopleIcon />,
    permission: 'reports:view',
    Component: TeamsReport,
    hasPeriodFilter: false,
  },
  {
    id: 'properties',
    labelKey: 'reports.sections.properties.title',
    icon: <HomeIcon />,
    permission: 'reports:view',
    Component: PropertiesReport,
    hasPeriodFilter: true,
  },
  {
    id: 'pace',
    labelKey: 'reports.sections.pace.title',
    icon: <TrendingUpIcon />,
    permission: 'reports:view',
    Component: PaceReport,
    hasPeriodFilter: false,
  },
  {
    id: 'custom',
    labelKey: 'reports.sections.custom.title',
    icon: <TuneIcon />,
    permission: 'reports:view',
    Component: CustomReport,
    hasPeriodFilter: false,
  },
];

const PERIOD_OPTIONS: DateFilterOption<DashboardPeriod>[] = [
  { value: 'week', label: '7j' },
  { value: 'month', label: '30j' },
  { value: 'quarter', label: '90j' },
  { value: 'year', label: '1 an' },
];

// ─── Stable sx constants ────────────────────────────────────────────────────

const TAB_PANEL_SX = { pt: 1.5 } as const;

// La metadata par tab (breadcrumb + subtitle) est construite dans le composant
// via t() pour reagir au changement de langue (cf. reportsTabMeta plus bas).

// ─── Component ──────────────────────────────────────────────────────────────

const Reports: React.FC = () => {
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();
  // REPORT_TABS.id sert de cle stable d'URL (?tab=<id>). Tous les onglets sont toujours affiches
  // (juste disabled si non autorise), donc l'index visible == l'index dans REPORT_TABS.
  const [activeTab, setActiveTab] = useTabKeyParam(REPORT_TABS.map((rt) => ({ key: rt.id })));
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [allowedTabs, setAllowedTabs] = useState<boolean[]>([]);
  const [period, setPeriod] = useState<DashboardPeriod>('month');

  // Slot DOM pour que chaque tab puisse portaler ses actions dans le PageHeader.
  // /!\ DOIT etre declare AVANT tout early return pour respecter Rules of Hooks.
  const { slot: headerActionsSlot, portalContainer: headerActionsPortal } = usePageHeaderActionsSlot();

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

  // Source de verite des tabs visibles — utilisee pour PageTabs ET resolveTabHeader.
  // Ici tous les tabs restent affiches (juste disabled si pas autorise), donc on
  // les indexe tous (pas de filtre hidden).
  const tabs = REPORT_TABS.map((tab, index) => ({
    label: t(tab.labelKey),
    icon: tab.icon,
    disabled: !allowedTabs[index],
    hidden: false,
  }));
  const visibleTabs = tabs.filter((tab) => !tab.hidden);
  // Mapping label → subtitle reconstruit a chaque render pour suivre la langue.
  const reportsTabMeta: Record<string, TabHeaderMeta> = {
    [t('reports.sections.financial.title')]: {
      subtitle: t('tabHeaders.reports.subtitle.financial', "Revenus par bien, coûts d'exploitation, marge nette et exports comptables sur la période choisie."),
    },
    [t('reports.sections.interventions.title')]: {
      subtitle: t('tabHeaders.reports.subtitle.interventions', 'Volume, délais moyens et taux de réalisation des interventions par type et par équipe.'),
    },
    [t('reports.sections.teams.title')]: {
      subtitle: t('tabHeaders.reports.subtitle.teams', 'Charge de travail, performance et disponibilités par équipe et par membre.'),
    },
    [t('reports.sections.properties.title')]: {
      subtitle: t('tabHeaders.reports.subtitle.properties', "Taux d'occupation, RevPAR, alertes maintenance et indicateurs de santé par bien."),
    },
    [t('reports.sections.pace.title')]: {
      subtitle: t('tabHeaders.reports.subtitle.pace', "Nuits réservées pour les prochains mois comparées à l'an dernier au même recul, pickup récent et montée des réservations."),
    },
    [t('reports.sections.custom.title')]: {
      subtitle: t('tabHeaders.reports.subtitle.custom', 'Rapport à la carte : croisez propriétés, canaux, périodes et pays sur vos métriques revenue.'),
    },
  };
  const { title, subtitle } = resolveTabHeader(
    t('tabHeaders.reports.title', 'Rapports'),
    t('tabHeaders.reports.default', 'Générez et consultez les rapports de votre plateforme Baitly'),
    visibleTabs.map((tab) => tab.label),
    activeTab,
    reportsTabMeta,
  );

  return (
    <PageHeaderActionsProvider slot={headerActionsSlot}>
      <Box>
        <PageHeader
          title={title}
          subtitle={subtitle}
          iconBadge={<BarChartIcon />}
          backPath="/dashboard"
          showBackButton={false}
          actions={headerActionsPortal}
          filters={
            currentTab.hasPeriodFilter ? (
              <PeriodSegmented<DashboardPeriod>
                value={period}
                onChange={setPeriod}
                options={PERIOD_OPTIONS}
                ariaLabel={t('reports.periodFilter', 'Période')}
              />
            ) : undefined
          }
        />

        <PageTabs
          options={tabs}
          value={activeTab}
          onChange={setActiveTab}
        />

        <Box sx={TAB_PANEL_SX}>
          {allowedTabs[activeTab] ? (
            currentTab.hasPeriodFilter ? (
              <CurrentComponent period={period} onPeriodChange={setPeriod} />
            ) : (
              <CurrentComponent />
            )
          ) : (
            <Alert severity="warning">
              {t('reports.noPermission')}
            </Alert>
          )}
        </Box>
      </Box>
    </PageHeaderActionsProvider>
  );
};

export default Reports;
