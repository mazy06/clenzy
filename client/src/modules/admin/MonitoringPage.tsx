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
import {
  resolveTabHeader,
  type TabHeaderMeta,
} from '../../components/PageHeaderActionsContext';
import TokenMonitoring from '../../components/TokenMonitoring';
import KeycloakMetrics from '../../components/KeycloakMetrics';
import AuditLogging from '../../components/AuditLogging';
import HealthChecks from '../../components/HealthChecks';

// Le contexte interne MonitoringHeader est conserve : il porte une semantique
// supplementaire (lastUpdate timestamp affiche dans le header) que la primitive
// generique PageHeaderActionsContext ne couvre pas. Les actions tab-specifiques
// passent toujours par setHeaderActions, et le lastUpdate par setHeaderLastUpdate.
interface MonitoringHeaderApi {
  setHeaderActions: (actions: React.ReactNode) => void;
  setHeaderLastUpdate: (date: Date | null) => void;
}

const MonitoringHeaderContext = createContext<MonitoringHeaderApi>({
  setHeaderActions: () => {},
  setHeaderLastUpdate: () => {},
});

export const useMonitoringHeader = (): MonitoringHeaderApi => useContext(MonitoringHeaderContext);

// ─── Tab definitions (source of truth) ──────────────────────────────────────

const MONITORING_TABS = [
  { label: 'Monitoring des Tokens', icon: <Security /> },
  { label: 'Métriques Keycloak',    icon: <TrendingUp /> },
  { label: 'Audit et Logging',      icon: <Assignment /> },
  { label: 'Health Checks Avancés', icon: <HealthAndSafety /> },
] as const;

// ─── Metadata par tab (breadcrumb + subtitle) ────────────────────────────────
// Clef = LABEL du tab (string stable face aux changements d'index).
const MONITORING_TAB_META: Record<string, TabHeaderMeta> = {
  'Monitoring des Tokens': {
    subtitle: "Surveillance des tokens IA consommés par feature : compteurs, coûts et rotation des clés.",
  },
  'Métriques Keycloak': {
    subtitle: "Métriques Keycloak (sessions, login, refresh) et couverture des tests d'intégration.",
  },
  'Audit et Logging': {
    subtitle: "Journal d'audit horodaté : connexions, accès aux données, actions admin et permissions refusées.",
  },
  'Health Checks Avancés': {
    subtitle: 'Health checks des services dépendants (DB, Redis, Kafka, OAuth) et métriques système temps réel.',
  },
};
const MONITORING_ROOT_TITLE = 'Monitoring Système';
const MONITORING_DEFAULT_SUBTITLE = 'Surveillance complète de la plateforme Clenzy';

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

  // Resolution title/subtitle en fonction du tab actif.
  const { title, subtitle } = resolveTabHeader(
    MONITORING_ROOT_TITLE,
    MONITORING_DEFAULT_SUBTITLE,
    MONITORING_TABS.map((tab) => tab.label),
    tabValue,
    MONITORING_TAB_META,
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
        title={title}
        subtitle={subtitle}
        iconBadge={<HealthAndSafety />}
        backPath="/admin"
        showBackButton={false}
        actions={headerActionsSlot}
      />

      <PageTabs
        options={MONITORING_TABS.map((tab) => ({ label: tab.label, icon: tab.icon }))}
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
