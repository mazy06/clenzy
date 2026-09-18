import React, { lazy, Suspense, useState } from 'react';
import { useTabKeyParam } from '../../components/tabKeyParam';
import { useVisibleScreenTabs } from '../../hooks/useScreenTabs';
import { useTranslation } from '../../hooks/useTranslation';
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

  // Onglets lus dans le registre partage (config/screenTabs.tsx), droits
  // compris : la barre laterale deplie EXACTEMENT cette liste dans son
  // troisieme tiroir. `value` DERIVE de la position : les onglets sont
  // conditionnels, et `useTabKeyParam` renvoie un index VISIBLE. Des constantes
  // figees (l'ancien TAB_ISSUES = 2) designaient un autre onglet des qu'un rang
  // manquait.
  const tabs = useVisibleScreenTabs('/interventions').map((tab, index) => ({ ...tab, value: index }));

  // Pas de `defaultKey` : l'onglet d'entree est le premier visible, donc le
  // calendrier — y compris pour les profils operationnels, qui ouvraient
  // jusqu'ici la liste des interventions.
  const [activeTab, setActiveTab] = useTabKeyParam(tabs);
  const activeKey = tabs[activeTab]?.key;

  const [actionsContainer, setActionsContainer] = useState<HTMLDivElement | null>(null);
  const [filtersContainer, setFiltersContainer] = useState<HTMLDivElement | null>(null);

  // Un seul onglet accessible → l'ecran se rend seul, sans barre d'onglets.
  // (La barre laterale applique la meme regle : elle n'ouvre pas de tiroir pour
  // un ecran qui n'a qu'un onglet.)
  if (tabs.length <= 1) {
    if (tabs[0]?.key === 'service-requests') return <ServiceRequestsList />;
    return <InterventionsList />;
  }

  return (
    <>
      {/* Le bandeau du header deborde du rembourrage du conteneur de contenu
          (marges negatives). Il vit donc HORS de la colonne ci-dessous, dont le
          `overflow-hidden` decoupait ce debordement sur les quatre cotes : le
          bandeau s'arretait au bord du rembourrage, comme une carte. */}
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
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
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
    </>
  );
};

export default WorkOrdersPage;
