import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import keycloak from '../keycloak';
import { useAuth } from '../hooks/useAuth';
import { useTokenManagement } from '../hooks/useTokenManagement';
import { configureConsole } from '../config/console';
import { CustomPermissionsProvider } from '../hooks/useCustomPermissions';
import { UserUiPreferencesProvider } from '../providers/UserUiPreferencesProvider';
import { usePostHogIdentify, usePostHogPageTracking } from '../providers/PostHogProvider';
import { useCrispIdentify } from '../hooks/useCrispIdentify';
import Login from './auth/Login';
import Inscription from './auth/Inscription';
import InscriptionSuccess from './auth/InscriptionSuccess';
import InscriptionConfirm from './auth/InscriptionConfirm';
import Support from './auth/Support';
import Cgu from './legal/Cgu';
import Privacy from './legal/Privacy';
import AcceptInvitationPage from './invitations/AcceptInvitationPage';
import PublicKeyVerification from '../pages/PublicKeyVerification';
import MainLayoutFull from './layout/MainLayoutFull';
import AuthenticatedApp from './AuthenticatedApp';
import { clearTokens } from '../services/storageService';

// Routes publiques accessibles sans authentification
const PUBLIC_ROUTES = ['/login', '/inscription', '/inscription/success', '/inscription/confirm', '/support', '/accept-invitation'];

// Routes publiques avec paramètres (prefix match)
const PUBLIC_ROUTE_PREFIXES = ['/verify-key/'];

