import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useTranslation } from './useTranslation';
import {
  Dashboard,
  Home,
  Build,
  Settings,
  Assessment,
  Security,
  Euro,
  Description,
  AdminPanelSettings,
  Hub,
  CalendarViewWeek,
  Contacts,
  Bolt,
} from '../icons';
import {
  NAVIGATION_HUBS,
  accessibleHubTabs,
  tabRoutePrefixes,
  type HubAccess,
  type HubDef,
} from '../config/navigationHubs';
// Imports PROFONDS (pas le barrel '../modules/supervision') : ce hook est monté
// globalement via la sidebar — passer par le barrel tirerait tout le module
// supervision (constellation + framer-motion) dans le chunk chargé partout.
import { useCanSuperviseAgents } from '../modules/supervision/useCanSuperviseAgents';
import { useSupervisionConfig } from '../modules/supervision/useSupervisionConfig';
import { useSupervisionPendingCounts } from '../modules/supervision/useSupervisionPendingCounts';

// ─── Types ───────────────────────────────────────────────────────────────────

export type NavGroup = 'main' | 'management' | 'admin';

/** i18n keys for nav group section headers */
export const NAV_GROUP_TRANSLATION_KEYS: Record<NavGroup, string> = {
  main: 'navigation.groups.main',
  management: 'navigation.groups.management',
  admin: 'navigation.groups.admin',
};

export interface MenuItem {
  id: string;
  text: string;
  icon: React.ReactNode;
  path: string;
  roles: string[];
  permission?: string;
  translationKey?: string;
  group: NavGroup;
  /**
   * Préfixes de routes additionnels qui rendent l'item actif (hubs : routes de
   * tous les onglets accessibles + leurs sous-routes détail).
   */
  matchPaths?: string[];
  /** Badge counter affiche sur l'icone (notifications, demandes en attente, etc.) */
  badge?: number;
  /** Couleur du badge — defaut: warning (orange) pour les leads/demandes. */
  badgeColor?: 'error' | 'warning' | 'primary' | 'info' | 'success';
}

interface UseNavigationMenuReturn {
  menuItems: MenuItem[];
  loading: boolean;
  error: string | null;
  refreshMenu: () => void;
}

// ─── Menu Configuration ──────────────────────────────────────────────────────
//
// Regroupement validé 2026-06-12 (16 entrées → 9) : les écrans regroupés
// vivent dans des HUBS (config/navigationHubs) — 1 entrée sidebar par hub,
// les écrans frères deviennent un switcher segmenté de niveau 1 rendu dans le
// PageHeader (HubScreenSwitcher, Direction A). Les URLs historiques restent
// canoniques.

type MenuEntryConfig =
  | { kind: 'item'; item: Omit<MenuItem, 'id' | 'text'> }
  | { kind: 'hub'; hubId: string; icon: React.ReactNode };

