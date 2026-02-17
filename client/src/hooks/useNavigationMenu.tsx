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
  Notifications,
  Business,
  Assessment,
  Security,
  Euro,
  Payment,
  Description,
} from '@mui/icons-material';

export interface MenuItem {
  id: string;
  text: string;
  icon: React.ReactNode;
  path: string;
  roles: string[];
  permission?: string;
  translationKey?: string;
}

interface UseNavigationMenuReturn {
  menuItems: MenuItem[];
  loading: boolean;
  error: string | null;
  refreshMenu: () => void;
}

// Configuration centralisée du menu (les textes seront traduits dynamiquement)
const MENU_CONFIG_BASE: Omit<MenuItem, 'id' | 'text'>[] = [
  {
    icon: <Dashboard />,
    path: '/dashboard',
    roles: ['all'],
    permission: 'dashboard:view',
    translationKey: 'navigation.dashboard'
  },
  {
    icon: <Home />,
    path: '/properties',
    roles: ['ADMIN', 'MANAGER', 'HOST'],
    permission: 'properties:view',
    translationKey: 'navigation.properties'
  },
  {
    icon: <Assignment />,
    path: '/service-requests',
    roles: ['ADMIN', 'MANAGER', 'HOST', 'SUPERVISOR'],
    permission: 'service-requests:view',
    translationKey: 'navigation.serviceRequests'
  },
  {
    icon: <Build />,
    path: '/interventions',
    roles: ['ADMIN', 'MANAGER', 'TECHNICIAN', 'HOUSEKEEPER', 'SUPERVISOR'],
    permission: 'interventions:view',
    translationKey: 'navigation.interventions'
  },
  {
    icon: <People />,
    path: '/teams',
    roles: ['ADMIN', 'MANAGER', 'SUPERVISOR'],
    permission: 'teams:view',
    translationKey: 'navigation.teams'
  },
  {
    icon: <Business />,
    path: '/portfolios',
    roles: ['ADMIN', 'MANAGER'],
    permission: 'portfolios:view',
    translationKey: 'navigation.portfolios'
  },
  {
    icon: <Notifications />,
    path: '/contact',
    roles: ['all'],
    permission: 'contact:view',
    translationKey: 'navigation.contact'
  },
  {
    icon: <Description />,
    path: '/documents',
    roles: ['ADMIN', 'MANAGER'],
    permission: 'documents:view',
    translationKey: 'navigation.documents'
  },
  {
    icon: <Assessment />,
    path: '/reports',
    roles: ['ADMIN', 'MANAGER'],
    permission: 'reports:view',
    translationKey: 'navigation.reports'
  },
  {
    icon: <People />,
    path: '/users',
    roles: ['ADMIN'],
    permission: 'users:manage',
    translationKey: 'navigation.users'
  },
  {
    icon: <Euro />,
    path: '/tarification',
    roles: ['ADMIN', 'MANAGER'],
    permission: 'tarification:view',
    translationKey: 'navigation.tarification'
  },
  {
    icon: <Payment />,
    path: '/payments/history',
    roles: ['ADMIN', 'MANAGER', 'HOST'],
    permission: 'payments:view',
    translationKey: 'navigation.payments'
  },
  {
    icon: <Settings />,
    path: '/settings',
    roles: ['ADMIN', 'MANAGER'],
    permission: 'settings:view',
    translationKey: 'navigation.settings'
  },
  {
    icon: <Build />,
    path: '/permissions-test',
    roles: ['ADMIN'],
    translationKey: 'navigation.rolesPermissions'
  },
  {
    icon: <Security />,
    path: '/admin/monitoring',
    roles: ['ADMIN', 'MANAGER'],
    translationKey: 'navigation.monitoring'
  }
];

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
            translationKey: item.translationKey
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
        translationKey: 'navigation.dashboard'
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
  }, [user?.id, user?.permissions, refreshMenu]); // Dépendre de l'ID, des permissions et de la fonction de rafraîchissement

  // Mémoriser le résultat pour éviter les re-renders inutiles
  const memoizedMenuItems = useMemo(() => menuItems, [menuItems]);

  return {
    menuItems: memoizedMenuItems,
    loading,
    error,
    refreshMenu
  };
};
