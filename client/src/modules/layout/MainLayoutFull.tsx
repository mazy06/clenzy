import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
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
  console.log('🔍 MainLayoutFull - DÉBUT du composant');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [connectionTime] = useState(new Date());
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, isManager, isHost, isTechnician, isHousekeeper, isSupervisor, clearUser, restoreKeycloakState } = useAuth();

    // Identifiant unique pour ce rendu
    const renderId = React.useId();
    
    console.log('🔍 MainLayoutFull - DÉBUT du composant, ID:', renderId);
    
    // Debug: monitor user changes
    useEffect(() => {
      console.log('🔍 MainLayoutFull - useEffect user changed:', user);
      if (user) {
        console.log('🔍 MainLayoutFull - User changed:', user);
        console.log('🔍 MainLayoutFull - Current roles:', user.roles);
        console.log('🔍 MainLayoutFull - Number of roles:', user.roles.length);
      } else {
        console.log('🔍 MainLayoutFull - No user connected');
      }
    }, [user]);
    
    // Tentative de restauration (optionnelle) au montage - non bloquante
    useEffect(() => {
      if (!user && !keycloak.authenticated) {
        restoreKeycloakState();
      }
    }, []);

  // Temporary log to identify double rendering problem
  console.log('🔍 MainLayoutFull - RENDU with ID:', renderId);
  console.log('🔍 MainLayoutFull - Rendered with user:', user);
  console.log('🔍 MainLayoutFull - Number of roles:', user?.roles?.length || 0);
  console.log('🔍 MainLayoutFull - Location:', location.pathname);
  console.log('🔍 MainLayoutFull - Role functions available:', {
    isAdmin: typeof isAdmin,
    isManager: typeof isManager,
    isHost: typeof isHost,
    isTechnician: typeof isTechnician,
    isHousekeeper: typeof isHousekeeper,
    isSupervisor: typeof isSupervisor
  });

    // Si pas d'utilisateur, ne pas rediriger ici pour éviter les boucles.
    // Le routeur au niveau de App.tsx s'occupe de la redirection.
    if (!user) {
      console.log('🔍 MainLayoutFull - No user, waiting for router guard');
      return null;
    }

  console.log('🔍 MainLayoutFull - User found, checking role functions...');

  // Security check: ensure role functions are defined
  // But don't crash if they are not yet
  const functionsDefined = typeof isAdmin === 'function' && 
                          typeof isManager === 'function' && 
                          typeof isHost === 'function' && 
                          typeof isTechnician === 'function' && 
                          typeof isHousekeeper === 'function' && 
                          typeof isSupervisor === 'function';
    
    console.log('🔍 MainLayoutFull - Functions defined:', functionsDefined);
    
  if (!functionsDefined) {
    console.log('🔍 MainLayoutFull - Role functions not yet defined, displaying loading');
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

  console.log('🔍 MainLayoutFull - Role functions defined, testing execution...');

  // Check that role functions work without error
  let canRender = true;
  try {
    // Simple test of role functions
    console.log('🔍 MainLayoutFull - Test isAdmin()...');
    isAdmin();
    console.log('🔍 MainLayoutFull - Test isManager()...');
    isManager();
    console.log('🔍 MainLayoutFull - Test isHost()...');
    isHost();
    console.log('🔍 MainLayoutFull - Test isTechnician()...');
    isTechnician();
    console.log('🔍 MainLayoutFull - Test isHousekeeper()...');
    isHousekeeper();
    console.log('🔍 MainLayoutFull - Test isSupervisor()...');
    isSupervisor();
    console.log('🔍 MainLayoutFull - All role function tests passed');
  } catch (error) {
    console.error('🔍 MainLayoutFull - Error testing role functions:', error);
    canRender = false;
  }

  if (!canRender) {
    console.log('🔍 MainLayoutFull - Error in role functions, displaying loading');
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

  console.log('🔍 MainLayoutFull - All checks passed, building menu...');

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
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
      console.log('🔍 MainLayoutFull - Building menu items...');
      
      // Protection: check that all functions are defined
      if (!functionsDefined) {
        console.log('🔍 MainLayoutFull - Role functions not defined, returning base menu');
        return [
          {
            text: 'Dashboard',
            icon: <Dashboard />,
            path: '/dashboard',
            roles: ['all']
          }
        ];
      }

      console.log('🔍 MainLayoutFull - Building full menu...');

      const baseItems = [
        {
          text: 'Dashboard',
          icon: <Dashboard />,
          path: '/dashboard',
          roles: ['all']
        }
      ];

      const roleBasedItems: Array<{
        text: string;
        icon: React.ReactNode;
        path: string;
        roles: string[];
      }> = [];

      try {
        console.log('🔍 MainLayoutFull - Testing role conditions...');
        
        // Properties - visible by ADMIN, MANAGER, HOST
        if (isAdmin() || isManager() || isHost()) {
          console.log('🔍 MainLayoutFull - Adding Properties');
          roleBasedItems.push({
            text: 'Properties',
            icon: <Home />,
            path: '/properties',
            roles: ['ADMIN', 'MANAGER', 'HOST']
          });
        }

        // Service Requests - visible by ADMIN, MANAGER, HOST, SUPERVISOR
        if (isAdmin() || isManager() || isHost() || isSupervisor()) {
          console.log('🔍 MainLayoutFull - Adding Service Requests');
          roleBasedItems.push({
            text: 'Service Requests',
            icon: <Assignment />,
            path: '/service-requests',
            roles: ['ADMIN', 'MANAGER', 'HOST', 'SUPERVISOR']
          });
        }

        // Interventions - visible by ADMIN, MANAGER, TECHNICIAN, HOUSEKEEPER, SUPERVISOR
        if (isAdmin() || isManager() || isTechnician() || isHousekeeper() || isSupervisor()) {
          console.log('🔍 MainLayoutFull - Adding Interventions');
          roleBasedItems.push({
            text: 'Interventions',
            icon: <Build />,
            path: '/interventions',
            roles: ['ADMIN', 'MANAGER', 'TECHNICIAN', 'HOUSEKEEPER', 'SUPERVISOR']
          });
        }

        // Teams - visible by ADMIN, MANAGER, SUPERVISOR
        if (isAdmin() || isManager() || isSupervisor()) {
          console.log('🔍 MainLayoutFull - Adding Teams');
          roleBasedItems.push({
            text: 'Teams',
            icon: <People />,
            path: '/teams',
            roles: ['ADMIN', 'MANAGER', 'SUPERVISOR']
          });
        }

        // Users - visible uniquement aux administrateurs
        if (isAdmin()) {
          console.log('🔍 MainLayoutFull - Adding Users');
          roleBasedItems.push({
            text: 'Utilisateurs',
            icon: <People />,
            path: '/users',
            roles: ['ADMIN']
          });
        }

        // Settings - visible by all
        console.log('🔍 MainLayoutFull - Adding Settings');
        roleBasedItems.push({
          text: 'Settings',
          icon: <Settings />,
          path: '/settings',
          roles: ['all']
        });
        
        console.log('🔍 MainLayoutFull - Menu built successfully');
      } catch (error) {
        console.error('🔍 MainLayoutFull - Error building menu:', error);
        // In case of error, return only the base menu
        return baseItems;
      }

      const finalMenu = [...baseItems, ...roleBasedItems];
      console.log('🔍 MainLayoutFull - Final menu:', finalMenu.map(item => item.text));
      return finalMenu;
  };

  // Build menu items
  const menuItems = buildMenuItems();
  
  console.log('🔍 MainLayoutFull - Menu built, preparing drawer...');

  const drawer = (
      <Box>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          p: 3, 
          mb: 3,
          backgroundColor: 'rgba(166, 192, 206, 0.08)',
          borderRadius: 2,
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
            borderRadius: 2,
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
                {user.username?.charAt(0)?.toUpperCase() || 'U'}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography 
                  variant="body1" 
                  fontWeight={700} 
                  color="text.primary"
                  sx={{ mb: 0.5 }}
                  noWrap
                >
                  {user.username || 'Utilisateur'}
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
            
            {/* Informations supplémentaires */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              pt: 2,
              borderTop: '1px solid rgba(166, 192, 206, 0.2)'
            }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Connexion
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {connectionTime.toLocaleDateString('fr-FR', { 
                    day: '2-digit', 
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Durée
                </Typography>
                <Typography variant="body2" fontWeight={500} color="primary.main">
                  {(() => {
                    const now = new Date();
                    const diff = now.getTime() - connectionTime.getTime();
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    if (hours > 0) {
                      return `${hours}h ${minutes}m`;
                    }
                    return `${minutes}m`;
                  })()}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary">
                  Statut
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 0.5,
                  mt: 0.5
                }}>
                  <Box sx={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    backgroundColor: '#4CAF50',
                    border: '2px solid white',
                    boxShadow: '0 0 0 1px rgba(76, 175, 80, 0.3)'
                  }} />
                  <Typography variant="caption" fontWeight={600} color="success.main">
                    En ligne
                  </Typography>
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
                    color: 'inherit',
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  primaryTypographyProps={{
                    fontSize: '0.9rem',
                    fontWeight: 500,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
  );
  
  console.log('🔍 MainLayoutFull - Drawer built, preparing final render...');

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
            zIndex: theme.zIndex.drawer - 1,
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
              
              <IconButton
                onClick={handleProfileMenuOpen}
                sx={{ p: 0 }}
              >
                <Avatar sx={{ width: 32, height: 32, bgcolor: '#A6C0CE' }}>
                  {user?.username?.charAt(0) || <AccountCircle />}
                </Avatar>
              </IconButton>
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
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
            }}
          >
            {drawer}
          </Drawer>
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', md: 'block' },
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
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

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleProfileMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <Logout fontSize="small" />
            </ListItemIcon>
            Logout
          </MenuItem>
        </Menu>
      </Box>
    );
}