const MENU_ENTRIES: MenuEntryConfig[] = [
  // ── Main ──
  {
    kind: 'item',
    item: {
      icon: <CalendarViewWeek />,
      path: '/planning',
      roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST', 'SUPERVISOR'],
      permission: 'reservations:view',
      translationKey: 'navigation.planning',
      group: 'main',
    },
  },
  {
    kind: 'item',
    item: {
      icon: <Dashboard />,
      path: '/dashboard',
      roles: ['all'],
      permission: 'dashboard:view',
      translationKey: 'navigation.dashboard',
      group: 'main',
    },
  },
  // Assistant : plus d'entree de menu — accessible via le widget bulle (logo
  // flottant) present sur toutes les pages, qui s'agrandit en plein ecran avec
  // l'historique. L'ancienne page dediee /assistant a ete supprimee.
  // Exploitation = Propriétés · Réservations · Interventions
  { kind: 'hub', hubId: 'exploitation', icon: <Home /> },
  // ── Management ──
  // Contacts = Messagerie · Annuaire
  { kind: 'hub', hubId: 'contacts', icon: <Contacts /> },
  // Documents = Documents · Contrats de gestion
  { kind: 'hub', hubId: 'documents', icon: <Description /> },
  // Finances = Facturation · Tarification
  { kind: 'hub', hubId: 'finances', icon: <Euro /> },
  // Distribution = Channels · Réservation & accueil · Boutique
  { kind: 'hub', hubId: 'distribution', icon: <Hub /> },
  {
    kind: 'item',
    item: {
      icon: <Assessment />,
      path: '/reports',
      roles: ['SUPER_ADMIN', 'SUPER_MANAGER'],
      permission: 'reports:view',
      translationKey: 'navigation.reports',
      group: 'management',
    },
  },
  // ── Admin ──
  {
    kind: 'item',
    item: {
      icon: <Settings />,
      path: '/settings',
      roles: ['SUPER_ADMIN', 'SUPER_MANAGER'],
      permission: 'settings:view',
      translationKey: 'navigation.settings',
      group: 'admin',
    },
  },
  {
    kind: 'item',
    item: {
      icon: <Bolt />,
      path: '/automation-rules',
      roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'],
      permission: 'automation:view',
      translationKey: 'navigation.automationRules',
      group: 'admin',
    },
  },
  {
    kind: 'item',
    item: {
      icon: <Build />,
      path: '/mes-tarifs-travaux',
      roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'TECHNICIAN', 'EXTERIOR_TECH'],
      permission: 'technician-prestations:manage',
      translationKey: 'navigation.technicianPrestations',
      group: 'management',
    },
  },
  {
    kind: 'item',
    item: {
      icon: <AdminPanelSettings />,
      path: '/permissions-test',
      roles: ['SUPER_ADMIN'],
      translationKey: 'navigation.rolesPermissions',
      group: 'admin',
    },
  },
  {
    kind: 'item',
    item: {
      icon: <Security />,
      path: '/admin/monitoring',
      roles: ['SUPER_ADMIN', 'SUPER_MANAGER'],
      translationKey: 'navigation.monitoring',
      group: 'admin',
    },
  },
  // Outils plateforme = Sync · KPI · Taux de change · Base de données · Codes promo
  { kind: 'hub', hubId: 'platform-tools', icon: <Build /> },
];

// ─── Helper ──────────────────────────────────────────────────────────────────

