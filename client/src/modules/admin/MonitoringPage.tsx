import React, { useState, useMemo, useEffect, createContext, useContext } from 'react';
import {
  Security,
  TrendingUp,
  Assignment,
  HealthAndSafety,
} from '../../icons';
import { ShieldAlert } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import { useTabKeyParam } from '../../components/tabKeyParam';
import {
  resolveTabHeader,
  type TabHeaderMeta,
} from '../../components/PageHeaderActionsContext';
import { useTranslation } from '../../hooks/useTranslation';
import TokenMonitoring from '../../components/TokenMonitoring';
import KeycloakMetrics from '../../components/KeycloakMetrics';
import AuditLogging from '../../components/AuditLogging';
import HealthChecks from '../../components/HealthChecks';
import RlsAudit from '../../components/RlsAudit';

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
// Les labels et la metadata sont construits dans le composant via t() pour
// reagir au changement de langue.
const TAB_ICONS = [
  <Security />,
  <TrendingUp />,
  <Assignment />,
  <HealthAndSafety />,
  <ShieldAlert />,
] as const;

const MonitoringPage: React.FC = () => {
  const { t } = useTranslation();

  // Source de verite des tabs (avec `key` stable pour l'URL ?tab=<key>). Definie AVANT useTabKeyParam,
  // dont le resultat (tabValue) est consomme par le useEffect ci-dessous (TDZ).
  const monitoringTabs = [
    { key: 'tokens', label: t('tabHeaders.monitoring.tabs.tokens', 'Monitoring des Tokens'), icon: TAB_ICONS[0] },
    { key: 'keycloak', label: t('tabHeaders.monitoring.tabs.keycloak', 'Métriques Keycloak'), icon: TAB_ICONS[1] },
    { key: 'audit', label: t('tabHeaders.monitoring.tabs.audit', 'Audit et Logging'), icon: TAB_ICONS[2] },
    { key: 'health-checks', label: t('tabHeaders.monitoring.tabs.healthChecks', 'Health Checks Avancés'), icon: TAB_ICONS[3] },
    { key: 'rls-audit', label: t('tabHeaders.monitoring.tabs.rlsAudit', 'Isolation RLS'), icon: TAB_ICONS[4] },
  ];
  const [tabValue, setTabValue] = useTabKeyParam(monitoringTabs);
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

  // Mapping label → subtitle reconstruit a chaque render pour suivre la langue.
  const monitoringTabMeta: Record<string, TabHeaderMeta> = {
    [t('tabHeaders.monitoring.tabs.tokens', 'Monitoring des Tokens')]: {
      subtitle: t('tabHeaders.monitoring.subtitle.tokens', 'Surveillance des tokens IA consommés par feature : compteurs, coûts et rotation des clés.'),
    },
    [t('tabHeaders.monitoring.tabs.keycloak', 'Métriques Keycloak')]: {
      subtitle: t('tabHeaders.monitoring.subtitle.keycloak', "Métriques Keycloak (sessions, login, refresh) et couverture des tests d'intégration."),
    },
    [t('tabHeaders.monitoring.tabs.audit', 'Audit et Logging')]: {
      subtitle: t('tabHeaders.monitoring.subtitle.audit', "Journal d'audit horodaté : connexions, accès aux données, actions admin et permissions refusées."),
    },
    [t('tabHeaders.monitoring.tabs.healthChecks', 'Health Checks Avancés')]: {
      subtitle: t('tabHeaders.monitoring.subtitle.healthChecks', 'Health checks des services dépendants (DB, Redis, Kafka, OAuth) et métriques système temps réel.'),
    },
    [t('tabHeaders.monitoring.tabs.rlsAudit', 'Isolation RLS')]: {
      subtitle: t('tabHeaders.monitoring.subtitle.rlsAudit', "Chemins dont les requêtes s'exécutent sans contexte tenant. Une fois la Row-Level Security active, ils renverraient zéro ligne sans lever d'erreur."),
    },
  };

  // Resolution title/subtitle en fonction du tab actif.
  const { title, subtitle } = resolveTabHeader(
    t('tabHeaders.monitoring.title', 'Monitoring Système'),
    t('tabHeaders.monitoring.default', 'Surveillance complète de la plateforme Baitly'),
    monitoringTabs.map((tab) => tab.label),
    tabValue,
    monitoringTabMeta,
  );

  const headerActionsSlot = (
    <div className="flex items-center gap-1.5">
      {headerLastUpdate && (
        <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
          {t('tabHeaders.monitoring.lastUpdate', 'Dernière mise à jour')}: {headerLastUpdate.toLocaleTimeString()}
        </span>
      )}
      {headerActions}
    </div>
  );

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        iconBadge={<HealthAndSafety />}
        backPath="/admin"
        showBackButton={false}
        actions={headerActionsSlot}
      />

      <PageTabs
        options={monitoringTabs}
        value={tabValue}
        onChange={setTabValue}
        ariaLabel="Monitoring tabs"
      />

      <div className="mt-3">
        <MonitoringHeaderContext.Provider value={headerApi}>
          {tabValue === 0 && <TokenMonitoring />}
          {tabValue === 1 && <KeycloakMetrics />}
          {tabValue === 2 && <AuditLogging />}
          {tabValue === 3 && <HealthChecks />}
          {tabValue === 4 && <RlsAudit />}
        </MonitoringHeaderContext.Provider>
      </div>
    </div>
  );
};

export default MonitoringPage;
