import { useState, useEffect, useCallback } from 'react';
import TokenService, { TokenEventData } from '../services/TokenService';

export interface TokenManagementState {
  isRefreshing: boolean;
  lastRefresh: Date | null;
  refreshCount: number;
  error: string | null;
  tokenHealth: {
    isHealthy: boolean;
    timeUntilExpiry: number;
    status: 'healthy' | 'expiring' | 'expired' | 'error';
  };
}

export const useTokenManagement = () => {
  const [state, setState] = useState<TokenManagementState>({
    isRefreshing: false,
    lastRefresh: null,
    refreshCount: 0,
    error: null,
    tokenHealth: {
      isHealthy: false,
      timeUntilExpiry: 0,
      status: 'error'
    }
  });

  const tokenService = TokenService.getInstance();

  // Vérifier la santé du token
  const checkTokenHealth = useCallback(async () => {
    try {
      const healthInfo = await tokenService.manualHealthCheck();
      setState(prev => ({
        ...prev,
        tokenHealth: {
          isHealthy: healthInfo.isHealthy,
          timeUntilExpiry: healthInfo.timeUntilExpiry || 0,
          status: healthInfo.status
        },
        error: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Erreur lors de la vérification de la santé du token',
        tokenHealth: {
          isHealthy: false,
          timeUntilExpiry: 0,
          status: 'error'
        }
      }));
    }
  }, [tokenService]);

  // Rafraîchir le token
  const refreshToken = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isRefreshing: true, error: null }));

      const result = await tokenService.refreshTokenWithRetry();

      if (result) {
        setState(prev => ({
          ...prev,
          isRefreshing: false,
          lastRefresh: new Date(),
          refreshCount: prev.refreshCount + 1,
          error: null
        }));

        // Vérifier la santé après le rafraîchissement
        await checkTokenHealth();
      } else {
        setState(prev => ({
          ...prev,
          isRefreshing: false,
          error: 'Échec du rafraîchissement du token'
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        error: 'Erreur lors du rafraîchissement du token'
      }));
    }
  }, [tokenService, checkTokenHealth]);

  // Forcer une vérification de santé
  const forceHealthCheck = useCallback(async () => {
    await checkTokenHealth();
  }, [checkTokenHealth]);

  // Obtenir les informations du token actuel
  const getCurrentTokenInfo = useCallback(() => {
    return tokenService.getCurrentTokenInfo();
  }, [tokenService]);

  // Nettoyer les tokens expirés
  const cleanupExpiredTokens = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      const result = await tokenService.cleanupExpiredTokens();

      if (result.success) {
        // Vérifier la santé après le nettoyage
        await checkTokenHealth();
      } else {
        setState(prev => ({
          ...prev,
          error: `Erreur lors du nettoyage: ${result.error}`
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Erreur lors du nettoyage des tokens'
      }));
    }
  }, [tokenService, checkTokenHealth]);

  // Écouter les événements de token
  useEffect(() => {
    const handleTokenRefreshed = () => {
      setState(prev => ({
        ...prev,
        lastRefresh: new Date(),
        refreshCount: prev.refreshCount + 1,
        error: null
      }));
    };

    const handleTokenExpiring = (data?: TokenEventData) => {
      setState(prev => ({
        ...prev,
        tokenHealth: {
          ...prev.tokenHealth,
          status: 'expiring',
          timeUntilExpiry: data?.timeUntilExpiry || 0
        }
      }));
    };

    const handleTokenExpired = () => {
      setState(prev => ({
        ...prev,
        tokenHealth: {
          isHealthy: false,
          timeUntilExpiry: 0,
          status: 'expired'
        }
      }));
    };

    const handleAuthFailed = (data?: TokenEventData) => {
      setState(prev => ({
        ...prev,
        error: data?.error || 'Échec d\'authentification',
        tokenHealth: {
          isHealthy: false,
          timeUntilExpiry: 0,
          status: 'error'
        }
      }));
    };

    // S'abonner aux événements
    tokenService.on('token-refreshed', handleTokenRefreshed);
    tokenService.on('token-expiring', handleTokenExpiring);
    tokenService.on('token-expired', handleTokenExpired);
    tokenService.on('auth-failed', handleAuthFailed);

    // Vérification initiale
    checkTokenHealth();

    // Cleanup des listeners
    return () => {
      tokenService.off('token-refreshed', handleTokenRefreshed);
      tokenService.off('token-expiring', handleTokenExpiring);
      tokenService.off('token-expired', handleTokenExpired);
      tokenService.off('auth-failed', handleAuthFailed);
    };
  }, [tokenService, checkTokenHealth]);

  // Vérification périodique de la santé
  useEffect(() => {
    const interval = setInterval(() => {
      // Vérifier seulement si le token est proche de l'expiration
      if (state.tokenHealth.status === 'expiring' && state.tokenHealth.timeUntilExpiry <= 60) {
        checkTokenHealth();
      }
    }, 30000); // 30 secondes

    return () => clearInterval(interval);
  }, [state.tokenHealth.status, state.tokenHealth.timeUntilExpiry, checkTokenHealth]);

  return {
    ...state,
    refreshToken,
    checkTokenHealth,
    forceHealthCheck,
    getCurrentTokenInfo,
    cleanupExpiredTokens,
    // Utilitaires
    isExpiringSoon: state.tokenHealth.status === 'expiring' && state.tokenHealth.timeUntilExpiry <= 60,
    isCritical: state.tokenHealth.status === 'expiring' && state.tokenHealth.timeUntilExpiry <= 10,
    timeUntilExpiryFormatted: state.tokenHealth.timeUntilExpiry > 0
      ? `${Math.floor(state.tokenHealth.timeUntilExpiry / 60)}m ${state.tokenHealth.timeUntilExpiry % 60}s`
      : 'Expiré'
  };
};
