import React, { useState } from 'react';
import { Box } from '@mui/material';
import {
  Security,
  TrendingUp,
  Assignment,
  HealthAndSafety,
} from '../../icons';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import TokenMonitoring from '../../components/TokenMonitoring';
import KeycloakMetrics from '../../components/KeycloakMetrics';
import AuditLogging from '../../components/AuditLogging';
import HealthChecks from '../../components/HealthChecks';

const MonitoringPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  return (
    <Box>
      <PageHeader
        title="Monitoring Système"
        subtitle="Surveillance complète de la plateforme Clenzy"
        iconBadge={<HealthAndSafety />}
        backPath="/admin"
        showBackButton={false}
      />

      <PageTabs
        options={[
          { label: 'Monitoring des Tokens',   icon: <Security /> },
          { label: 'Métriques Keycloak',      icon: <TrendingUp /> },
          { label: 'Audit et Logging',        icon: <Assignment /> },
          { label: 'Health Checks Avancés',   icon: <HealthAndSafety /> },
        ]}
        value={tabValue}
        onChange={setTabValue}
        ariaLabel="Monitoring tabs"
      />

      <Box sx={{ mt: 2 }}>
        {tabValue === 0 && <TokenMonitoring />}
        {tabValue === 1 && <KeycloakMetrics />}
        {tabValue === 2 && <AuditLogging />}
        {tabValue === 3 && <HealthChecks />}
      </Box>
    </Box>
  );
};

export default MonitoringPage;
