import React, { useState, useMemo, useEffect, createContext, useContext } from 'react';
import { Box, Typography } from '@mui/material';
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

interface MonitoringHeaderApi {
  setHeaderActions: (actions: React.ReactNode) => void;
  setHeaderLastUpdate: (date: Date | null) => void;
}

const MonitoringHeaderContext = createContext<MonitoringHeaderApi>({
  setHeaderActions: () => {},
  setHeaderLastUpdate: () => {},
});

export const useMonitoringHeader = (): MonitoringHeaderApi => useContext(MonitoringHeaderContext);

const MonitoringPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);
  const [headerLastUpdate, setHeaderLastUpdate] = useState<Date | null>(null);

  // Reset slot state when switching tabs so a previous tab's content never leaks.
  useEffect(() => {
    setHeaderActions(null);
    setHeaderLastUpdate(null);
  }, [tabValue]);

  const headerApi = useMemo<MonitoringHeaderApi>(
    () => ({ setHeaderActions, setHeaderLastUpdate }),
    [],
  );

  const headerActionsSlot = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {headerLastUpdate && (
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          Dernière mise à jour: {headerLastUpdate.toLocaleTimeString()}
        </Typography>
      )}
      {headerActions}
    </Box>
  );

  return (
    <Box>
      <PageHeader
        title="Monitoring Système"
        subtitle="Surveillance complète de la plateforme Clenzy"
        iconBadge={<HealthAndSafety />}
        backPath="/admin"
        showBackButton={false}
        actions={headerActionsSlot}
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
        <MonitoringHeaderContext.Provider value={headerApi}>
          {tabValue === 0 && <TokenMonitoring />}
          {tabValue === 1 && <KeycloakMetrics />}
          {tabValue === 2 && <AuditLogging />}
          {tabValue === 3 && <HealthChecks />}
        </MonitoringHeaderContext.Provider>
      </Box>
    </Box>
  );
};

export default MonitoringPage;
