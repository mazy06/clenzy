import React, { useState, useMemo } from 'react';
import { Box } from '@mui/material';
import {
  People,
  Business,
  PersonSearch,
  ManageAccounts,
  CorporateFare,
  TrendingUp,
} from '../../icons';
import { useTabKeyParam } from '../../components/tabKeyParam';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import {
  PageHeaderActionsProvider,
  usePageHeaderActionsSlot,
  resolveTabHeader,
  type TabHeaderMeta,
} from '../../components/PageHeaderActionsContext';
import TeamsList from '../teams/TeamsList';
import PortfoliosPage from '../portfolios/PortfoliosPage';
import GuestsListPage from '../guests/GuestsListPage';
import UsersList from '../users/UsersList';
import OrganizationsList from '../users/OrganizationsList';
import ProspectionPage from '../prospection/ProspectionPage';

// ─── Portal container for child actions in PageHeader ────────────────────────
const PORTAL_STYLE = { display: 'contents' } as const;

// ─── Tab config ──────────────────────────────────────────────────────────────

interface TabDef {
  key: string;
  labelKey: string;
  icon: React.ReactElement;
  permission: string;
  /** If set, user must also have one of these roles */
  roles?: string[];
}

const ALL_TABS: TabDef[] = [
  { key: 'users', labelKey: 'directoryPage.tabs.users', icon: <ManageAccounts />, permission: 'users:manage' },
  { key: 'teams', labelKey: 'directoryPage.tabs.teams', icon: <People />, permission: 'teams:view' },
  { key: 'portfolios', labelKey: 'directoryPage.tabs.portfolios', icon: <Business />, permission: 'portfolios:view' },
  { key: 'organizations', labelKey: 'directoryPage.tabs.organizations', icon: <CorporateFare />, permission: 'users:manage' },
  { key: 'guests', labelKey: 'directoryPage.tabs.guests', icon: <PersonSearch />, permission: 'guests:view' },
  { key: 'prospection', labelKey: 'directoryPage.tabs.prospection', icon: <TrendingUp />, permission: 'teams:view', roles: ['SUPER_ADMIN', 'SUPER_MANAGER'] },
];

// La metadata par tab (breadcrumb + subtitle) est construite dans le composant
// via t() pour reagir au changement de langue (cf. directoryTabMeta plus bas).

// ─── Component ──────────────────────────────────────────────────────────────

const DirectoryPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Build visible tabs based on user permissions
  const visibleTabs = useMemo(() => {
    if (!user?.permissions) return [];
    return ALL_TABS.filter((tab) => {
      if (!user.permissions!.includes(tab.permission)) return false;
      if (tab.roles && !tab.roles.some((r) => user.roles?.includes(r))) return false;
      return true;
    });
  }, [user?.permissions, user?.roles]);

  // useTabKeyParam derive l'onglet actif de l'URL (?tab=<key>) via la `key` stable de chaque
  // TabDef — robuste aux onglets filtres par permission (l'index visible shifte, jamais la cle).
  const [activeTab, setActiveTab] = useTabKeyParam(visibleTabs);
  const handleTabChange = setActiveTab;

  // Portal container
  const [actionsContainer, setActionsContainer] = useState<HTMLDivElement | null>(null);

  // Slot DOM pour que chaque tab puisse portaler ses actions dans le PageHeader.
  // /!\ DOIT etre declare AVANT tout early return pour respecter Rules of Hooks.
  const { slot: headerActionsSlot, portalContainer: headerActionsPortal } = usePageHeaderActionsSlot();

  // ── Single-tab: render component directly without tabs ──
  if (visibleTabs.length === 1) {
    const onlyTab = visibleTabs[0];
    if (onlyTab.key === 'teams') return <TeamsList />;
    if (onlyTab.key === 'portfolios') return <PortfoliosPage />;
    if (onlyTab.key === 'guests') return <GuestsListPage />;
    if (onlyTab.key === 'users') return <UsersList />;
    if (onlyTab.key === 'organizations') return <OrganizationsList />;
    if (onlyTab.key === 'prospection') return <ProspectionPage />;
  }

  // ── No tabs visible ──
  if (visibleTabs.length === 0) return null;

  // ── Multiple tabs visible ──
  const activeTabDef = visibleTabs[activeTab];
  const visibleTabLabels = visibleTabs.map((tab) => t(tab.labelKey));
  // Mapping label → subtitle reconstruit a chaque render pour suivre la langue.
  const directoryTabMeta: Record<string, TabHeaderMeta> = {
    [t('directoryPage.tabs.users')]: {
      subtitle: t('tabHeaders.directory.subtitle.users', "Comptes utilisateurs de la plateforme : roles, permissions, activation et reinitialisation d'acces."),
    },
    [t('directoryPage.tabs.teams')]: {
      subtitle: t('tabHeaders.directory.subtitle.teams', 'Equipes operationnelles (menage, maintenance, supervision) : composition, specialites et disponibilites.'),
    },
    [t('directoryPage.tabs.portfolios')]: {
      subtitle: t('tabHeaders.directory.subtitle.portfolios', 'Regroupements de biens par proprietaire ou portefeuille de gestion pour faciliter le pilotage.'),
    },
    [t('directoryPage.tabs.organizations')]: {
      subtitle: t('tabHeaders.directory.subtitle.organizations', 'Organisations clientes (multi-tenant) : informations legales, branding et configuration.'),
    },
    [t('directoryPage.tabs.guests')]: {
      subtitle: t('tabHeaders.directory.subtitle.guests', 'Base centralisee des voyageurs ayant sejourne ou contacte vos biens : historique et preferences.'),
    },
    [t('directoryPage.tabs.prospection')]: {
      subtitle: t('tabHeaders.directory.subtitle.prospection', 'Pipeline commercial : imports CSV, enrichissement et suivi des prospects qualifies.'),
    },
  };
  const { title, subtitle } = resolveTabHeader(
    t('tabHeaders.directory.title', 'Annuaire'),
    t('tabHeaders.directory.default', 'Gestion des équipes, portefeuilles, voyageurs, utilisateurs et organisations'),
    visibleTabLabels,
    activeTab,
    directoryTabMeta,
  );

  return (
    <PageHeaderActionsProvider slot={headerActionsSlot}>
      <Box>
        <PageHeader
          title={title}
          subtitle={subtitle}
          iconBadge={<PersonSearch />}
          backPath="/dashboard"
          showBackButton={false}
          actions={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {headerActionsPortal}
              <div ref={setActionsContainer} style={PORTAL_STYLE} />
            </Box>
          }
        />
        <PageTabs
          options={visibleTabs.map((tab) => ({
            label: t(tab.labelKey),
            icon: tab.icon,
          }))}
          value={activeTab}
          onChange={handleTabChange}
        />

        {/* ── Tab content ── */}
        {activeTabDef?.key === 'teams' && (
          <TeamsList embedded actionsContainer={actionsContainer} />
        )}
        {activeTabDef?.key === 'portfolios' && (
          <PortfoliosPage embedded actionsContainer={actionsContainer} />
        )}
        {activeTabDef?.key === 'guests' && (
          <GuestsListPage embedded actionsContainer={actionsContainer} />
        )}
        {activeTabDef?.key === 'users' && (
          <UsersList embedded actionsContainer={actionsContainer} />
        )}
        {activeTabDef?.key === 'organizations' && (
          <OrganizationsList embedded actionsContainer={actionsContainer} />
        )}
        {activeTabDef?.key === 'prospection' && (
          <ProspectionPage embedded actionsContainer={actionsContainer} />
        )}
      </Box>
    </PageHeaderActionsProvider>
  );
};

export default DirectoryPage;
