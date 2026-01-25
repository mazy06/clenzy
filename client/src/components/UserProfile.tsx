import React, { useState } from 'react';
import {
  Box,
  Avatar,
  Typography,
  Menu,
  MenuItem,
  Divider,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
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
    !['/dashboard', '/properties', '/service-requests', '/interventions', '/teams', '/portfolios', '/contact'].includes(item.path)
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

  if (!user) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
            width: 28, // 32 → 28
            height: 28, // 32 → 28
            bgcolor: '#A6C0CE',
            fontSize: '0.8125rem', // 0.9rem → 0.8125rem
            fontWeight: 700,
            border: '1.5px solid rgba(166, 192, 206, 0.3)' // 2px → 1.5px
          }}
        >
          {user.firstName?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase() || 'U'}
        </Avatar>
        {!isMobile && (
          <Typography 
            variant="body2" 
            fontWeight={600} 
            color="text.primary"
            sx={{ lineHeight: 1, px: 0.5, fontSize: '0.8125rem' }}
          >
            {user.firstName || user.username || 'Utilisateur'}
          </Typography>
        )}
      </Box>

      {/* Menu déroulant */}
      <Menu
        id="user-menu"
        open={open}
        onClose={handleMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={{ top: 56, right: 0 }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        disableAutoFocusItem
        slotProps={{
          paper: {
            elevation: 3,
            sx: {
              mt: 0,
              minWidth: 240,
              borderRadius: 0,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              backgroundColor: 'white',
              borderTop: '2px solid',
              borderColor: '#A6C0CE',
              maxHeight: 'calc(100vh - 56px)',
              overflow: 'auto',
              zIndex: 1300,
              position: 'fixed',
              right: 0,
              top: '56px !important',
              '& .MuiMenuItem-root': {
                px: 1.5,
                py: 1.25,
                fontSize: '0.875rem',
                '&:hover': {
                  backgroundColor: 'rgba(166, 192, 206, 0.08)',
                },
              },
            },
          },
        }}
        MenuListProps={{
          sx: {
            py: 0,
          },
        }}
        disableScrollLock
        BackdropProps={{
          sx: {
            backgroundColor: 'transparent',
          },
        }}
        sx={{
          '& .MuiPaper-root': {
            marginTop: '0px !important',
            top: '56px !important',
            right: '0px !important',
            left: 'auto !important',
          },
          '& .MuiBackdrop-root': {
            backgroundColor: 'transparent',
          },
        }}
      >
        {/* Badge utilisateur intégré - partie intégrante de la top nav */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            backgroundColor: 'rgba(166, 192, 206, 0.08)',
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            minHeight: 64,
          }}
        >
          <Avatar 
            sx={{ 
              width: 44,
              height: 44,
              bgcolor: '#A6C0CE',
              fontSize: '1.1rem',
              fontWeight: 700,
              border: '2px solid rgba(166, 192, 206, 0.4)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            {user.firstName?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase() || 'U'}
          </Avatar>
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <Typography 
              variant="body1" 
              fontWeight={700} 
              sx={{ 
                color: 'text.primary', 
                lineHeight: 1.3,
                fontSize: '0.9375rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user.firstName || user.username || 'Utilisateur'}
            </Typography>
            {user.email && (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'text.secondary', 
                  fontSize: '0.75rem', 
                  mt: 0.25,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.email}
              </Typography>
            )}
            {user.roles && user.roles.length > 0 && (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: '#A6C0CE', 
                  fontSize: '0.7rem', 
                  mt: 0.25,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                {user.roles[0]}
              </Typography>
            )}
          </Box>
        </Box>
        
        <Divider />

        {/* Profil */}
        <MenuItem onClick={handleProfileNavigation}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Person sx={{ fontSize: '18px', color: 'secondary.main' }} />
            <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>Mon profil</Typography>
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ '& .MuiSvgIcon-root': { fontSize: '18px', color: 'secondary.main' } }}>{item.icon}</Box>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>{item.text}</Typography>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Logout sx={{ fontSize: '18px', color: 'error.main' }} />
            <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.875rem' }}>Déconnexion</Typography>
          </Box>
        </MenuItem>
      </Menu>
    </Box>
  );
};
