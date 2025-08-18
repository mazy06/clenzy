import { useEffect, useRef, useCallback } from 'react';
import tokenService, { TokenValidationResult, RefreshResult } from '../services/TokenService';
import keycloak from '../keycloak';

export interface UseTokenManagementOptions {
  checkInterval?: number; // Intervalle de vérification en ms
  refreshThreshold?: number; // Seuil de rafraîchissement en secondes
  maxRetries?: number; // Nombre maximum de tentatives
  onTokenRefresh?: (result: RefreshResult) => void;
  onTokenExpired?: () => void;
  onMaxRetriesExceeded?: () => void;
}

export const useTokenManagement = (options: UseTokenManagementOptions = {}) => {
  const {
    checkInterval = 60000, // 1 minute par défaut
    refreshThreshold = 300, // 5 minutes par défaut
    maxRetries = 3,
    onTokenRefresh,
    onTokenExpired,
    onMaxRetriesExceeded,
  } = options;

  const intervalRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);

  // Fonction de vérification et rafraîchissement des tokens
  const checkAndRefreshTokens = useCallback(async () => {
    if (isProcessingRef.current) {
      console.log('🔍 useTokenManagement - Vérification déjà en cours, ignorée');
      return;
    }

    isProcessingRef.current = true;

    try {
      const storedToken = localStorage.getItem('kc_access_token');
      const storedRefreshToken = localStorage.getItem('kc_refresh_token');

      if (!storedToken || !storedRefreshToken) {
        console.log('🔍 useTokenManagement - Tokens manquants');
        isProcessingRef.current = false;
        return;
      }

      // Valider le token
      const validation = tokenService.validateToken(storedToken);
      console.log('🔍 useTokenManagement - Validation token:', validation);

      if (!validation.isValid) {
        console.log('🔍 useTokenManagement - Token invalide, déconnexion...');
        onTokenExpired?.();
        isProcessingRef.current = false;
        return;
      }

      // Vérifier si le rafraîchissement est nécessaire
      if (validation.needsRefresh) {
        console.log('🔍 useTokenManagement - Rafraîchissement nécessaire');
        
        const refreshResult = await tokenService.refreshToken();
        console.log('🔍 useTokenManagement - Résultat rafraîchissement:', refreshResult);

        if (refreshResult.success) {
          // Mettre à jour localStorage
          if (refreshResult.newToken) {
            localStorage.setItem('kc_access_token', refreshResult.newToken);
          }
          if (refreshResult.newRefreshToken) {
            localStorage.setItem('kc_refresh_token', refreshResult.newRefreshToken);
          }

          onTokenRefresh?.(refreshResult);
          console.log('🔍 useTokenManagement - Tokens mis à jour avec succès');
        } else {
          // Analyser l'erreur pour déterminer la stratégie
          if (refreshResult.error === 'Max retries exceeded') {
            console.log('🔍 useTokenManagement - Nombre maximum de tentatives atteint');
            onMaxRetriesExceeded?.();
          } else if (tokenService.shouldAttemptReconnection(refreshResult.error || '')) {
            console.log('🔍 useTokenManagement - Tentative de reconnexion...');
            const reconnected = await tokenService.attemptReconnection();
            
            if (reconnected) {
              // Mettre à jour localStorage avec les nouveaux tokens
              localStorage.setItem('kc_access_token', keycloak.token || '');
              localStorage.setItem('kc_refresh_token', keycloak.refreshToken || '');
              console.log('🔍 useTokenManagement - Reconnexion réussie');
            } else {
              console.log('🔍 useTokenManagement - Échec de la reconnexion');
              onTokenExpired?.();
            }
          } else {
            console.log('🔍 useTokenManagement - Erreur non récupérable');
            onTokenExpired?.();
          }
        }
      } else {
        console.log('🔍 useTokenManagement - Token encore valide, pas de rafraîchissement nécessaire');
      }
    } catch (error) {
      console.error('🔍 useTokenManagement - Erreur lors de la vérification:', error);
    } finally {
      isProcessingRef.current = false;
    }
  }, [onTokenRefresh, onTokenExpired, onMaxRetriesExceeded]);

  // Démarrer la vérification périodique
  const startTokenMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    console.log(`🔍 useTokenManagement - Démarrage du monitoring (intervalle: ${checkInterval}ms)`);
    
    intervalRef.current = setInterval(checkAndRefreshTokens, checkInterval);
    
    // Première vérification immédiate
    checkAndRefreshTokens();
  }, [checkInterval, checkAndRefreshTokens]);

  // Arrêter la vérification périodique
  const stopTokenMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('🔍 useTokenManagement - Monitoring arrêté');
    }
  }, []);

  // Vérification manuelle des tokens
  const checkTokensManually = useCallback(() => {
    return checkAndRefreshTokens();
  }, [checkAndRefreshTokens]);

  // Reset du service
  const resetTokenService = useCallback(() => {
    tokenService.reset();
    console.log('🔍 useTokenManagement - Service reset');
  }, []);

  // Obtenir les statistiques
  const getTokenStats = useCallback(() => {
    return tokenService.getStats();
  }, []);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    startTokenMonitoring,
    stopTokenMonitoring,
    checkTokensManually,
    resetTokenService,
    getTokenStats,
    isProcessing: isProcessingRef.current,
  };
};
