import React, { useState, useEffect } from 'react';
import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Home as HomeIcon,
  Assignment as AssignmentIcon,
  Build as BuildIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface NavigationItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: string;
  roles?: string[];
}

const navigationItems: NavigationItem[] = [
  {
    label: 'Tableau de bord',
    path: '/dashboard',
    icon: <DashboardIcon />,
    permission: 'dashboard:view'
  },
  {
    label: 'Propriétés',
    path: '/properties',
    icon: <HomeIcon />,
    permission: 'properties:view'
  },
  {
    label: 'Demandes de service',
    path: '/service-requests',
    icon: <AssignmentIcon />,
    permission: 'service-requests:view'
  },
  {
    label: 'Interventions',
    path: '/interventions',
    icon: <BuildIcon />,
    permission: 'interventions:view'
  },
  {
    label: 'Équipes',
    path: '/teams',
    icon: <PeopleIcon />,
    permission: 'teams:view'
  },
  {
    label: 'Utilisateurs',
    path: '/users',
    icon: <PersonIcon />,
    permission: 'users:manage'
  },
  {
    label: 'Paramètres',
    path: '/settings',
    icon: <SettingsIcon />,
    permission: 'settings:view'
  },
  {
    label: 'Rapports',
    path: '/reports',
    icon: <AssessmentIcon />,
    permission: 'reports:view'
  }
];

interface ConditionalNavigationProps {
  variant?: 'drawer' | 'list';
  onItemClick?: () => void;
}

const ConditionalNavigation: React.FC<ConditionalNavigationProps> = ({ 
  variant = 'drawer',
  onItemClick 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermissionAsync, hasRole } = useAuth();
  
  // État pour stocker les permissions de chaque élément
  const [itemPermissions, setItemPermissions] = useState<{[key: string]: boolean}>({});
  
  // Vérifier les permissions au chargement
  useEffect(() => {
    const checkAllPermissions = async () => {
      const permissions: {[key: string]: boolean} = {};
      
      for (const item of navigationItems) {
        if (item.permission) {
          const hasPermission = await hasPermissionAsync(item.permission);
          permissions[item.path] = hasPermission;
        } else {
          permissions[item.path] = true; // Pas de permission requise
        }
      }
      
      setItemPermissions(permissions);
    };
    
    checkAllPermissions();
  }, [hasPermissionAsync]);

  const handleNavigation = (path: string) => {
    navigate(path);
    if (onItemClick) {
      onItemClick();
    }
  };

  const isItemVisible = (item: NavigationItem): boolean => {
    // Vérifier la permission si spécifiée
    if (item.permission) {
      return itemPermissions[item.path] || false;
    }

    // Vérifier les rôles si spécifiés
    if (item.roles && !item.roles.some(role => hasRole(role))) {
      return false;
    }

    return true;
  };

  const visibleItems = navigationItems.filter(isItemVisible);

  if (variant === 'list') {
    return (
      <List>
        {visibleItems.map((item, index) => (
          <React.Fragment key={item.path}>
            <ListItem disablePadding>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: location.pathname === item.path ? 'inherit' : 'text.primary',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
            {index < visibleItems.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>
    );
  }

  // Variant drawer (par défaut)
  return (
    <List>
      {visibleItems.map((item, index) => (
        <React.Fragment key={item.path}>
          <ListItem disablePadding>
            <Tooltip title={item.label} placement="right">
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  minHeight: 48,
                  justifyContent: 'center',
                  px: 2.5,
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: 'auto',
                    justifyContent: 'center',
                    color: location.pathname === item.path ? 'inherit' : 'text.primary',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
              </ListItemButton>
            </Tooltip>
          </ListItem>
          {index < visibleItems.length - 1 && <Divider />}
        </React.Fragment>
      ))}
    </List>
  );
};

export default ConditionalNavigation;
