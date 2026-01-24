import React, { useCallback, useMemo } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useLayoutState } from '../../hooks/useLayoutState';
import { useNavigationMenu } from '../../hooks/useNavigationMenu';
import { TopNavigation } from '../../components/TopNavigation';
import { UserProfile } from '../../components/UserProfile';
import { LoadingStates } from '../../components/LoadingStates';
import clenzyLogo from '../../assets/Clenzy_logo.png';

interface MainLayoutFullProps {
  children: React.ReactNode;
}

export default function MainLayoutFull({ children }: MainLayoutFullProps) {
  const navigate = useNavigate();
  // Hooks personnalisés pour la gestion d'état
  const layoutState = useLayoutState();
  const { menuItems, loading: menuLoading, error: menuError, refreshMenu } = useNavigationMenu();

  // Gestionnaires d'événements mémorisés
  const handleLogout = useCallback(() => {
    // La logique de déconnexion est gérée dans UserProfile
    console.log('Logout initiated');
    }, []);

  // Déterminer l'état de chargement
  const loadingState = useMemo(() => {
    if (layoutState.loading) return 'loading';
    if (!layoutState.user) return 'user-loading';
    if (!layoutState.functionsDefined) return 'permissions-loading';
    if (layoutState.error) return 'error-loading';
    if (menuLoading) return 'permissions-loading';
    return 'ready';
  }, [layoutState, menuLoading]);

  // Gestion des erreurs
  const handleRetry = useCallback(async () => {
    await layoutState.refreshUser();
    refreshMenu();
  }, [layoutState.refreshUser, refreshMenu]);

  const handleClearError = useCallback(() => {
    layoutState.clearError();
  }, [layoutState.clearError]);

  // Afficher les états de chargement
  if (loadingState !== 'ready') {
    return (
      <LoadingStates
        state={loadingState}
        error={layoutState.error || menuError}
        onRetry={handleRetry}
        onClearError={handleClearError}
      />
    );
  }
  // Rendu principal de l'interface
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {/* AppBar avec logo et navigation */}
      <AppBar
        position="fixed"
        sx={{
          width: '100%',
          backgroundColor: 'white',
          color: '#A6C0CE',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderRadius: 0,
          zIndex: 1200,
        }}
      >
        <Toolbar 
          sx={{ 
            px: { xs: 1, sm: 2, md: 3 },
            minHeight: '64px !important',
            gap: 1,
          }}
        >
          {/* Logo et tagline */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 1, sm: 2 },
              mr: { xs: 1, sm: 2, md: 3 },
              cursor: 'pointer',
              flexShrink: 0,
              '&:hover': {
                opacity: 0.8,
              },
              transition: 'opacity 0.2s ease',
            }}
            onClick={() => navigate('/dashboard')}
          >
            <img
              src={clenzyLogo}
              alt="Clenzy Logo"
              style={{
                height: '36px',
                width: 'auto',
                maxWidth: '140px',
              }}
            />
          </Box>

          {/* Navigation horizontale */}
          <TopNavigation menuItems={menuItems} />

          {/* Espace flexible */}
          <Box sx={{ flexGrow: 1, minWidth: { xs: 0, sm: 16 } }} />

          {/* Profil utilisateur et actions */}
          <Box sx={{ flexShrink: 0 }}>
            <UserProfile onLogout={handleLogout} menuItems={menuItems} />
          </Box>
        </Toolbar>
      </AppBar>

      {/* Contenu principal */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: '100%',
          mt: '64px',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
