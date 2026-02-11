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
import NotificationBell from '../../components/NotificationBell';
import OfflineBanner from '../../components/OfflineBanner';
import clenzyLogo from '../../assets/Clenzy_logo.png';
import PWAInstallBanner from '../../components/PWAInstallBanner';

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
      {/* Bannière hors ligne */}
      <OfflineBanner />

      {/* AppBar avec logo et navigation */}
      <AppBar
        position="fixed"
        sx={{
          width: '100%',
          backgroundColor: (theme) => theme.palette.background.paper,
          color: '#A6C0CE',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderRadius: 0,
          zIndex: 1200,
        }}
      >
        <Toolbar 
          sx={{ 
            px: { xs: 1, sm: 1.5, md: 2 },
            minHeight: '56px !important', // 64px → 56px
            gap: 0.75, // 1 → 0.75
            position: 'relative', // Pour permettre le positionnement absolu des enfants
          }}
        >
          {/* Logo et tagline */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 1, sm: 2 },
              cursor: 'pointer',
              flexShrink: 0,
              position: 'absolute',
              left: { xs: 1, sm: 1.5, md: 2 },
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
                height: '32px', // 36px → 32px
                width: 'auto',
                maxWidth: '120px', // 140px → 120px
              }}
            />
          </Box>

          {/* Navigation horizontale - centrée */}
          <Box sx={{ 
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
            '& > *': {
              pointerEvents: 'auto',
            }
          }}>
            <TopNavigation menuItems={menuItems} />
          </Box>

          {/* Espace flexible pour équilibrer */}
          <Box sx={{ flexGrow: 1, minWidth: { xs: 0, sm: 16 } }} />

          {/* Notifications et profil utilisateur */}
          <Box sx={{
            flexShrink: 0,
            position: 'absolute',
            right: { xs: 1, sm: 1.5, md: 2 },
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}>
            <NotificationBell />
            <UserProfile onLogout={handleLogout} menuItems={menuItems} />
          </Box>
        </Toolbar>
      </AppBar>

      {/* Contenu principal */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2, // 3 → 2
          width: '100%',
          mt: '56px', // 64px → 56px
        }}
      >
        {children}
      </Box>

      {/* PWA install prompt */}
      <PWAInstallBanner />
    </Box>
  );
}
