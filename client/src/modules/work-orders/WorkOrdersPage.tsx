import React, { lazy, Suspense, useState } from 'react';
import {
  Assignment,
  Build,
  CalendarMonth,
  ReportProblem,
} from '../../icons';
import { useTabKeyParam } from '../../components/tabKeyParam';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { MANAGER_ROLES, OPERATIONAL_ROLES } from '../../constants/roles';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import ServiceRequestsList from '../service-requests/ServiceRequestsList';
import InterventionsList from '../interventions/InterventionsList';
import IssuesList from './IssuesList';
import { Skeleton } from '../../components/ui';

// Charge a la demande : FullCalendar et ses quatre plugins pesent lourd, et
// tous les profils ne restent pas sur cet onglet. Son chunk se charge pendant
// que le squelette occupe la place.
const CalendarPage = lazy(() => import('../calendar/CalendarPage'));

const PORTAL_STYLE = { display: 'contents' } as const;

const WorkOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, hasAnyRole } = useAuth();

  const isOperational = hasAnyRole([...OPERATIONAL_ROLES]);
  const canViewServiceRequests = (user?.permissions?.includes('service-requests:view') || isOperational) ?? false;
  const canViewInterventions = (user?.permissions?.includes('interventions:view') || canViewServiceRequests) ?? false;
  const showBothTabs = canViewServiceRequests && canViewInterventions;
  const canViewIssues = hasAnyRole([...MANAGER_ROLES]);

  // `value` DERIVE de la position : les onglets sont conditionnels, et
  // `useTabKeyParam` renvoie un index VISIBLE. Des constantes figees (l'ancien
  // TAB_ISSUES = 2) designaient un autre onglet des qu'un rang manquait.
  const tabs = [
    // Calendrier des interventions EN TETE : c'est la vue d'entree de l'ecran
    // (URL sans `?tab=`). Meme perimetre que l'onglet Interventions — c'est la
    // permission que porte l'ecran lui-meme.
    ...(canViewInterventions
      ? [{ key: 'calendar', label: t('workOrders.tabs.calendar', 'Calendrier'), icon: <CalendarMonth /> }]
      : []),
    ...(canViewServiceRequests
      ? [{ key: 'service-requests', label: t('workOrders.tabs.serviceRequests'), icon: <Assignment /> }]
      : []),
    ...(canViewInterventions
      ? [{ key: 'interventions', label: t('workOrders.tabs.interventions'), icon: <Build /> }]
      : []),
    ...(canViewIssues && showBothTabs
      ? [{ key: 'issues', label: t('workOrders.tabs.issues'), icon: <ReportProblem /> }]
      : []),
  ].map((tab, index) => ({ ...tab, value: index }));

  // Pas de `defaultKey` : l'onglet d'entree est le premier visible, donc le
  // calendrier — y compris pour les profils operationnels, qui ouvraient
  // jusqu'ici la liste des interventions.
  const [activeTab, setActiveTab] = useTabKeyParam(tabs);
  const activeKey = tabs[activeTab]?.key;

  const [actionsContainer, setActionsContainer] = useState<HTMLDivElement | null>(null);
  const [filtersContainer, setFiltersContainer] = useState<HTMLDivElement | null>(null);

  // Un seul onglet accessible → l'ecran se rend seul, sans barre d'onglets.
  if (tabs.length <= 1) {
    if (canViewServiceRequests) return <ServiceRequestsList />;
    return <InterventionsList />;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="shrink-0">
        <PageHeader
          title={tabs.find((tb) => tb.value === activeTab)?.label ?? t('workOrders.title')}
          subtitle={t('workOrders.subtitle')}
          backPath="/dashboard"
          showBackButton={false}
          actions={<div ref={setActionsContainer} style={PORTAL_STYLE} />}
          filters={<div ref={setFiltersContainer} style={PORTAL_STYLE} />}
        />
      </div>
      <div className="shrink-0">
        <PageTabs
          options={tabs}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {activeKey === 'service-requests' && (
        <ServiceRequestsList embedded actionsContainer={actionsContainer} filtersContainer={filtersContainer} />
      )}
      {activeKey === 'interventions' && (
        <InterventionsList embedded actionsContainer={actionsContainer} filtersContainer={filtersContainer} />
      )}
      {activeKey === 'issues' && (
        <IssuesList embedded actionsContainer={actionsContainer} filtersContainer={filtersContainer} />
      )}
      {activeKey === 'calendar' && (
        <Suspense fallback={<Skeleton className="min-h-0 flex-1 rounded-lg" />}>
          <CalendarPage embedded filtersContainer={filtersContainer} />
        </Suspense>
      )}
    </div>
  );
};

export default WorkOrdersPage;
