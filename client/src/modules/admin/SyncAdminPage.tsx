import React, { useState, useMemo, useEffect, createContext, useContext } from 'react';
import { Box } from '@mui/material';
import {
  Cable,
  Sync,
  Outbox,
  CalendarMonth,
  AccountTree,
  BugReport,
  CompareArrows,
} from '../../icons';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import {
  resolveTabHeader,
  type TabHeaderMeta,
} from '../../components/PageHeaderActionsContext';
import { useTranslation } from '../../hooks/useTranslation';
import ConnectionsTab from './sync/ConnectionsTab';
import EventsTab from './sync/EventsTab';
import OutboxTab from './sync/OutboxTab';
import CalendarAuditTab from './sync/CalendarAuditTab';
import MappingsTab from './sync/MappingsTab';
import DiagnosticsTab from './sync/DiagnosticsTab';
import ReconciliationTab from './sync/ReconciliationTab';

// Le contexte interne SyncAdminHeader est conserve : il expose deux slots
// distincts (filters + actions) qui s'alimentent dans deux props differentes
// de PageHeader. La primitive generique PageHeaderActionsContext ne couvre
// qu'un seul slot — la migration aurait force un seul slot fusionne, ce qui
// degrade la separation visuelle filters/actions du PageHeader.
interface SyncAdminHeaderApi {
  setHeaderFilters: (filters: React.ReactNode) => void;
  setHeaderActions: (actions: React.ReactNode) => void;
}

const SyncAdminHeaderContext = createContext<SyncAdminHeaderApi>({
  setHeaderFilters: () => {},
  setHeaderActions: () => {},
});

export const useSyncAdminHeader = (): SyncAdminHeaderApi => useContext(SyncAdminHeaderContext);

// ─── Tab definitions (source of truth) ──────────────────────────────────────
// Les labels et la metadata sont construits dans le composant via t() pour
// reagir au changement de langue.
const TAB_ICONS = [
  <Cable />,
  <Sync />,
  <Outbox />,
  <CalendarMonth />,
  <AccountTree />,
  <BugReport />,
  <CompareArrows />,
] as const;

const SyncAdminPage: React.FC = () => {
  const { t } = useTranslation();
  const [tabValue, setTabValue] = useState(0);
  const [headerFilters, setHeaderFilters] = useState<React.ReactNode>(null);
  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);

  // Reset both slots when switching tabs so a previous tab's content never leaks.
  useEffect(() => {
    setHeaderFilters(null);
    setHeaderActions(null);
  }, [tabValue]);

  const headerApi = useMemo<SyncAdminHeaderApi>(
    () => ({ setHeaderFilters, setHeaderActions }),
    [],
  );

  // Source de verite des tabs — construite via t() pour reagir au changement
  // de langue. Les labels servent aussi de cle dans le mapping meta ci-dessous.
  const syncAdminTabs = [
    { label: t('tabHeaders.syncAdmin.tabs.connections', 'Connexions'), icon: TAB_ICONS[0] },
    { label: t('tabHeaders.syncAdmin.tabs.syncEvents', 'Sync Events'), icon: TAB_ICONS[1] },
    { label: t('tabHeaders.syncAdmin.tabs.outbox', 'Outbox'), icon: TAB_ICONS[2] },
    { label: t('tabHeaders.syncAdmin.tabs.calendar', 'Calendrier'), icon: TAB_ICONS[3] },
    { label: t('tabHeaders.syncAdmin.tabs.mappings', 'Mappings'), icon: TAB_ICONS[4] },
    { label: t('tabHeaders.syncAdmin.tabs.diagnostics', 'Diagnostics'), icon: TAB_ICONS[5] },
    { label: t('tabHeaders.syncAdmin.tabs.reconciliation', 'Reconciliation'), icon: TAB_ICONS[6] },
  ];
  // Mapping label → subtitle reconstruit a chaque render pour suivre la langue.
  const syncAdminTabMeta: Record<string, TabHeaderMeta> = {
    [t('tabHeaders.syncAdmin.tabs.connections', 'Connexions')]: {
      subtitle: t('tabHeaders.syncAdmin.subtitle.connections', 'Suivi en temps réel des connexions OTA (Airbnb, Booking, Channex) : statut, tokens, dernière sync.'),
    },
    [t('tabHeaders.syncAdmin.tabs.syncEvents', 'Sync Events')]: {
      subtitle: t('tabHeaders.syncAdmin.subtitle.syncEvents', 'Évènements de synchronisation des calendriers (push/pull) : volumétrie par canal et statut.'),
    },
    [t('tabHeaders.syncAdmin.tabs.outbox', 'Outbox')]: {
      subtitle: t('tabHeaders.syncAdmin.subtitle.outbox', 'Outbox pattern Kafka : events en attente, envoyés ou échoués, avec retry à la demande.'),
    },
    [t('tabHeaders.syncAdmin.tabs.calendar', 'Calendrier')]: {
      subtitle: t('tabHeaders.syncAdmin.subtitle.calendar', 'Audit des commandes calendrier (book, cancel, block, price) et détection des conflits multi-canal.'),
    },
    [t('tabHeaders.syncAdmin.tabs.mappings', 'Mappings')]: {
      subtitle: t('tabHeaders.syncAdmin.subtitle.mappings', 'Correspondances propriété ↔ listing externe par canal (Airbnb ID, Booking hotel ID, etc.).'),
    },
    [t('tabHeaders.syncAdmin.tabs.diagnostics', 'Diagnostics')]: {
      subtitle: t('tabHeaders.syncAdmin.subtitle.diagnostics', 'Diagnostics système : tâches planifiées, jobs en cours, erreurs récentes et état des intégrations.'),
    },
    [t('tabHeaders.syncAdmin.tabs.reconciliation', 'Reconciliation')]: {
      subtitle: t('tabHeaders.syncAdmin.subtitle.reconciliation', 'Runs de réconciliation calendrier : détection des divergences entre Clenzy et OTA, déclenchement manuel.'),
    },
  };

  // Resolution title/subtitle en fonction du tab actif.
  const { title, subtitle } = resolveTabHeader(
    t('tabHeaders.syncAdmin.title', 'Sync & Diagnostics'),
    t('tabHeaders.syncAdmin.default', 'Supervision de la synchronisation channel et diagnostic du systeme'),
    syncAdminTabs.map((tab) => tab.label),
    tabValue,
    syncAdminTabMeta,
  );

  return (
    <Box>
      <PageHeader
        title={title}
        subtitle={subtitle}
        iconBadge={<Sync />}
        backPath="/admin"
        showBackButton={false}
        filters={headerFilters}
        actions={headerActions}
      />

      <PageTabs
        options={syncAdminTabs}
        value={tabValue}
        onChange={setTabValue}
        ariaLabel="Sync admin tabs"
      />

      <Box sx={{ mt: 2 }}>
        <SyncAdminHeaderContext.Provider value={headerApi}>
          {tabValue === 0 && <ConnectionsTab />}
          {tabValue === 1 && <EventsTab />}
          {tabValue === 2 && <OutboxTab />}
          {tabValue === 3 && <CalendarAuditTab />}
          {tabValue === 4 && <MappingsTab />}
          {tabValue === 5 && <DiagnosticsTab />}
          {tabValue === 6 && <ReconciliationTab />}
        </SyncAdminHeaderContext.Provider>
      </Box>
    </Box>
  );
};

export default SyncAdminPage;
