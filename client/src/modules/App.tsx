import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import keycloak from '../keycloak';
import { useAuth } from '../hooks/useAuth';
import { useTokenManagement } from '../hooks/useTokenManagement';
import { configureConsole } from '../config/console';
import { CustomPermissionsProvider } from '../hooks/useCustomPermissions';
import Login from './auth/Login';
import MainLayoutFull from './layout/MainLayoutFull';
import AuthenticatedApp from './AuthenticatedApp';

const App: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [authenticated, setAuthenticated] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const navigate = useNavigate();

  // Refs pour les fonctions de token management
  const stopTokenMonitoringRef = useRef<(() => void) | null>(null);
  const resetTokenServiceRef = useRef<(() => void) | null>(null);

  // Configurer la console pour filtrer les erreurs d'extensions
  useEffect(() => {
    configureConsole();
  }, []);

  // Gestion de la déconnexion globale
  const handleGlobalLogout = useCallback(() => {
    console.log('🔍 App - Déconnexion globale demandée');
    
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
    localStorage.removeItem('kc_access_token');
    localStorage.removeItem('kc_refresh_token');
    localStorage.removeItem('kc_id_token');
    localStorage.removeItem('kc_expires_in');
    
    // Rediriger vers la page de connexion immédiatement
    console.log('🔍 App - Redirection vers /login...');
    navigate('/login', { replace: true });
    
    // Fallback : si la navigation échoue, forcer le rechargement
    setTimeout(() => {
      if (window.location.pathname !== '/login') {
        console.log('🔍 App - Fallback: rechargement forcé vers /login');
        window.location.href = '/login';
      }
    }, 100);
  }, [navigate]);

  // Callbacks pour la gestion des tokens
  const handleTokenRefresh = useCallback((result: any) => {
    console.log('🔍 App - Token rafraîchi avec succès:', result);
  }, []);

  const handleTokenExpired = useCallback(() => {
    console.log('🔍 App - Token expiré, déconnexion...');
    handleGlobalLogout();
  }, [handleGlobalLogout]);

  const handleMaxRetriesExceeded = useCallback(() => {
    console.log('🔍 App - Nombre maximum de tentatives atteint, déconnexion...');
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
      console.log('TokenService - Réinitialisation automatique');
    };
  }, []);

  // Gestion des événements Keycloak
  useEffect(() => {
    const handleAuthLogout = () => {
      console.log('🔍 App - Déconnexion Keycloak détectée');
      handleGlobalLogout();
    };

    const handleCustomAuthSuccess = () => {
      console.log('🔍 App - Événement d\'authentification personnalisé reçu');
      setAuthenticated(true);
      checkTokenHealth();
      
      // Forcer la mise à jour de l'état Keycloak
      if (keycloak) {
        keycloak.authenticated = true;
        console.log('🔍 App - État Keycloak mis à jour:', keycloak.authenticated);
      }
      
      // Forcer le rechargement des informations utilisateur
      // en déclenchant un événement personnalisé
      window.dispatchEvent(new CustomEvent('force-user-reload'));
    };

    const handleCustomAuthLogout = () => {
      console.log('🔍 App - Événement de déconnexion personnalisé reçu');
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
          console.log('🔍 App - Initialisation de Keycloak...');
          
          if (keycloak.authenticated) {
            console.log('🔍 App - Keycloak déjà initialisé, état:', keycloak.authenticated);
            setAuthenticated(true);
            setInitialized(true);
            
            // Vérifier la santé du token
            checkTokenHealth();
            
            // Sauvegarder les tokens en localStorage
            if (keycloak.token) {
              localStorage.setItem('kc_access_token', keycloak.token);
            }
            if (keycloak.refreshToken) {
              localStorage.setItem('kc_refresh_token', keycloak.refreshToken);
            }
          } else {
            console.log('🔍 App - Keycloak non authentifié');
            setInitialized(true);
            setAuthenticated(false);
          }
        } catch (error) {
          console.error('🔍 App - Erreur lors de l\'initialisation de Keycloak:', error);
          setInitialized(true);
          setAuthenticated(false);
        }
      };

      initKeycloak();
    }
  }, [initialized, checkTokenHealth]);

  // Affichage du composant de chargement
  if (!initialized || authLoading) {
    console.log('🔍 App - Affichage du composant de chargement');
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

  console.log('🔍 App - Rendu de l\'application, état:', { initialized, authenticated, user: !!user });

  // Rendu de l'application avec routage
  console.log('🔍 App - Rendu de l\'application avec routage');
  
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