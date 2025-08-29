import React, { useState } from 'react';
import {
  Box,
  Container,
  Tabs,
  Tab,
  Typography,
  Paper,
} from '@mui/material';
import {
  Security,
  TrendingUp,
  Assignment,
  HealthAndSafety,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import TokenMonitoring from '../../components/TokenMonitoring';
import KeycloakMetrics from '../../components/KeycloakMetrics';
import AuditLogging from '../../components/AuditLogging';
import HealthChecks from '../../components/HealthChecks';

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
      id={`monitoring-tabpanel-${index}`}
      aria-labelledby={`monitoring-tab-${index}`}
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
    id: `monitoring-tab-${index}`,
    'aria-controls': `monitoring-tabpanel-${index}`,
  };
}

const MonitoringPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="xl">
      <PageHeader
        title="Monitoring Système"
        subtitle="Surveillance complète de la plateforme Clenzy"
        backPath="/admin"
        showBackButton={false}
      />
      
      <Paper sx={{ width: '100%', mt: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            aria-label="Monitoring tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              label="Monitoring des Tokens" 
              icon={<Security />} 
              iconPosition="start"
              {...a11yProps(0)} 
            />
            <Tab 
              label="Métriques Keycloak" 
              icon={<TrendingUp />} 
              iconPosition="start"
              {...a11yProps(1)} 
            />
            <Tab 
              label="Audit et Logging" 
              icon={<Assignment />} 
              iconPosition="start"
              {...a11yProps(2)} 
            />
            <Tab 
              label="Health Checks Avancés" 
              icon={<HealthAndSafety />} 
              iconPosition="start"
              {...a11yProps(3)} 
            />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <TokenMonitoring isAdmin={true} />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <KeycloakMetrics />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <AuditLogging />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <HealthChecks />
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default MonitoringPage;
