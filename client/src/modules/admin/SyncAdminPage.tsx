import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  Cable,
  Sync,
  Outbox,
  CalendarMonth,
  AccountTree,
  BugReport,
  CompareArrows,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import ConnectionsTab from './sync/ConnectionsTab';
import EventsTab from './sync/EventsTab';
import OutboxTab from './sync/OutboxTab';
import CalendarAuditTab from './sync/CalendarAuditTab';
import MappingsTab from './sync/MappingsTab';
import DiagnosticsTab from './sync/DiagnosticsTab';
import ReconciliationTab from './sync/ReconciliationTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`sync-admin-tabpanel-${index}`}
      aria-labelledby={`sync-admin-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `sync-admin-tab-${index}`,
    'aria-controls': `sync-admin-tabpanel-${index}`,
  };
}

const SyncAdminPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box>
      <PageHeader
        title="Sync & Diagnostics"
        subtitle="Supervision de la synchronisation channel et diagnostic du systeme"
        backPath="/admin"
        showBackButton={false}
      />

      <Paper sx={{ width: '100%', mt: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="Sync admin tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab
              label="Connexions"
              icon={<Cable />}
              iconPosition="start"
              {...a11yProps(0)}
            />
            <Tab
              label="Sync Events"
              icon={<Sync />}
              iconPosition="start"
              {...a11yProps(1)}
            />
            <Tab
              label="Outbox"
              icon={<Outbox />}
              iconPosition="start"
              {...a11yProps(2)}
            />
            <Tab
              label="Calendrier"
              icon={<CalendarMonth />}
              iconPosition="start"
              {...a11yProps(3)}
            />
            <Tab
              label="Mappings"
              icon={<AccountTree />}
              iconPosition="start"
              {...a11yProps(4)}
            />
            <Tab
              label="Diagnostics"
              icon={<BugReport />}
              iconPosition="start"
              {...a11yProps(5)}
            />
            <Tab
              label="Reconciliation"
              icon={<CompareArrows />}
              iconPosition="start"
              {...a11yProps(6)}
            />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <ConnectionsTab />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <EventsTab />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <OutboxTab />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <CalendarAuditTab />
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <MappingsTab />
        </TabPanel>

        <TabPanel value={tabValue} index={5}>
          <DiagnosticsTab />
        </TabPanel>

        <TabPanel value={tabValue} index={6}>
          <ReconciliationTab />
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default SyncAdminPage;
