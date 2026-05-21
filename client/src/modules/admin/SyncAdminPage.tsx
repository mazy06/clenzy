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
import ConnectionsTab from './sync/ConnectionsTab';
import EventsTab from './sync/EventsTab';
import OutboxTab from './sync/OutboxTab';
import CalendarAuditTab from './sync/CalendarAuditTab';
import MappingsTab from './sync/MappingsTab';
import DiagnosticsTab from './sync/DiagnosticsTab';
import ReconciliationTab from './sync/ReconciliationTab';

interface SyncAdminHeaderApi {
  setHeaderFilters: (filters: React.ReactNode) => void;
  setHeaderActions: (actions: React.ReactNode) => void;
}

const SyncAdminHeaderContext = createContext<SyncAdminHeaderApi>({
  setHeaderFilters: () => {},
  setHeaderActions: () => {},
});

export const useSyncAdminHeader = (): SyncAdminHeaderApi => useContext(SyncAdminHeaderContext);

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

  return (
    <Box>
      <PageHeader
        title="Sync & Diagnostics"
        subtitle="Supervision de la synchronisation channel et diagnostic du systeme"
        iconBadge={<Sync />}
        backPath="/admin"
        showBackButton={false}
        filters={headerFilters}
        actions={headerActions}
      />

      <PageTabs
        options={[
          { label: 'Connexions',     icon: <Cable /> },
          { label: 'Sync Events',    icon: <Sync /> },
          { label: 'Outbox',         icon: <Outbox /> },
          { label: 'Calendrier',     icon: <CalendarMonth /> },
          { label: 'Mappings',       icon: <AccountTree /> },
          { label: 'Diagnostics',    icon: <BugReport /> },
          { label: 'Reconciliation', icon: <CompareArrows /> },
        ]}
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
