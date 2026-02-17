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
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../services/api';
import keycloak from '../keycloak';
import { clearTokens } from '../services/storageService';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from '../hooks/useTranslation';

interface UserProfileProps {
  onLogout: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onLogout }) => {
  const { user, clearUser } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleLogout = async () => {
    try {
      await authApi.logout();
      clearTokens();
      keycloak.token = undefined;
      keycloak.refreshToken = undefined;
      keycloak.authenticated = false;
      clearUser();
      window.dispatchEvent(new CustomEvent('keycloak-auth-logout'));
      handleMenuClose();
      onLogout();
    } catch (error) {
      // silent
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

  if (!user) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {/* Avatar cliquable */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: 'pointer',
          p: 0.5,
          borderRadius: '6px',
          '&:hover': { backgroundColor: 'action.hover' },
          transition: 'background-color 150ms',
        }}
        onClick={handleProfileClick}
        aria-controls={open ? 'user-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        <Avatar
          sx={{
            width: 28,
            height: 28,
            bgcolor: 'secondary.main',
            fontSize: '0.8125rem',
            fontWeight: 700,
            border: '1.5px solid',
            borderColor: 'secondary.light',
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
            {user.firstName || user.username || t('navigation.defaultUser')}
          </Typography>
        )}
      </Box>

      {/* Menu deroulant */}
      <Menu
        id="user-menu"
        open={open}
        onClose={handleMenuClose}
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        disableAutoFocusItem
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              mt: 1,
              minWidth: 240,
              borderRadius: '8px',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: theme.palette.mode === 'dark'
                ? '0 4px 16px rgba(0,0,0,0.3)'
                : '0 4px 12px rgba(0,0,0,0.08)',
              backgroundColor: 'background.paper',
              overflow: 'hidden',
              '& .MuiMenuItem-root': {
                px: 1.5,
                py: 1.25,
                fontSize: '0.875rem',
                '&:hover': { backgroundColor: 'action.hover' },
              },
            },
          },
        }}
        MenuListProps={{ sx: { py: 0 } }}
      >
        {/* Badge utilisateur */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            backgroundColor: 'action.hover',
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: 'secondary.main',
              fontSize: '1rem',
              fontWeight: 700,
              border: '2px solid',
              borderColor: 'secondary.light',
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
              {user.firstName || user.username || t('navigation.defaultUser')}
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
                  color: 'secondary.main',
                  fontSize: '0.7rem',
                  mt: 0.25,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                {t(`navigation.roles.${user.roles[0]}`) || user.roles[0]}
              </Typography>
            )}
          </Box>
        </Box>

        <Divider />

        {/* Profil */}
        <MenuItem onClick={handleProfileNavigation}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Person sx={{ fontSize: 18, color: 'secondary.main' }} />
            <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
              {t('navigation.myProfile')}
            </Typography>
          </Box>
        </MenuItem>

        <Divider />

        {/* Langue */}
        <Box sx={{ px: 1.5, py: 1 }}>
          <LanguageSwitcher variant="select" />
        </Box>

        <Divider />

        {/* Deconnexion */}
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
            <Logout sx={{ fontSize: 18, color: 'error.main' }} />
            <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.875rem' }}>
              {t('navigation.logout')}
            </Typography>
          </Box>
        </MenuItem>
      </Menu>
    </Box>
  );
};
