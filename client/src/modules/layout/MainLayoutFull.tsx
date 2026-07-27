import React, { useCallback, useMemo, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import { useLayoutState } from '../../hooks/useLayoutState';
import { useNavigationMenu } from '../../hooks/useNavigationMenu';
import { useSidebarState } from '../../hooks/useSidebarState';
import { useFormsStats } from '../../hooks/useReceivedForms';
import { useAuth } from '../../hooks/useAuth';
import AppSidebar from '../../components/AppSidebar';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '../../components/ui';
import { LoadingStates } from '../../components/LoadingStates';
import OfflineBanner from '../../components/OfflineBanner';
import PWAInstallBanner from '../../components/PWAInstallBanner';

// Assistant en lazy : son sous-arbre (react-markdown, dialog plein écran, useAgent)
// est lourd et monté sur CHAQUE page — le sortir du chunk layout permet au premier
// écran de s'afficher sans lui (la bulle apparaît dès que son chunk arrive).
const AssistantWidget = lazy(() => import('../../components/AssistantWidget'));
const AssistantDockTab = lazy(() => import('../../components/AssistantDockTab'));

// Présentation de l'assistant — les deux coexistent le temps de trancher :
//  - 'dock' : encoche « classeur » collée en bas à droite (phrases animées + chevron)
//  - 'fab'  : logo flottant draggable + bulle Popper (présentation historique)
const ASSISTANT_PRESENTATION: 'dock' | 'fab' = 'dock';

interface MainLayoutFullProps {
  children: React.ReactNode;
}

/**
 * Barre supérieure mobile — n'existe que pour ouvrir la navigation.
 * Isolée dans un composant car `useSidebar` exige d'être sous le provider, que
 * `MainLayoutFull` rend lui-même. C'est aussi ce qui garantit **une seule**
 * définition de « mobile » : celle du kit (768 px), partagée avec la sidebar.
 */
function MobileTopBar() {
  const { isMobile } = useSidebar();
  if (!isMobile) return null;

  return (
    <div className="flex h-12 shrink-0 items-center border-b border-border bg-background px-2">
      <SidebarTrigger />
    </div>
  );
}

export default function MainLayoutFull({ children }: MainLayoutFullProps) {
  // Éditeur Studio (/booking-engine/studio/:id) : full-bleed (sa propre coquille gère tout) →
  // pas de padding ni de scroll du conteneur, pour ne pas perdre de place.
  const { pathname } = useLocation();
  const fullBleed = pathname.startsWith('/booking-engine/studio/');

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
  // `useSidebarState` porte la préférence de repli desktop (localStorage).
  // Sous 1024 px, le provider du kit prend le relais en feuille latérale.
  const { isCollapsed, toggleCollapsed } = useSidebarState();

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
    // Le provider est le conteneur flex de l'application : il place la sidebar
    // (qui réserve sa propre gouttière) et l'inset côte à côte. `h-svh` +
    // `overflow-hidden` conservent la règle historique — c'est le contenu qui
    // scrolle, jamais la page.
    <SidebarProvider
      open={!isCollapsed}
      onOpenChange={(open) => {
        // Le provider annonce l'état souhaité ; `toggleCollapsed` bascule la
        // préférence persistée. On ne bascule que s'ils divergent, pour que le
        // rail, le raccourci clavier et le bouton du pied restent d'accord.
        if (open === isCollapsed) toggleCollapsed();
      }}
      className="h-svh min-h-svh overflow-hidden"
    >
      {/* Banniere hors ligne */}
      <OfflineBanner />

      <AppSidebar
        menuItems={decoratedMenuItems}
        isCollapsed={isCollapsed}
        onToggleCollapsed={toggleCollapsed}
      />

      <SidebarInset className="min-w-0 overflow-hidden">
        <MobileTopBar />

        {/* Contenu principal — flex container pour que les enfants puissent remplir l'espace */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            minHeight: 0,
            p: fullBleed ? 0 : { xs: 1.5, md: 2 },
            backgroundColor: 'background.default',
            // Les pages qui gèrent leur propre scroll (ex: Dashboard Planning)
            // utilisent flex: 1 + overflow interne.
            // Les pages classiques débordent et scrollent via ce container.
            overflow: fullBleed ? 'hidden' : 'auto',
          }}
        >
          {/* Navigation de niveau 1 des hubs : le switcher segmenté (Direction A)
              est rendu DANS le PageHeader de chaque page-racine de hub
              (cf. HubScreenSwitcher), pas comme un bandeau séparé. */}
          {children}
        </Box>
      </SidebarInset>

      {/* PWA install prompt */}
      <PWAInstallBanner />

      {/* Assistant : accessible depuis toutes les pages, agrandissable en
          plein ecran. Unique point d'entree de l'assistant (la page dediee
          /assistant a ete supprimee). Deux presentations disponibles, choisies
          via ASSISTANT_PRESENTATION ci-dessus. */}
      <Suspense fallback={null}>
        {ASSISTANT_PRESENTATION === 'dock' ? <AssistantDockTab /> : <AssistantWidget />}
      </Suspense>
    </SidebarProvider>
  );
}
