import React, { useCallback, useMemo } from 'react';
import { Box, IconButton } from '@mui/material';
import { Menu as MenuIcon } from '../../icons';
import { useLayoutState } from '../../hooks/useLayoutState';
import { useNavigationMenu } from '../../hooks/useNavigationMenu';
import { useSidebarState } from '../../hooks/useSidebarState';
import { useFormsStats } from '../../hooks/useReceivedForms';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from '../../components/Sidebar';
import { LoadingStates } from '../../components/LoadingStates';
import OfflineBanner from '../../components/OfflineBanner';
import PWAInstallBanner from '../../components/PWAInstallBanner';
import AssistantWidget from '../../components/AssistantWidget';

interface MainLayoutFullProps {
  children: React.ReactNode;
}

export default function MainLayoutFull({ children }: MainLayoutFullProps) {
  const layoutState = useLayoutState();
  const { menuItems, loading: menuLoading, error: menuError, refreshMenu } = useNavigationMenu();

  // Compteur global de formulaires recus en attente (NEW) — injecte sur l'item /contact
  const { user } = useAuth();
  const isAdminOrManager = user?.roles?.some((r) => ['SUPER_ADMIN', 'SUPER_MANAGER'].includes(r)) ?? false;
  const { data: formsStats } = useFormsStats(isAdminOrManager);
  const newFormsCount = formsStats?.totalNew ?? 0;

  // Enrichit les menuItems avec le badge sur /contact si pertinent
  const decoratedMenuItems = useMemo(() => {
    if (!isAdminOrManager || newFormsCount === 0) return menuItems;
    return menuItems.map((item) =>
      item.path === '/contact'
        ? { ...item, badge: newFormsCount, badgeColor: 'warning' as const }
        : item,
    );
  }, [menuItems, isAdminOrManager, newFormsCount]);
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
        menuItems={decoratedMenuItems}
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
            overflow: 'auto',
          }}
        >
          {/* Navigation de niveau 1 des hubs : le switcher segmenté (Direction A)
              est rendu DANS le PageHeader de chaque page-racine de hub
              (cf. HubScreenSwitcher), pas comme un bandeau séparé. */}
          {children}
        </Box>
      </Box>

      {/* PWA install prompt */}
      <PWAInstallBanner />

      {/* Assistant FAB + Drawer — accessible depuis toutes les pages
          (auto-hide sur /assistant ou l'UI complete est deja affichee) */}
      <AssistantWidget />
    </Box>
  );
}
