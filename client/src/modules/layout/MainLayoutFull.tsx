import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Home,
  Build,
  Assignment,
  People,
  Settings,
  Notifications,
  AccountCircle,
  Logout,
  Group,
  Assessment,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import keycloak from '../../keycloak';
import clenzyLogo from '../../assets/Clenzy_logo.png';
import { API_CONFIG } from '../../config/api';

const drawerWidth = 280;

interface MainLayoutFullProps {
  children: React.ReactNode;
}

export default function MainLayoutFull({ children }: MainLayoutFullProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  
  // Utilisation sécurisée du thème
  const theme = useTheme();
  const isMobile = useMediaQuery('md');
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, isManager, isHost, isTechnician, isHousekeeper, isSupervisor, hasPermission, hasPermissionSync, clearUser, restoreKeycloakState } = useAuth();

    // Identifiant unique pour ce rendu
    const renderId = React.useId();
    
    // Debug: monitor user changes
    useEffect(() => {
      if (user) {
        // Log silencieux pour le débogage si nécessaire
        // console.log('🔍 MainLayoutFull - User changed:', user.email);
      }
    }, [user]);
    
    // Tentative de restauration (optionnelle) au montage - non bloquante
    useEffect(() => {
      if (!user && !keycloak.authenticated) {
        restoreKeycloakState();
      }
    }, []);

    // Écouter les changements de permissions pour rafraîchir l'interface
    useEffect(() => {
      const handlePermissionsRefresh = () => {
        // Forcer le re-rendu du composant pour mettre à jour la navigation
        window.location.reload();
      };

      window.addEventListener('permissions-refreshed', handlePermissionsRefresh);

      return () => {
        window.removeEventListener('permissions-refreshed', handlePermissionsRefresh);
      };
    }, []);

    // Si pas d'utilisateur, ne pas rediriger ici pour éviter les boucles.
    // Le routeur au niveau de App.tsx s'occupe de la redirection.
    if (!user) {
      return null;
    }

  // Security check: ensure role functions are defined
  // But don't crash if they are not yet
  const functionsDefined = typeof isAdmin === 'function' && 
                          typeof isManager === 'function' && 
                          typeof isHost === 'function' && 
                          typeof isTechnician === 'function' && 
                          typeof isHousekeeper === 'function' && 
                          typeof isSupervisor === 'function';
    
  if (!functionsDefined) {
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh' 
      }}>
        <Typography>Loading permissions...</Typography>
      </Box>
    );
  }

  // Check that role functions work without error
  let canRender = true;
  try {
    // Simple test of role functions
    // isAdmin();
    // isManager();
    // isHost();
    // isTechnician();
    // isHousekeeper();
    // isSupervisor();
  } catch (error) {
    console.error('🔍 MainLayoutFull - Error testing role functions:', error);
    canRender = false;
  }

  if (!canRender) {
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh' 
      }}>
        <Typography>Error loading permissions...</Typography>
      </Box>
    );
  }

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };



  const handleLogout = async () => {
      console.log('🔍 MainLayoutFull - Logout requested');
      
      try {
        // Call backend logout endpoint
        const response = await fetch(API_CONFIG.ENDPOINTS.LOGOUT, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${keycloak.token}`,
            'Content-Type': 'application/json',
          },
        });

        // Nettoyage local même si le backend renvoie une erreur
        if (!response.ok) {
          console.error('🔍 MainLayoutFull - Error during logout:', response.status);
        }

        console.log('🔍 MainLayoutFull - Performing local logout cleanup');
        try {
          // Purge des tokens locaux
          localStorage.removeItem('kc_access_token');
          localStorage.removeItem('kc_refresh_token');
          localStorage.removeItem('kc_id_token');
          localStorage.removeItem('kc_expires_in');
        } catch {}

        // Réinitialiser l’état Keycloak minimal
        (keycloak as any).token = undefined;
        (keycloak as any).refreshToken = undefined;
        (keycloak as any).authenticated = false;

        // Nettoyage de l’état utilisateur React
        clearUser();

        // Déclencher l'événement de déconnexion pour informer App.tsx
        window.dispatchEvent(new CustomEvent('keycloak-auth-logout'));

        // Laisser App.tsx gérer la redirection
      } catch (error) {
        console.error('🔍 MainLayoutFull - Error during logout:', error);
      }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  // Build menu items without useMemo to avoid React error #310
  const buildMenuItems = () => {
      // Protection: check that all functions are defined
      if (!functionsDefined) {
        return [
          {
            text: 'Tableau de bord',
            icon: <Dashboard />,
            path: '/dashboard',
            roles: ['all']
          }
        ];
      }

      const baseItems: Array<{
        text: string;
        icon: React.ReactNode;
        path: string;
        roles: string[];
      }> = [
        // Le tableau de bord est maintenant géré par les permissions
      ];

      const roleBasedItems: Array<{
        text: string;
        icon: React.ReactNode;
        path: string;
        roles: string[];
      }> = [];

      try {
        // Dashboard - visible si permission dashboard:view
        if (hasPermissionSync('dashboard:view')) {
          roleBasedItems.push({
            text: 'Tableau de bord',
            icon: <Dashboard />,
            path: '/dashboard',
            roles: ['all']
          });
        }

        // Properties - visible si permission properties:view
        if (hasPermissionSync('properties:view')) {
          roleBasedItems.push({
            text: 'Propriétés',
            icon: <Home />,
            path: '/properties',
            roles: ['ADMIN', 'MANAGER', 'HOST']
          });
        }

        // Service Requests - visible si permission service-requests:view
        if (hasPermissionSync('service-requests:view')) {
          roleBasedItems.push({
            text: 'Demandes de service',
            icon: <Assignment />,
            path: '/service-requests',
            roles: ['ADMIN', 'MANAGER', 'HOST', 'SUPERVISOR']
          });
        }

        // Interventions - visible si permission interventions:view
        if (hasPermissionSync('interventions:view')) {
          roleBasedItems.push({
            text: 'Interventions',
            icon: <Build />,
            path: '/interventions',
            roles: ['ADMIN', 'MANAGER', 'TECHNICIAN', 'HOUSEKEEPER', 'SUPERVISOR']
          });
        }

        // Teams - visible si permission teams:view
        if (hasPermissionSync('teams:view')) {
          roleBasedItems.push({
            text: 'Équipes',
            icon: <People />,
            path: '/teams',
            roles: ['ADMIN', 'MANAGER', 'SUPERVISOR']
          });
        }

        // Reports - visible si permission reports:view
        if (hasPermissionSync('reports:view')) {
          roleBasedItems.push({
            text: 'Rapports',
            icon: <Assessment />,
            path: '/reports',
            roles: ['ADMIN', 'MANAGER']
          });
        }

        // Users - visible uniquement si permission users:manage
        if (hasPermissionSync('users:manage')) {
          roleBasedItems.push({
            text: 'Utilisateurs',
            icon: <People />,
            path: '/users',
            roles: ['ADMIN']
          });
        }

        // Settings - visible si permission settings:view
        if (hasPermissionSync('settings:view')) {
          roleBasedItems.push({
            text: 'Paramètres',
            icon: <Settings />,
            path: '/settings',
            roles: ['all']
          });
        }

        // Configuration des permissions - visible uniquement aux administrateurs avec permission users:manage
        if (hasPermissionSync('users:manage') && isAdmin()) {
          roleBasedItems.push({
            text: 'Roles & Permissions',
            icon: <Build />,
            path: '/permissions-test',
            roles: ['ADMIN']
          });
        }
        
      } catch (error) {
        console.error('🔍 MainLayoutFull - Error building menu:', error);
        // In case of error, return only the base menu
        return baseItems;
      }

      const finalMenu = [...baseItems, ...roleBasedItems];
      return finalMenu;
  };

  // Build menu items
  const menuItems = buildMenuItems();
  
  const drawer = (
      <Box>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          p: 3, 
          mb: 3,
          backgroundColor: 'rgba(166, 192, 206, 0.08)',
          border: '1px solid rgba(166, 192, 206, 0.15)'
        }}>
          <img 
            src={clenzyLogo} 
            alt="Clenzy Logo" 
            style={{ 
              height: '60px', 
              width: 'auto',
              maxWidth: '200px',
              marginBottom: '8px'
            }} 
          />
          <Typography 
            variant="caption" 
            color="text.secondary"
            sx={{ 
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: 600,
              textAlign: 'center'
            }}
          >
            Propreté & Multiservices
          </Typography>
        </Box>
        {user && user.roles && user.roles.length > 0 && (
          <Box sx={{ 
            p: 3, 
            mb: 3, 
            backgroundColor: 'rgba(166, 192, 206, 0.05)',
            border: '1px solid rgba(166, 192, 206, 0.2)'
          }}>
            {/* Header de la section utilisateur */}
            <Typography 
              variant="caption" 
              color="text.secondary" 
              sx={{ 
                display: 'block', 
                mb: 2, 
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: 600
              }}
            >
              Utilisateur connecté
            </Typography>
            
            {/* Informations utilisateur principales */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Avatar 
                sx={{ 
                  width: 48, 
                  height: 48, 
                  bgcolor: '#A6C0CE',
                  fontSize: '1.3rem',
                  fontWeight: 700,
                  border: '2px solid rgba(166, 192, 206, 0.3)'
                }}
              >
                {user.firstName?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase() || 'U'}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography 
                  variant="body1" 
                  fontWeight={700} 
                  color="text.primary"
                  sx={{ mb: 0.5 }}
                  noWrap
                >
                  {user.fullName || user.firstName || user.username || 'Utilisateur'}
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ mb: 1 }}
                  noWrap
                >
                  {user.email || 'email@clenzy.fr'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={user.roles[0] || 'User'}
                    size="small"
                    sx={{
                      backgroundColor: '#A6C0CE',
                      color: 'white',
                      fontSize: '0.75rem',
                      height: 22,
                      fontWeight: 600,
                      '& .MuiChip-label': {
                        px: 1
                      }
                    }}
                  />
                  {user.roles && user.roles.length > 1 && (
                    <Chip
                      label={`+${user.roles.length - 1} autre${user.roles.length > 2 ? 's' : ''}`}
                      size="small"
                      variant="outlined"
                      sx={{
                        borderColor: 'rgba(166, 192, 206, 0.4)',
                        color: 'text.secondary',
                        fontSize: '0.7rem',
                        height: 20
                      }}
                    />
                  )}
                </Box>
              </Box>
            </Box>
            

          </Box>
        )}
        
        <Divider sx={{ mb: 2 }} />
        
        <List>
          {menuItems.map((item, index) => (
            <ListItem key={index} disablePadding>
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                selected={location.pathname === item.path}
                sx={{
                  borderRadius: 2,
                  mx: 1,
                  mb: 0.5,
                  '&.Mui-selected': {
                    backgroundColor: '#A6C0CE',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: '#8BA3B3',
                    },
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(166, 192, 206, 0.1)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: location.pathname === item.path ? 'inherit' : '#666666',
                    minWidth: 40,
                    '& .MuiSvgIcon-root': {
                      color: location.pathname === item.path ? 'inherit' : '#666666',
                    },
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  primaryTypographyProps={{
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    color: location.pathname === item.path ? 'inherit' : '#666666',
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
  );
  
  return (
      <Box sx={{ display: 'flex' }}>
        <AppBar
          position="fixed"
          sx={{
            width: '100%',
            backgroundColor: 'white',
            color: '#A6C0CE',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            borderRadius: 0,
            zIndex: (theme?.zIndex?.drawer || 1200) - 1,
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            
            <Box sx={{ flexGrow: 1 }} />
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* Notifications - visible by ADMIN, MANAGER, SUPERVISOR - with security check */}
              {typeof isAdmin === 'function' && typeof isManager === 'function' && typeof isSupervisor === 'function' && 
               (isAdmin() || isManager() || isSupervisor()) && (
                <IconButton color="inherit">
                  <Badge badgeContent={3} color="error">
                    <Notifications />
                  </Badge>
                </IconButton>
              )}
              
              <Button
                onClick={handleLogout}
                color="inherit"
                startIcon={<Logout />}
                sx={{ 
                  textTransform: 'none',
                  fontWeight: 500,
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)'
                  }
                }}
              >
                Déconnexion
              </Button>
            </Box>
          </Toolbar>
        </AppBar>

        <Box
          component="nav"
          sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        >
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true,
            }}
            sx={{
              display: { xs: 'block', md: 'none' },
              '& .MuiDrawer-paper': { 
                boxSizing: 'border-box', 
                width: drawerWidth,
                borderRadius: 0
              },
            }}
          >
            {drawer}
          </Drawer>
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', md: 'block' },
              '& .MuiDrawer-paper': { 
                boxSizing: 'border-box', 
                width: drawerWidth,
                borderRadius: 0
              },
            }}
            open
          >
            {drawer}
          </Drawer>
        </Box>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            width: { md: `calc(100% - ${drawerWidth}px)` },
            mt: '64px',
          }}
        >
          {children}
        </Box>


      </Box>
    );
}
