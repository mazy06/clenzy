import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, Spinner } from '../../components/ui';
import { Info, TriangleAlert } from 'lucide-react';
import {
  Dashboard as DashboardIcon,
  Euro as EuroIcon,
  Percent as PercentIcon,
  PriceChange as PriceChangeIcon,
  Home as HomeIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
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
import OverviewReport from './OverviewReport';
import RevenueReport from './RevenueReport';
import OccupancyReport from './OccupancyReport';
import PricingReport from './PricingReport';
import PropertiesReport from './PropertiesReport';
import InterventionsReport from './InterventionsReport';
import TeamsReport from './TeamsReport';
import PaceReport from './PaceReport';
import ReportComposer from './document/ReportComposer';
import type { DashboardPeriod, DateFilterOption } from '../dashboard/DashboardDateFilter';
import PeriodSegmented from './PeriodSegmented';

interface ReportTab {
  id: string;
  labelKey: string;
  labelDefault: string;
  subtitleKey: string;
  subtitleDefault: string;
  icon: React.ReactElement;
  permission: string;
  Component: React.FC<{ period?: DashboardPeriod }>;
  /** L'onglet lit la période choisie dans l'en-tête. */
  hasPeriodFilter: boolean;
}

/**
 * Les onglets du module Rapports.
 *
 * <p>L'ancien onglet « Financier » portait à lui seul les KPI globaux, les
 * alertes, les recommandations, les tarifs, les prévisions et la comptabilité :
 * quatre écrans de défilement pour six questions distinctes. Il est éclaté en
 * Synthèse (ce qui appelle une décision), Revenus (l'argent), Occupation (le
 * remplissage) et Tarifs &amp; prévisions (ce qui vient).</p>
 */
const REPORT_TABS: ReportTab[] = [
  {
    id: 'overview',
    labelKey: 'reports.sections.overview.title',
    labelDefault: 'Synthèse',
    subtitleKey: 'tabHeaders.reports.subtitle.overview',
    subtitleDefault:
      "Ce que la période a rapporté, comment le parc a tourné, et ce qui appelle une décision.",
    icon: <DashboardIcon />,
    permission: 'reports:view',
    Component: OverviewReport,
    hasPeriodFilter: true,
  },
  {
    id: 'revenue',
    labelKey: 'reports.sections.revenue.title',
    labelDefault: 'Revenus',
    subtitleKey: 'tabHeaders.reports.subtitle.revenue',
    subtitleDefault:
      "Revenus par mois, par canal et par bien, marge nette et postes de coût d'exploitation.",
    icon: <EuroIcon />,
    permission: 'reports:view',
    Component: RevenueReport,
    hasPeriodFilter: true,
  },
  {
    id: 'occupancy',
    labelKey: 'reports.sections.occupancy.title',
    labelDefault: 'Occupation',
    subtitleKey: 'tabHeaders.reports.subtitle.occupancy',
    subtitleDefault:
      'Nuits occupées et vacantes, taux par bien et sources de réservation sur la période.',
    icon: <PercentIcon />,
    permission: 'reports:view',
    Component: OccupancyReport,
    hasPeriodFilter: true,
  },
  {
    id: 'pricing',
    labelKey: 'reports.sections.pricing.title',
    labelDefault: 'Tarifs & prévisions',
    subtitleKey: 'tabHeaders.reports.subtitle.pricing',
    subtitleDefault:
      'Prix moyen face au RevPAN, prix conseillé, élasticité et projection de revenus par scénario.',
    icon: <PriceChangeIcon />,
    permission: 'reports:view',
    Component: PricingReport,
    hasPeriodFilter: true,
  },
  {
    id: 'pace',
    labelKey: 'reports.sections.pace.title',
    labelDefault: 'Pace',
    subtitleKey: 'tabHeaders.reports.subtitle.pace',
    subtitleDefault:
      "Nuits réservées pour les prochains mois comparées à l'an dernier au même recul, pickup récent et montée des réservations.",
    icon: <TrendingUpIcon />,
    permission: 'reports:view',
    Component: PaceReport,
    hasPeriodFilter: false,
  },
  {
    id: 'properties',
    labelKey: 'reports.sections.properties.title',
    labelDefault: 'Biens',
    subtitleKey: 'tabHeaders.reports.subtitle.properties',
    subtitleDefault:
      "Score de performance, coûts d'exploitation et marge nette bien par bien, face à la référence du portefeuille.",
    icon: <HomeIcon />,
    permission: 'reports:view',
    Component: PropertiesReport,
    hasPeriodFilter: true,
  },
  {
    id: 'interventions',
    labelKey: 'reports.sections.interventions.title',
    labelDefault: 'Interventions',
    subtitleKey: 'tabHeaders.reports.subtitle.interventions',
    subtitleDefault:
      'Volume, taux de réalisation et arriéré des interventions par statut, type et priorité.',
    icon: <ScheduleIcon />,
    permission: 'reports:view',
    Component: InterventionsReport,
    hasPeriodFilter: false,
  },
  {
    id: 'teams',
    labelKey: 'reports.sections.teams.title',
    labelDefault: 'Équipes',
    subtitleKey: 'tabHeaders.reports.subtitle.teams',
    subtitleDefault: 'Charge de travail, taux de réalisation et retards par équipe.',
    icon: <PeopleIcon />,
    permission: 'reports:view',
    Component: TeamsReport,
    hasPeriodFilter: false,
  },
  {
    id: 'custom',
    labelKey: 'reports.sections.custom.title',
    labelDefault: 'Rapports d’analyse',
    subtitleKey: 'tabHeaders.reports.subtitle.custom',
    subtitleDefault:
      'Composez un document destiné à un propriétaire, à l’équipe ou à un prospect, puis diffusez-le en PDF.',
    icon: <TuneIcon />,
    permission: 'reports:view',
    Component: ReportComposer,
    hasPeriodFilter: false,
  },
];

const PERIOD_OPTIONS: DateFilterOption<DashboardPeriod>[] = [
  { value: 'week', label: '7j' },
  { value: 'month', label: '30j' },
  { value: 'quarter', label: '90j' },
  { value: 'year', label: '1 an' },
];

const TAB_PANEL_CLASS = 'pt-[9px]';

const Reports: React.FC = () => {
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useTabKeyParam(REPORT_TABS.map((rt) => ({ key: rt.id })));
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [allowedTabs, setAllowedTabs] = useState<boolean[]>([]);
  const [period, setPeriod] = useState<DashboardPeriod>('month');

  const { slot: headerActionsSlot, portalContainer: headerActionsPortal } = usePageHeaderActionsSlot();

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
      <div>
        <PageHeader
          title={t('reports.title')}
          subtitle={t('reports.subtitle')}
          backPath="/dashboard"
          showBackButton={false}
        />
        <div className="flex justify-center p-6">
          <Spinner className="size-10" />
        </div>
      </div>
    );
  }

  const hasAnyAccess = allowedTabs.some(Boolean);
  if (!hasAnyAccess) {
    return (
      <div>
        <PageHeader
          title={t('reports.title')}
          subtitle={t('reports.subtitle')}
          backPath="/dashboard"
          showBackButton={false}
        />
        <Alert variant="info" className="mt-1.5">
          <Info />
          <AlertDescription>{t('reports.noPermissions')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const currentTab = REPORT_TABS[activeTab];
  const CurrentComponent = currentTab.Component;

  const tabs = REPORT_TABS.map((tab, index) => ({
    label: t(tab.labelKey, tab.labelDefault),
    icon: tab.icon,
    disabled: !allowedTabs[index],
    hidden: false,
  }));
  const visibleTabs = tabs.filter((tab) => !tab.hidden);
  const reportsTabMeta: Record<string, TabHeaderMeta> = Object.fromEntries(
    REPORT_TABS.map((tab) => [
      t(tab.labelKey, tab.labelDefault),
      { subtitle: t(tab.subtitleKey, tab.subtitleDefault) },
    ]),
  );
  const { title, subtitle } = resolveTabHeader(
    t('tabHeaders.reports.title', 'Rapports'),
    t('tabHeaders.reports.default', 'Générez et consultez les rapports de votre plateforme Baitly'),
    visibleTabs.map((tab) => tab.label),
    activeTab,
    reportsTabMeta,
  );

  return (
    <PageHeaderActionsProvider slot={headerActionsSlot}>
      <div>
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

        <PageTabs options={tabs} value={activeTab} onChange={setActiveTab} />

        <div className={TAB_PANEL_CLASS}>
          {allowedTabs[activeTab] ? (
            <CurrentComponent period={currentTab.hasPeriodFilter ? period : undefined} />
          ) : (
            <Alert variant="warning">
              <TriangleAlert />
              <AlertDescription>{t('reports.noPermission')}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </PageHeaderActionsProvider>
  );
};

export default Reports;
