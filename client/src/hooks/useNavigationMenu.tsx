import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './useAuth';
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
} from '@mui/icons-material';

export interface MenuItem {
  id: string;
  text: string;
  icon: React.ReactNode;
  path: string;
  roles: string[];
  permission?: string;
}

interface UseNavigationMenuReturn {
  menuItems: MenuItem[];
  loading: boolean;
  error: string | null;
  refreshMenu: () => void;
}

// Configuration centralisée du menu
const MENU_CONFIG: Omit<MenuItem, 'id'>[] = [
  {
    text: 'Tableau de bord',
    icon: <Dashboard />,
    path: '/dashboard',
    roles: ['all'],
    permission: 'dashboard:view'
  },
  {
    text: 'Propriétés',
    icon: <Home />,
    path: '/properties',
    roles: ['ADMIN', 'MANAGER', 'HOST'],
    permission: 'properties:view'
  },
  {
    text: 'Demandes de service',
    icon: <Assignment />,
    path: '/service-requests',
    roles: ['ADMIN', 'MANAGER', 'HOST', 'SUPERVISOR'],
    permission: 'service-requests:view'
  },
  {
    text: 'Interventions',
    icon: <Build />,
    path: '/interventions',
    roles: ['ADMIN', 'MANAGER', 'TECHNICIAN', 'HOUSEKEEPER', 'SUPERVISOR'],
    permission: 'interventions:view'
  },
  {
    text: 'Équipes',
    icon: <People />,
    path: '/teams',
    roles: ['ADMIN', 'MANAGER', 'SUPERVISOR'],
    permission: 'teams:view'
  },
  {
    text: 'Portefeuilles',
    icon: <Business />,
    path: '/portfolios',
    roles: ['ADMIN', 'MANAGER'],
    permission: 'portfolios:view'
  },
  {
    text: 'Contact',
    icon: <Notifications />,
    path: '/contact',
    roles: ['all'],
    permission: 'contact:view'
  },
  {
    text: 'Rapports',
    icon: <Assessment />,
    path: '/reports',
    roles: ['ADMIN', 'MANAGER'],
    permission: 'reports:view'
  },
  {
    text: 'Utilisateurs',
    icon: <People />,
    path: '/users',
    roles: ['ADMIN'],
    permission: 'users:manage'
  },
  {
    text: 'Paramètres',
    icon: <Settings />,
    path: '/settings',
    roles: ['ADMIN', 'MANAGER'],
    permission: 'settings:view'
  },
  {
    text: 'Roles & Permissions',
    icon: <Build />,
    path: '/permissions-test',
    roles: ['ADMIN']
    // Pas de permission spécifique, juste le rôle ADMIN
  },
  {
    text: 'Monitoring',
    icon: <Security />,
    path: '/admin/monitoring',
    roles: ['ADMIN', 'MANAGER']
  }
];

export const useNavigationMenu = (): UseNavigationMenuReturn => {
  const { hasPermissionAsync, isAdmin, isManager, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fonction pour vérifier si un utilisateur a accès à un élément de menu (synchronisée)
  const hasMenuAccess = useCallback((item: Omit<MenuItem, 'id'>): boolean => {
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
      console.error('Error checking menu access:', err);
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

      for (const item of MENU_CONFIG) {
        const hasAccess = hasMenuAccess(item);
        if (hasAccess) {
          accessibleItems.push({
            id: item.path,
            ...item
          });
        }
      }

      return accessibleItems;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la construction du menu';
      setError(errorMessage);
      console.error('Error building menu items:', err);
      
      // Retourner un menu de base en cas d'erreur
      return [{
        id: '/dashboard',
        text: 'Tableau de bord',
        icon: <Dashboard />,
        path: '/dashboard',
        roles: ['all']
      }];
    } finally {
      setLoading(false);
    }
  }, [user, hasMenuAccess]);

  // État mémorisé du menu
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  // Fonction pour rafraîchir le menu
  const refreshMenu = useCallback(() => {
    const newMenuItems = buildMenuItems();
    setMenuItems(newMenuItems);
  }, [buildMenuItems]);

  // Construire le menu au montage et quand les dépendances changent
  useEffect(() => {
    if (user?.id) {
      const newMenuItems = buildMenuItems();
      setMenuItems(newMenuItems);
    } else {
      setMenuItems([]);
    }
  }, [user?.id, user?.permissions, buildMenuItems]);

  // Mémoriser le résultat pour éviter les re-renders inutiles
  const memoizedMenuItems = useMemo(() => menuItems, [menuItems]);

  return {
    menuItems: memoizedMenuItems,
    loading,
    error,
    refreshMenu
  };
};