const App: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [authenticated, setAuthenticated] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const location = useLocation();

  // ─── Third-party user identification (PostHog, Crisp, Sentry) ──────────────
  usePostHogIdentify();
  usePostHogPageTracking();
  useCrispIdentify();

  // Sentry user context — set user for all error reports
  useEffect(() => {
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.username,
      });
      Sentry.setTag('organization_id', String(user.organizationId || ''));
      Sentry.setTag('platform_role', user.platformRole || '');
      Sentry.setTag('plan', user.forfait || '');
    } else {
      Sentry.setUser(null);
    }
  }, [user]);

  // Déterminer si on est sur une route publique
  const isPublicRoute = PUBLIC_ROUTES.includes(location.pathname)
    || PUBLIC_ROUTE_PREFIXES.some(prefix => location.pathname.startsWith(prefix));

  // Refs pour les fonctions de token management
  const stopTokenMonitoringRef = useRef<(() => void) | null>(null);
  const resetTokenServiceRef = useRef<(() => void) | null>(null);

  // Configurer la console pour filtrer les erreurs d'extensions
  useEffect(() => {
    configureConsole();
  }, []);

  // Gestion de la déconnexion globale
  const handleGlobalLogout = useCallback(() => {
    // Arrêter le monitoring des tokens
    if (stopTokenMonitoringRef.current) {
      stopTokenMonitoringRef.current();
    }
    
    // Reset du service de tokens
    if (resetTokenServiceRef.current) {
      resetTokenServiceRef.current();
    }
    
    // Nettoyer l'état local
    setAuthenticated(false);
    
    // Forcer la mise à jour de l'état Keycloak
    keycloak.authenticated = false;
    keycloak.token = undefined;
    keycloak.refreshToken = undefined;
    
    // Nettoyer localStorage
    clearTokens();

    // Hard redirect (pas navigate) pour forcer un reload complet du shell HTML.
    // Pourquoi : apres un deploy de nouvelle version, les chunks JS deja
    // charges en memoire (notamment le Login bundle) ne sont pas remplaces par
    // une simple navigation React Router. Un window.location.href force le
    // browser a refetch index.html (no-cache cote nginx) et recharger les
    // nouveaux chunks hashes. Sans ca, l'utilisateur voit l'ancien Login
    // jusqu'a un hard refresh manuel.
    //
    // Side-effects souhaites :
    //   - Le SPA est totalement re-initialise (state propre, pas de leak)
    //   - Le service worker (PWA) detecte le nouveau index.html et active la
    //     nouvelle version (skipWaiting + clientsClaim deja configures)
    //   - Tous les listeners / timers / intervalles sont nettoyes par le GC
    window.location.href = '/login';
  }, []);

  // Callbacks pour la gestion des tokens
  const handleTokenRefresh = useCallback((_result: unknown) => {
  }, []);

  const handleTokenExpired = useCallback(() => {
    handleGlobalLogout();
  }, [handleGlobalLogout]);

  const handleMaxRetriesExceeded = useCallback(() => {
    handleGlobalLogout();
  }, [handleGlobalLogout]);

  // Gestion intelligente des tokens
  const {
    refreshToken,
    checkTokenHealth,
    forceHealthCheck,
    getCurrentTokenInfo,
    cleanupExpiredTokens,
    isExpiringSoon,
    isCritical,
    timeUntilExpiryFormatted
  } = useTokenManagement();

  // Mettre à jour les refs
  useEffect(() => {
    resetTokenServiceRef.current = () => {
      // Le service se réinitialise automatiquement maintenant
    };
  }, []);

  // Gestion des événements Keycloak
  useEffect(() => {
    const handleAuthLogout = () => {
      handleGlobalLogout();
    };

    const handleCustomAuthSuccess = () => {
      setAuthenticated(true);
      checkTokenHealth();
      
      // Forcer la mise à jour de l'état Keycloak
      if (keycloak) {
        keycloak.authenticated = true;
      }
      
      // Forcer le rechargement des informations utilisateur
      // en déclenchant un événement personnalisé
      window.dispatchEvent(new CustomEvent('force-user-reload'));
    };

    const handleCustomAuthLogout = () => {
      // Mettre à jour l'état immédiatement pour éviter l'écran blanc
      setAuthenticated(false);
      // Puis rediriger
      handleGlobalLogout();
    };

    // Écouter les événements Keycloak
    keycloak.onAuthLogout = handleAuthLogout;
    window.addEventListener('keycloak-auth-success', handleCustomAuthSuccess);
    window.addEventListener('keycloak-auth-logout', handleCustomAuthLogout);

    return () => {
      keycloak.onAuthLogout = undefined;
      window.removeEventListener('keycloak-auth-success', handleCustomAuthSuccess);
      window.removeEventListener('keycloak-auth-logout', handleCustomAuthLogout);
    };
  }, [checkTokenHealth]);

  // Initialisation de Keycloak
  useEffect(() => {
    if (!initialized) {
      const initKeycloak = async () => {
        try {
          if (keycloak.authenticated) {
            setAuthenticated(true);
            setInitialized(true);

            // Vérifier la santé du token
            checkTokenHealth();

            // SECURITE (CLAUDE.md regle #7) : les tokens ne sont PLUS persistes
            // en localStorage. Source unique : cookie HttpOnly `clenzy_auth`
            // (cf. TokenCookieFilter + AuthSessionController) + keycloak.token
            // en memoire.
          } else {
            setInitialized(true);
            setAuthenticated(false);
          }
        } catch (error) {
          setInitialized(true);
          setAuthenticated(false);
        }
      };

      initKeycloak();
    }
  }, [initialized, checkTokenHealth]);

  // Affichage du composant de chargement (uniquement pour les routes protégées)
  // Les routes publiques (/login, /inscription) ne doivent pas être bloquées par le loading
  if ((!initialized || authLoading) && !isPublicRoute) {
    return (
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 2
      }}>
        <CircularProgress size={60} />
        <Typography variant="h6" color="text.secondary">
          Chargement de l'authentification...
        </Typography>
      </Box>
    );
  }

  // Rendu de l'application avec routage
  return (
    <CustomPermissionsProvider>
      <UserUiPreferencesProvider>
        <Routes>
          {/* Route publique pour le login */}
          <Route
            path="/login"
            element={
              !authenticated || !keycloak.authenticated ? (
                <Login />
              ) : (
                <Navigate to="/planning" replace />
              )
            }
          />

          {/* Route publique pour l'inscription */}
          <Route
            path="/inscription"
            element={
              !authenticated || !keycloak.authenticated ? (
                <Inscription />
              ) : (
                <Navigate to="/planning" replace />
              )
            }
          />

          {/* Route publique pour le succes d'inscription */}
          <Route path="/inscription/success" element={<InscriptionSuccess />} />

          {/* Route publique pour la confirmation d'inscription (email + mot de passe) */}
          <Route path="/inscription/confirm" element={<InscriptionConfirm />} />

          {/* Route publique pour le support */}
          <Route path="/support" element={<Support />} />

          {/* Routes publiques legales (CGU + Politique de confidentialite RGPD) */}
          <Route path="/cgu" element={<Cgu />} />
          <Route path="/confidentialite" element={<Privacy />} />

          {/* Route publique/semi-publique pour accepter une invitation */}
          <Route path="/accept-invitation" element={<AcceptInvitationPage />} />

          {/* Route publique pour la verification de code par les commercants */}
          <Route path="/verify-key/:token" element={<PublicKeyVerification />} />
        
        {/* Routes protégées */}
        <Route 
          path="/*" 
          element={
            !authenticated || !keycloak.authenticated ? (
              <Navigate to="/login" replace />
            ) : (
              // Si authentifié, afficher soit le chargement soit l'app
              authLoading ? (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  height: '100vh', 
                  gap: 2 
                }}>
                  <CircularProgress size={60} />
                  <Typography variant="h6" color="text.secondary">
                    Chargement de l'utilisateur...
                  </Typography>
                </Box>
              ) : user ? (
                <MainLayoutFull>
                  <AuthenticatedApp />
                </MainLayoutFull>
              ) : (
                // Si pas d'utilisateur mais authentifié, afficher un chargement temporaire
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  height: '100vh', 
                  gap: 2 
                }}>
                  <CircularProgress size={60} />
                  <Typography variant="h6" color="text.secondary">
                    Chargement des données utilisateur...
                  </Typography>
                </Box>
              )
            )
          } 
        />
        </Routes>
      </UserUiPreferencesProvider>
    </CustomPermissionsProvider>
  );
};

export default App;