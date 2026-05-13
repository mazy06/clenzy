import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box } from '@mui/material';
import {
  People,
  Business,
  PersonSearch,
  ManageAccounts,
  CorporateFare,
  TrendingUp,
} from '../../icons';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
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

// ─── Component ──────────────────────────────────────────────────────────────

const DirectoryPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Build visible tabs based on user permissions
  const visibleTabs = useMemo(() => {
    if (!user?.permissions) return [];
    return ALL_TABS.filter((tab) => {
      if (!user.permissions!.includes(tab.permission)) return false;
      if (tab.roles && !tab.roles.some((r) => user.roles?.includes(r))) return false;
      return true;
    });
  }, [user?.permissions, user?.roles]);

  const maxTab = Math.max(0, visibleTabs.length - 1);
  const initialTab = parseInt(searchParams.get('tab') || '0', 10);
  const [activeTab, setActiveTab] = useState(
    isNaN(initialTab) ? 0 : Math.min(initialTab, maxTab)
  );

  // Portal container
  const [actionsContainer, setActionsContainer] = useState<HTMLDivElement | null>(null);

  // Sync tab to URL param
  const handleTabChange = useCallback((v: number) => {
    setActiveTab(v);
    setSearchParams(v === 0 ? {} : { tab: String(v) }, { replace: true });
  }, [setSearchParams]);

  // Handle URL param changes (browser back/forward)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const parsed = parseInt(tabParam, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= maxTab && parsed !== activeTab) {
        setActiveTab(parsed);
      }
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <Box>
      <PageHeader
        title={t('directoryPage.title')}
        subtitle={t('directoryPage.subtitle')}
        iconBadge={<PersonSearch />}
        backPath="/dashboard"
        showBackButton={false}
        actions={<div ref={setActionsContainer} style={PORTAL_STYLE} />}
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
  );
};

export default DirectoryPage;
