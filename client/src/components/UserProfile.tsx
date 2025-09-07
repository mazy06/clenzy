import React from 'react';
import {
  Box,
  Avatar,
  Typography,
  IconButton,
  Badge,
  Button,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Notifications,
  Logout,
  AccountCircle
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_CONFIG } from '../config/api';
import keycloak from '../keycloak';

interface UserProfileProps {
  onLogout: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onLogout }) => {
  const { user, isAdmin, isManager, isSupervisor, clearUser } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

      onLogout();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const handleProfileClick = () => {
    navigate('/profile');
  };

  const canSeeNotifications = typeof isAdmin === 'function' && 
                             typeof isManager === 'function' && 
                             typeof isSupervisor === 'function' && 
                             (isAdmin() || isManager() || isSupervisor());

  if (!user) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {/* Profil utilisateur */}
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          cursor: 'pointer',
          p: 1,
          borderRadius: 1,
          '&:hover': {
            backgroundColor: 'rgba(166, 192, 206, 0.1)',
          },
          transition: 'background-color 0.2s ease'
        }}
        onClick={handleProfileClick}
        title="Cliquer pour voir le profil"
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
          <Box>
            <Typography 
              variant="body2" 
              fontWeight={600} 
              color="text.primary"
              sx={{ lineHeight: 1 }}
            >
              {user.firstName || user.username || 'Utilisateur'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Notifications */}
      {canSeeNotifications && (
        <IconButton color="inherit" title="Notifications">
          <Badge badgeContent={3} color="error">
            <Notifications />
          </Badge>
        </IconButton>
      )}
      
      {/* Bouton de déconnexion */}
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
        {!isMobile && 'Déconnexion'}
      </Button>
    </Box>
  );
};
