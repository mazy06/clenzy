import React, { useState } from 'react';
import {
  Box,
  Avatar,
  Typography,
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Divider,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Notifications,
  Logout,
  Person
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_CONFIG } from '../config/api';
import keycloak from '../keycloak';
import { MenuItem as MenuItemType } from '../hooks/useNavigationMenu';

interface UserProfileProps {
  onLogout: () => void;
  menuItems: MenuItemType[];
}

export const UserProfile: React.FC<UserProfileProps> = ({ onLogout, menuItems }) => {
  const { user, isAdmin, isManager, isSupervisor, clearUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // Menus à afficher dans le menu déroulant (tous sauf ceux affichés directement dans la top nav)
  const dropdownMenus = menuItems.filter(item => 
    !['/dashboard', '/properties', '/service-requests', '/interventions', '/teams'].includes(item.path)
  );

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleLogout = async () => {
    try {
      // Appel au backend pour la déconnexion
      const response = await fetch(API_CONFIG.ENDPOINTS.LOGOUT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Error during logout:', response.status);
      }

      // Nettoyage local
      localStorage.removeItem('kc_access_token');
      localStorage.removeItem('kc_refresh_token');
      localStorage.removeItem('kc_id_token');
      localStorage.removeItem('kc_expires_in');

      // Réinitialiser l'état Keycloak
      (keycloak as any).token = undefined;
      (keycloak as any).refreshToken = undefined;
      (keycloak as any).authenticated = false;

      // Nettoyer l'état utilisateur React
      clearUser();

      // Déclencher l'événement de déconnexion
      window.dispatchEvent(new CustomEvent('keycloak-auth-logout'));

      handleMenuClose();
      onLogout();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const handleProfileClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileNavigation = () => {
    navigate('/profile');
    handleMenuClose();
  };

  const handleMenuNavigation = (path: string) => {
    navigate(path);
    handleMenuClose();
  };

  const canSeeNotifications = typeof isAdmin === 'function' && 
                             typeof isManager === 'function' && 
                             typeof isSupervisor === 'function' && 
                             (isAdmin() || isManager() || isSupervisor());

  if (!user) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {/* Notifications */}
      {canSeeNotifications && (
        <IconButton color="inherit" title="Notifications">
          <Badge badgeContent={3} color="error">
            <Notifications />
          </Badge>
        </IconButton>
      )}

      {/* Profil utilisateur avec menu déroulant */}
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          cursor: 'pointer',
          p: 0.5,
          borderRadius: 1,
          '&:hover': {
            backgroundColor: 'rgba(166, 192, 206, 0.1)',
          },
          transition: 'background-color 0.2s ease'
        }}
        onClick={handleProfileClick}
        aria-controls={open ? 'user-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        <Avatar 
          sx={{ 
            width: 32, 
            height: 32, 
            bgcolor: '#A6C0CE',
            fontSize: '0.9rem',
            fontWeight: 700,
            border: '2px solid rgba(166, 192, 206, 0.3)'
          }}
        >
          {user.firstName?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase() || 'U'}
        </Avatar>
        {!isMobile && (
          <Typography 
            variant="body2" 
            fontWeight={600} 
            color="text.primary"
            sx={{ lineHeight: 1, px: 0.5 }}
          >
            {user.firstName || user.username || 'Utilisateur'}
          </Typography>
        )}
      </Box>

      {/* Menu déroulant */}
      <Menu
        id="user-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            mt: 1.5,
            minWidth: 200,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            '& .MuiMenuItem-root': {
              px: 2,
              py: 1.5,
            },
          },
        }}
      >
        {/* Informations utilisateur */}
        <MenuItem disabled>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <Typography variant="body2" fontWeight={600}>
              {user.firstName || user.username || 'Utilisateur'}
            </Typography>
          </Box>
        </MenuItem>
        
        <Divider />

        {/* Profil */}
        <MenuItem onClick={handleProfileNavigation}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Person fontSize="small" />
            <Typography variant="body2">Mon profil</Typography>
          </Box>
        </MenuItem>

        {/* Autres menus */}
        {dropdownMenus.length > 0 && (
          <>
            <Divider />
            {dropdownMenus.map((item) => (
              <MenuItem
                key={item.id}
                onClick={() => handleMenuNavigation(item.path)}
                selected={isActive(item.path)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {item.icon}
                  <Typography variant="body2">{item.text}</Typography>
                </Box>
              </MenuItem>
            ))}
          </>
        )}

        <Divider />

        {/* Déconnexion */}
        <MenuItem 
          onClick={handleLogout}
          sx={{
            color: 'error.main',
            '&:hover': {
              backgroundColor: 'error.light',
              color: 'error.dark',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Logout fontSize="small" />
            <Typography variant="body2" fontWeight={500}>Déconnexion</Typography>
          </Box>
        </MenuItem>
      </Menu>
    </Box>
  );
};
