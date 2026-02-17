import React, { useCallback, useMemo } from 'react';
import { Box, IconButton } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import { useLayoutState } from '../../hooks/useLayoutState';
import { useNavigationMenu } from '../../hooks/useNavigationMenu';
import { useSidebarState } from '../../hooks/useSidebarState';
import Sidebar from '../../components/Sidebar';
import { LoadingStates } from '../../components/LoadingStates';
import OfflineBanner from '../../components/OfflineBanner';
import PWAInstallBanner from '../../components/PWAInstallBanner';

interface MainLayoutFullProps {
  children: React.ReactNode;
}

export default function MainLayoutFull({ children }: MainLayoutFullProps) {
  const layoutState = useLayoutState();
  const { menuItems, loading: menuLoading, error: menuError, refreshMenu } = useNavigationMenu();
  const {
    isCollapsed,
    isMobileOpen,
    isMobile,
    sidebarWidth,
    toggleCollapsed,
    openMobile,
    closeMobile,
  } = useSidebarState();

  // Determiner l'etat de chargement
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

  // Afficher les etats de chargement
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

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', overflow: 'hidden' }}>
      {/* Banniere hors ligne */}
      <OfflineBanner />

      {/* Sidebar */}
      <Sidebar
        menuItems={menuItems}
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        isMobile={isMobile}
        onToggleCollapsed={toggleCollapsed}
        onCloseMobile={closeMobile}
      />

      {/* Zone principale — le Drawer permanent reserve deja son espace dans le flex */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          minWidth: 0,
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        {/* Hamburger mobile — barre minimale visible uniquement sur mobile */}
        {isMobile && (
          <Box
            sx={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              height: 48,
              px: 1.5,
              backgroundColor: 'background.paper',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <IconButton
              onClick={openMobile}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              <MenuIcon />
            </IconButton>
          </Box>
        )}

        {/* Contenu principal — flex container pour que les enfants puissent remplir l'espace */}
        <Box
          component="main"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            minHeight: 0,
            p: { xs: 1.5, md: 2 },
            backgroundColor: 'background.default',
            // Les pages qui gèrent leur propre scroll (ex: Dashboard Planning)
            // utilisent flex: 1 + overflow interne.
            // Les pages classiques débordent et scrollent via ce container.
            overflow: 'hidden',
          }}
        >
          {children}
        </Box>
      </Box>

      {/* PWA install prompt */}
      <PWAInstallBanner />
    </Box>
  );
}
