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

const SYNC_ADMIN_TABS = [
  { label: 'Connexions',     icon: <Cable /> },
  { label: 'Sync Events',    icon: <Sync /> },
  { label: 'Outbox',         icon: <Outbox /> },
  { label: 'Calendrier',     icon: <CalendarMonth /> },
  { label: 'Mappings',       icon: <AccountTree /> },
  { label: 'Diagnostics',    icon: <BugReport /> },
  { label: 'Reconciliation', icon: <CompareArrows /> },
] as const;

// ─── Metadata par tab (breadcrumb + subtitle) ────────────────────────────────
// Clef = LABEL du tab (string stable face aux changements d'index).
const SYNC_ADMIN_TAB_META: Record<string, TabHeaderMeta> = {
  'Connexions': {
    subtitle: 'Suivi en temps réel des connexions OTA (Airbnb, Booking, Channex) : statut, tokens, dernière sync.',
  },
  'Sync Events': {
    subtitle: 'Évènements de synchronisation des calendriers (push/pull) : volumétrie par canal et statut.',
  },
  'Outbox': {
    subtitle: "Outbox pattern Kafka : events en attente, envoyés ou échoués, avec retry à la demande.",
  },
  'Calendrier': {
    subtitle: 'Audit des commandes calendrier (book, cancel, block, price) et détection des conflits multi-canal.',
  },
  'Mappings': {
    subtitle: 'Correspondances propriété ↔ listing externe par canal (Airbnb ID, Booking hotel ID, etc.).',
  },
  'Diagnostics': {
    subtitle: "Diagnostics système : tâches planifiées, jobs en cours, erreurs récentes et état des intégrations.",
  },
  'Reconciliation': {
    subtitle: 'Runs de réconciliation calendrier : détection des divergences entre Clenzy et OTA, déclenchement manuel.',
  },
};
const SYNC_ADMIN_ROOT_TITLE = 'Sync & Diagnostics';
const SYNC_ADMIN_DEFAULT_SUBTITLE = 'Supervision de la synchronisation channel et diagnostic du systeme';

const SyncAdminPage: React.FC = () => {
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

  // Resolution title/subtitle en fonction du tab actif.
  const { title, subtitle } = resolveTabHeader(
    SYNC_ADMIN_ROOT_TITLE,
    SYNC_ADMIN_DEFAULT_SUBTITLE,
    SYNC_ADMIN_TABS.map((tab) => tab.label),
    tabValue,
    SYNC_ADMIN_TAB_META,
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
        options={SYNC_ADMIN_TABS.map((tab) => ({ label: tab.label, icon: tab.icon }))}
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