export function groupMenuItems(items: MenuItem[]): Record<NavGroup, MenuItem[]> {
  return {
    main: items.filter((i) => i.group === 'main'),
    management: items.filter((i) => i.group === 'management'),
    admin: items.filter((i) => i.group === 'admin'),
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useNavigationMenu = (): UseNavigationMenuReturn => {
  const { isAdmin, isManager, user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pastille « en attente » du menu Planning : nb de cartes HITL de la
  // constellation. Gaté (rôle habilité + feature activée) → aucun fetch inutile.
  const { canView: canSupervise } = useCanSuperviseAgents();
  const { data: supervisionConfig } = useSupervisionConfig({ enabled: canSupervise });
  const supervisionEnabled = canSupervise && (supervisionConfig?.enabled ?? false);
  const { total: pendingTotal } = useSupervisionPendingCounts(supervisionEnabled);

  // Fonction pour vérifier si un utilisateur a accès à un élément de menu (synchronisée)
  const hasMenuAccess = useCallback((item: Omit<MenuItem, 'id' | 'text'>): boolean => {
    try {
      // Vérifier la permission si spécifiée
      if (item.permission) {
        const hasPermission = user?.permissions?.includes(item.permission) || false;
        if (!hasPermission) return false;
      }

      // Surcouche perso « Mes tarifs travaux » : réservée aux exécutants. Les
      // admins/managers gèrent le catalogue org (Tarification › Maintenance) →
      // on évite le doublon d'écrans pour eux.
      if (item.path === '/mes-tarifs-travaux') {
        return !isAdmin() && !isManager();
      }

      if (item.path === '/permissions-test') {
        return isAdmin(); // Seuls les utilisateurs ADMIN peuvent accéder
      }

      if (item.path === '/admin/monitoring') {
        return isAdmin() || isManager();
      }

      return true;
    } catch (err) {
      return false;
    }
  }, [user?.permissions, isAdmin, isManager]);

  /**
   * Construit l'item sidebar d'un hub : visible si au moins un onglet est
   * accessible ; pointe vers le premier onglet accessible ; actif sur toutes
   * les routes couvertes par les onglets accessibles (matchPaths).
   */
  const buildHubItem = useCallback((hub: HubDef, icon: React.ReactNode): MenuItem | null => {
    const access: HubAccess = {
      permissions: user?.permissions ?? [],
      isAdmin: isAdmin(),
      isManager: isManager(),
    };
    const tabs = accessibleHubTabs(hub, access);
    if (tabs.length === 0) return null;

    return {
      id: `hub:${hub.id}`,
      text: t(hub.translationKey, hub.fallbackLabel),
      icon,
      path: tabs[0].path,
      roles: ['all'],
      translationKey: hub.translationKey,
      group: hub.group,
      matchPaths: tabs.flatMap((tab) => tabRoutePrefixes(tab)),
    };
  }, [user?.permissions, isAdmin, isManager, t]);

  // Fonction pour construire le menu (synchronisée)
  const buildMenuItems = useCallback((): MenuItem[] => {
    if (!user) return [];

    setLoading(true);
    setError(null);

    try {
      const accessibleItems: MenuItem[] = [];

      for (const entry of MENU_ENTRIES) {
        if (entry.kind === 'hub') {
          const hub = NAVIGATION_HUBS.find((h) => h.id === entry.hubId);
          if (!hub) continue;
          const hubItem = buildHubItem(hub, entry.icon);
          if (hubItem) accessibleItems.push(hubItem);
          continue;
        }

        const item = entry.item;
        if (hasMenuAccess(item)) {
          accessibleItems.push({
            id: item.path,
            text: item.translationKey ? t(item.translationKey) : item.path,
            icon: item.icon,
            path: item.path,
            roles: item.roles,
            permission: item.permission,
            translationKey: item.translationKey,
            group: item.group,
          });
        }
      }

      return accessibleItems;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la construction du menu';
      setError(errorMessage);

      // Retourner un menu de base en cas d'erreur
      return [{
        id: '/dashboard',
        text: t('navigation.dashboard'),
        icon: <Dashboard />,
        path: '/dashboard',
        roles: ['all'],
        translationKey: 'navigation.dashboard',
        group: 'main',
      }];
    } finally {
      setLoading(false);
    }
  }, [user, hasMenuAccess, buildHubItem, t]);

  // État mémorisé du menu
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  // Fonction pour rafraîchir le menu
  const refreshMenu = useCallback(() => {
    const newMenuItems = buildMenuItems();
    setMenuItems(newMenuItems);
  }, [buildMenuItems]);

  // Construire le menu au montage et quand les dépendances changent
  useEffect(() => {
    if (user) {
      refreshMenu();
    }
    // `user` est un useState (identite stable) : dependre de l'objet entier.
  }, [user, refreshMenu]);

  // Mémoriser le résultat + superposer la pastille « en attente » sur Planning
  // (badge dynamique, hors du flux de construction du menu).
  const memoizedMenuItems = useMemo(() => {
    if (pendingTotal <= 0) return menuItems;
    return menuItems.map((item) =>
      item.path === '/planning'
        ? { ...item, badge: pendingTotal, badgeColor: 'warning' as const }
        : item,
    );
  }, [menuItems, pendingTotal]);

  return {
    menuItems: memoizedMenuItems,
    loading,
    error,
    refreshMenu
  };
};
