import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import keycloak from '../keycloak';
import { useAuth } from '../hooks/useAuth';
import { useTokenManagement } from '../hooks/useTokenManagement';
import { configureConsole } from '../config/console';
import { CustomPermissionsProvider } from '../hooks/useCustomPermissions';
import Login from './auth/Login';
import Inscription from './auth/Inscription';
import Support from './auth/Support';
import AcceptInvitationPage from './invitations/AcceptInvitationPage';
import MainLayoutFull from './layout/MainLayoutFull';
import AuthenticatedApp from './AuthenticatedApp';
import { clearTokens, setItem, STORAGE_KEYS } from '../services/storageService';

// Routes publiques accessibles sans authentification
const PUBLIC_ROUTES = ['/login', '/inscription', '/support', '/accept-invitation'];

const App: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [authenticated, setAuthenticated] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Déterminer si on est sur une route publique
  const isPublicRoute = PUBLIC_ROUTES.includes(location.pathname);

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
    
    // Rediriger vers la page de connexion immédiatement
    navigate('/login', { replace: true });
    
    // Fallback : si la navigation échoue, forcer le rechargement
    setTimeout(() => {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }, 100);
  }, [navigate]);

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
            
            // Sauvegarder les tokens en localStorage
            if (keycloak.token) {
              setItem(STORAGE_KEYS.ACCESS_TOKEN, keycloak.token);
            }
            if (keycloak.refreshToken) {
              setItem(STORAGE_KEYS.REFRESH_TOKEN, keycloak.refreshToken);
            }
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
        <Routes>
          {/* Route publique pour le login */}
          <Route
            path="/login"
            element={
              !authenticated || !keycloak.authenticated ? (
                <Login />
              ) : (
                <Navigate to="/dashboard" replace />
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
                <Navigate to="/dashboard" replace />
              )
            }
          />

          {/* Route publique pour le support */}
          <Route path="/support" element={<Support />} />

          {/* Route publique/semi-publique pour accepter une invitation */}
          <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        
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
    </CustomPermissionsProvider>
  );
};

export default App;