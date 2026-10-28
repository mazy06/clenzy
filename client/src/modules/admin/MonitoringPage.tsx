import React, { useState, useMemo, createContext, useContext } from 'react';
import { HealthAndSafety } from '../../icons';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import { useTabKeyParam } from '../../components/tabKeyParam';
import {
  resolveTabHeader,
  type TabHeaderMeta,
} from '../../components/PageHeaderActionsContext';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useScreenTabs } from '../../hooks/useScreenTabs';
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

// Les onglets vivent dans `config/screenTabs.tsx` — la barre latérale en déplie
// le tiroir sans avoir monté cet écran, et une liste tenue en double aurait
// dérivé au premier onglet ajouté d'un seul côté.

const MonitoringPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Onglets lus au registre — defini AVANT useTabKeyParam, dont le resultat
  // (tabValue) pilote le contenu et les métadonnées du header.
  const monitoringTabs = useScreenTabs('/admin/monitoring');
  const [tabValue, setTabValue] = useTabKeyParam(monitoringTabs);
  // Mapping label → subtitle reconstruit a chaque render pour suivre la langue.
  const monitoringTabMeta: Record<string, TabHeaderMeta> = {
    [t('tabHeaders.monitoring.tabs.tokens', 'Sessions JWT')]: {
      subtitle: t('tabHeaders.monitoring.subtitle.tokens', 'Session courante, expiration des tokens JWT et compteurs de renouvellement.'),
    },
    [t('tabHeaders.monitoring.tabs.keycloak', 'Authentification')]: {
      subtitle: t('tabHeaders.monitoring.subtitle.keycloak', "Authentification (sessions, login, refresh) et couverture des tests d'intégration."),
    },
    [t('tabHeaders.monitoring.tabs.audit', 'Journal d’audit')]: {
      subtitle: t('tabHeaders.monitoring.subtitle.audit', "Journal d'audit horodaté : connexions, accès aux données, actions admin et permissions refusées."),
    },
    [t('tabHeaders.monitoring.tabs.healthChecks', 'Santé des services')]: {
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

  return (
    <MonitoringWorkspace key={String(tabValue) + ':' + user?.id + ':' + user?.organizationId}>{(headerActionsSlot) => <div className="min-w-0">
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
        ariaLabel={t('monitoringDesign.navigation')}
      />

      <div className="mt-5 pb-5">
          {tabValue === 0 && <TokenMonitoring />}
          {tabValue === 1 && <KeycloakMetrics />}
          {tabValue === 2 && <AuditLogging />}
          {tabValue === 3 && <HealthChecks />}
          {tabValue === 4 && <RlsAudit />}
      </div>
    </div>}</MonitoringWorkspace>
  );
};

/** Keyed by tab: actions and timestamps cannot leak from the previous screen. */
function MonitoringWorkspace({ children }: { children: (actions: React.ReactNode) => React.ReactNode }) {
  const { t } = useTranslation();
  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);
  const [headerLastUpdate, setHeaderLastUpdate] = useState<Date | null>(null);
  const headerApi = useMemo<MonitoringHeaderApi>(() => ({ setHeaderActions, setHeaderLastUpdate }), []);
  return <MonitoringHeaderContext.Provider value={headerApi}>
    {children(<div className="flex flex-wrap items-center justify-end gap-3">
      {headerLastUpdate && <time dateTime={headerLastUpdate.toISOString()}
        className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
        {t("tabHeaders.monitoring.lastUpdate")}{" : "}{headerLastUpdate.toLocaleTimeString()}
      </time>}
      {headerActions}
    </div>)}
  </MonitoringHeaderContext.Provider>;
}

export default MonitoringPage;
