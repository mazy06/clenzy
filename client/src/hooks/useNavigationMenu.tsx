import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './useAuth';
import { CLEANING_ROLES, FIELD_ROLES, TRADE_ROLES } from '../utils/fieldRoles';

/**
 * Seuls onglets de hub ouverts aux roles de terrain.
 *
 * <p>`/contact` en fait partie : le hub de messagerie ne porte pas que les
 * conversations voyageurs, il porte aussi les fils INTERNES — c'est par la
 * qu'un intervenant echange avec son gestionnaire. Le retirer coupait la seule
 * voie de discussion dont il dispose.</p>
 *
 * <p>`/directory` reste dehors : l'annuaire des utilisateurs, equipes et
 * portefeuilles de l'organisation est une surface de gestionnaire.</p>
 */
const FIELD_HUB_TABS = new Set(['/interventions', '/contact']);
import { useTranslation } from './useTranslation';
import {
  Dashboard,
  Home,
  Build,
  Settings,
  Assessment,
  Security,
  Euro,
  AccessTime,
  Description,
  AdminPanelSettings,
  Hub,
  CalendarViewWeek,
  Contacts,
  Bolt,
  Palette,
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
import { useDocumentsFailedCount } from '../modules/documents/useDocumentsFailedCount';

// ─── Types ───────────────────────────────────────────────────────────────────

export type NavGroup = 'main' | 'management' | 'admin';

/** i18n keys for nav group section headers */
export const NAV_GROUP_TRANSLATION_KEYS: Record<NavGroup, string> = {
  main: 'navigation.groups.main',
  management: 'navigation.groups.management',
  admin: 'navigation.groups.admin',
};

/**
 * Onglet d'un hub, exposé à la sidebar pour le sous-menu dépliable.
 * Déjà filtré par rôle et permission (`accessibleHubTabs`) : ce qui arrive ici
 * est navigable par l'utilisateur courant.
 */
export interface MenuSubItem {
  path: string;
  text: string;
  /** Préfixes de routes qui rendent CE sous-item actif. */
  matchPaths: string[];
}

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
   * Onglets accessibles du hub (vide pour une entrée simple). La sidebar en fait
   * un sous-menu dépliable ; `path` reste la cible directe (premier onglet).
   */
  children?: MenuSubItem[];
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
  // ── Ecrans de l'intervenant ──
  // Tarifs et disponibilites sont des gestes du QUOTIDIEN : ils meritent leur
  // entree, pas une carte au fond de « Mon compte ». Reserves aux executants —
  // un gestionnaire gere le catalogue de l'organisation, pas SES tarifs.
  {
    kind: 'item',
    item: {
      icon: <Euro />,
      path: '/mes-tarifs',
      roles: [...CLEANING_ROLES],
      translationKey: 'navigation.myRates',
      group: 'main',
    },
  },
  {
    kind: 'item',
    item: {
      icon: <AccessTime />,
      path: '/mes-disponibilites',
      roles: [...FIELD_ROLES],
      translationKey: 'navigation.myAvailability',
      group: 'main',
    },
  },
  {
    kind: 'item',
    item: {
      icon: <Build />,
      path: '/mes-tarifs-travaux',
      roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'SUPERVISOR', ...TRADE_ROLES],
      permission: 'technician-prestations:manage',
      translationKey: 'navigation.technicianPrestations',
      group: 'main',
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
  {
    kind: 'item',
    item: {
      icon: <Palette />,
      path: '/admin/design-system',
      roles: ['SUPER_ADMIN'],
      translationKey: 'navigation.designSystem',
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
  const { isAdmin, isManager, hasAnyRole, user } = useAuth();
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

      // Le champ `roles` de chaque entrée n'était évalué NULLE PART : seule la
      // permission gardait la porte, et les rôles déclarés servaient de
      // documentation. Un technicien à qui `settings:view` avait été accordée
      // voyait donc « Paramètres », pourtant annoncé SUPER_ADMIN / SUPER_MANAGER.
      // Les deux conditions se cumulent désormais ; `'all'` reste l'échappatoire
      // explicite des entrées ouvertes à tous.
      if (item.roles && item.roles.length > 0 && !item.roles.includes('all')) {
        if (!hasAnyRole(item.roles)) return false;
      }

      // Tarifs et disponibilites PERSONNELS : seuls les executants en ont.
      // `roles` n'est pas evalue ici — le filtrage passe par `permission`, que
      // ces ecrans n'ont pas (ce sont les donnees propres de l'utilisateur).
      // Forfaits par logement et score qualite sont propres au MENAGE : le
      // moteur qui les calcule ne connait que les types de nettoyage.
      if (item.path === '/mes-tarifs') {
        return hasAnyRole([...CLEANING_ROLES]);
      }
      if (item.path === '/mes-disponibilites') {
        return hasAnyRole([...FIELD_ROLES]);
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

      // Bibliothèque Baitly UI : outil interne de refonte, super admin uniquement.
      if (item.path === '/admin/design-system') {
        return isAdmin();
      }

      return true;
    } catch (err) {
      return false;
    }
  }, [user?.permissions, isAdmin, isManager, hasAnyRole]);

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
    let tabs = accessibleHubTabs(hub, access);

    // Un intervenant reste sur SES interventions. Ce compte technicien portait
    // `properties:view` — une permission accordee a la main, absente du role par
    // defaut — et voyait donc l'inventaire des logements, qui est l'ecran de
    // gestion du parc. Le detail d'un logement lui reste accessible depuis sa
    // mission, la ou il en a besoin.
    if (hasAnyRole([...FIELD_ROLES])) {
      tabs = tabs.filter((tab) => FIELD_HUB_TABS.has(tab.path));
    }

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
      // Les onglets accessibles étaient calculés puis jetés : la sidebar en a
      // besoin pour son sous-menu dépliable.
      children: tabs.map((tab) => ({
        path: tab.path,
        text: t(tab.translationKey, tab.fallbackLabel),
        matchPaths: tabRoutePrefixes(tab),
      })),
    };
  }, [user?.permissions, isAdmin, isManager, hasAnyRole, t]);

  // Fonction pour construire le menu (synchronisée)
  const buildMenuItems = useCallback((): MenuItem[] => {
    if (!user) return [];

    setLoading(true);
    setError(null);

    try {
      const accessibleItems: MenuItem[] = [];

      // Un intervenant de terrain n'a qu'un hub a voir : celui qui porte ses
      // interventions. `contact:view` et `teams:view` lui ouvraient la
      // messagerie voyageurs et l'annuaire de l'organisation — deux surfaces de
      // gestionnaire. Le filtrage se fait ICI plutot qu'en retirant les
      // permissions : elles gardent des usages cote API (nom de l'equipe sur une
      // intervention, par exemple) que la navigation n'a pas a arbitrer.
      const fieldOnlyHubs = new Set(['exploitation', 'contacts']);
      const isFieldWorker = hasAnyRole([...FIELD_ROLES]);

      for (const entry of MENU_ENTRIES) {
        if (entry.kind === 'hub') {
          if (isFieldWorker && !fieldOnlyHubs.has(entry.hubId)) continue;
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

  // Pastille « échecs récents » du hub Documents : envois voyageur + générations
  // de documents FAILED (7 j). Gaté sur la visibilité du hub → aucun fetch inutile.
  const documentsHubVisible = menuItems.some((item) => item.id === 'hub:documents');
  const documentsFailedCount = useDocumentsFailedCount(documentsHubVisible);

  // Mémoriser le résultat + superposer les pastilles dynamiques (« en attente »
  // sur Planning, « échecs récents » sur Documents), hors du flux de construction.
  const memoizedMenuItems = useMemo(() => {
    if (pendingTotal <= 0 && documentsFailedCount <= 0) return menuItems;
    return menuItems.map((item) => {
      if (item.path === '/planning' && pendingTotal > 0) {
        return { ...item, badge: pendingTotal, badgeColor: 'warning' as const };
      }
      if (item.id === 'hub:documents' && documentsFailedCount > 0) {
        return { ...item, badge: documentsFailedCount, badgeColor: 'error' as const };
      }
      return item;
    });
  }, [menuItems, pendingTotal, documentsFailedCount]);

  return {
    menuItems: memoizedMenuItems,
    loading,
    error,
    refreshMenu
  };
};
