import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import PageTabs from './PageTabs';
import {
  findHubForPath,
  accessibleHubTabs,
  tabMatchesPath,
  type HubAccess,
} from '../config/navigationHubs';

/**
 * Barre d'onglets de niveau 1 des hubs de navigation (cf. config/navigationHubs).
 *
 * Montée UNE FOIS dans MainLayoutFull, au-dessus du contenu de page : quand la
 * route courante appartient à un hub (Exploitation, Contacts, Finances…), elle
 * affiche les écrans frères en onglets PageTabs pilotés par la route — chaque
 * onglet navigue vers l'URL canonique historique de l'écran, les pages restent
 * inchangées (elles gardent leur PageHeader et leurs sous-onglets `?tab=`).
 *
 * Invisible hors hub, ou si un seul onglet est accessible pour le rôle.
 */
export default function HubTabsBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, isManager } = useAuth();
  const { t } = useTranslation();

  const access: HubAccess = useMemo(
    () => ({
      permissions: user?.permissions ?? [],
      isAdmin: isAdmin(),
      isManager: isManager(),
    }),
    [user?.permissions, isAdmin, isManager],
  );

  const hub = findHubForPath(location.pathname);
  const tabs = useMemo(
    () => (hub ? accessibleHubTabs(hub, access) : []),
    [hub, access],
  );

  if (!hub || tabs.length < 2) return null;

  const activeTab = tabs.find((tab) => tabMatchesPath(tab, location.pathname));

  return (
    <PageTabs<string>
      options={tabs.map((tab) => ({
        value: tab.path,
        key: tab.path,
        label: t(tab.translationKey, tab.fallbackLabel),
      }))}
      value={activeTab?.path ?? tabs[0].path}
      onChange={(path) => {
        if (path !== activeTab?.path) navigate(path);
      }}
      paper={false}
      mb={1.5}
      ariaLabel={t(hub.translationKey, hub.fallbackLabel)}
    />
  );
}
