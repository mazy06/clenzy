import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useTranslation } from './useTranslation';
import {
  Dashboard,
  Home,
  Build,
  Assignment,
  People,
  Settings,
  Business,
  Assessment,
  Security,
  Euro,
  Payment,
  Description,
  Mail,
  AdminPanelSettings,
  Sync,
  Speed,
  EventNote,
  TrendingUp,
  Hub,
  ChatBubbleOutline,
} from '@mui/icons-material';

// ─── Types ───────────────────────────────────────────────────────────────────

export type NavGroup = 'main' | 'management' | 'admin';

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  main: 'Principal',
  management: 'Gestion',
  admin: 'Administration',
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
}

interface UseNavigationMenuReturn {
  menuItems: MenuItem[];
  loading: boolean;
  error: string | null;
  refreshMenu: () => void;
}

// ─── Menu Configuration ──────────────────────────────────────────────────────

const MENU_CONFIG_BASE: Omit<MenuItem, 'id' | 'text'>[] = [
  // ── Main ──
  {
    icon: <Dashboard />,
    path: '/dashboard',
    roles: ['all'],
    permission: 'dashboard:view',
    translationKey: 'navigation.dashboard',
    group: 'main',
  },
  {
    icon: <Home />,
    path: '/properties',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'],
    permission: 'properties:view',
    translationKey: 'navigation.properties',
    group: 'main',
  },
  {
    icon: <Assignment />,
    path: '/service-requests',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST', 'SUPERVISOR'],
    permission: 'service-requests:view',
    translationKey: 'navigation.serviceRequests',
    group: 'main',
  },
  {
    icon: <Build />,
    path: '/interventions',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'TECHNICIAN', 'HOUSEKEEPER', 'SUPERVISOR', 'LAUNDRY', 'EXTERIOR_TECH'],
    permission: 'interventions:view',
    translationKey: 'navigation.interventions',
    group: 'main',
  },
  {
    icon: <EventNote />,
    path: '/reservations',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST', 'SUPERVISOR'],
    permission: 'reservations:view',
    translationKey: 'navigation.reservations',
    group: 'main',
  },
  {
    icon: <TrendingUp />,
    path: '/dynamic-pricing',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'],
    permission: 'pricing:view',
    translationKey: 'navigation.dynamicPricing',
    group: 'main',
  },
  // ── Management ──
  {
    icon: <People />,
    path: '/teams',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'SUPERVISOR'],
    permission: 'teams:view',
    translationKey: 'navigation.teams',
    group: 'management',
  },
  {
    icon: <Business />,
    path: '/portfolios',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER'],
    permission: 'portfolios:view',
    translationKey: 'navigation.portfolios',
    group: 'management',
  },
  {
    icon: <Mail />,
    path: '/contact',
    roles: ['all'],
    permission: 'contact:view',
    translationKey: 'navigation.contact',
    group: 'management',
  },
  {
    icon: <Description />,
    path: '/documents',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER'],
    permission: 'documents:view',
    translationKey: 'navigation.documents',
    group: 'management',
  },
  {
    icon: <Assessment />,
    path: '/reports',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER'],
    permission: 'reports:view',
    translationKey: 'navigation.reports',
    group: 'management',
  },
  {
    icon: <Euro />,
    path: '/tarification',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER'],
    permission: 'tarification:view',
    translationKey: 'navigation.tarification',
    group: 'management',
  },
  {
    icon: <Payment />,
    path: '/payments/history',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'],
    permission: 'payments:view',
    translationKey: 'navigation.payments',
    group: 'management',
  },
  {
    icon: <Hub />,
    path: '/channels',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'],
    permission: 'properties:view',
    translationKey: 'navigation.channels',
    group: 'management',
  },
  {
    icon: <ChatBubbleOutline />,
    path: '/messaging/templates',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'],
    permission: 'settings:view',
    translationKey: 'navigation.messaging',
    group: 'management',
  },
  // ── Admin ──
  {
    icon: <People />,
    path: '/users',
    roles: ['SUPER_ADMIN'],
    permission: 'users:manage',
    translationKey: 'navigation.usersAndOrganizations',
    group: 'admin',
  },
  {
    icon: <Settings />,
    path: '/settings',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER'],
    permission: 'settings:view',
    translationKey: 'navigation.settings',
    group: 'admin',
  },
  {
    icon: <AdminPanelSettings />,
    path: '/permissions-test',
    roles: ['SUPER_ADMIN'],
    translationKey: 'navigation.rolesPermissions',
    group: 'admin',
  },
  {
    icon: <Security />,
    path: '/admin/monitoring',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER'],
    translationKey: 'navigation.monitoring',
    group: 'admin',
  },
  {
    icon: <Sync />,
    path: '/admin/sync',
    roles: ['SUPER_ADMIN'],
    permission: 'users:manage',
    translationKey: 'navigation.syncDiagnostics',
    group: 'admin',
  },
  {
    icon: <Speed />,
    path: '/admin/kpi',
    roles: ['SUPER_ADMIN'],
    permission: 'users:manage',
    translationKey: 'navigation.kpiReadiness',
    group: 'admin',
  },
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
  const { hasPermissionAsync, isAdmin, isManager, user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fonction pour vérifier si un utilisateur a accès à un élément de menu (synchronisée)
  const hasMenuAccess = useCallback((item: Omit<MenuItem, 'id' | 'text'>): boolean => {
    try {
      // Vérifier la permission si spécifiée
      if (item.permission) {
        const hasPermission = user?.permissions?.includes(item.permission) || false;
        if (!hasPermission) return false;
      }

      // Vérifications spéciales pour certains éléments
      if (item.path === '/portfolios') {
        return (user?.permissions?.includes('portfolios:view') || false) || isAdmin() || isManager();
      }

      if (item.path === '/permissions-test') {
        return isAdmin(); // Seuls les utilisateurs ADMIN peuvent accéder
      }

      if (item.path === '/admin/monitoring') {
        return isAdmin() || isManager();
      }

      if (item.path === '/admin/sync') {
        return isAdmin();
      }

      if (item.path === '/admin/kpi') {
        return isAdmin();
      }

      return true;
    } catch (err) {
      return false;
    }
  }, [user?.permissions, isAdmin, isManager]);

  // Fonction pour construire le menu (synchronisée)
  const buildMenuItems = useCallback((): MenuItem[] => {
    if (!user) return [];

    setLoading(true);
    setError(null);

    try {
      const accessibleItems: MenuItem[] = [];

      for (const item of MENU_CONFIG_BASE) {
        const hasAccess = hasMenuAccess(item);
        if (hasAccess) {
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
  }, [user, hasMenuAccess, t]);

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
  }, [user?.id, user?.permissions, refreshMenu]);

  // Mémoriser le résultat pour éviter les re-renders inutiles
  const memoizedMenuItems = useMemo(() => menuItems, [menuItems]);

  return {
    menuItems: memoizedMenuItems,
    loading,
    error,
    refreshMenu
  };
};
