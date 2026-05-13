import React, { useState } from 'react';
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

const SyncAdminPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  return (
    <Box>
      <PageHeader
        title="Sync & Diagnostics"
        subtitle="Supervision de la synchronisation channel et diagnostic du systeme"
        iconBadge={<Sync />}
        backPath="/admin"
        showBackButton={false}
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
        {tabValue === 0 && <ConnectionsTab />}
        {tabValue === 1 && <EventsTab />}
        {tabValue === 2 && <OutboxTab />}
        {tabValue === 3 && <CalendarAuditTab />}
        {tabValue === 4 && <MappingsTab />}
        {tabValue === 5 && <DiagnosticsTab />}
        {tabValue === 6 && <ReconciliationTab />}
      </Box>
    </Box>
  );
};

export default SyncAdminPage;
