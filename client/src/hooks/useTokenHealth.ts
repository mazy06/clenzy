import { useState, useEffect, useCallback } from 'react';
import TokenService from '../services/TokenService';

export interface TokenHealthStatus {
  isHealthy: boolean;
  status: 'healthy' | 'expiring' | 'expired' | 'error';
  timeUntilExpiry?: number;
  lastCheck: Date;
}

export const useTokenHealth = () => {
  const [tokenStatus, setTokenStatus] = useState<TokenHealthStatus>({
    isHealthy: false,
    status: 'error',
    lastCheck: new Date()
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fonction pour mettre à jour le statut
  const updateTokenStatus = useCallback(async () => {
    try {
      if (!isInitialized) return;
      
      setIsLoading(true);
      const tokenService = TokenService.getInstance();
      const healthInfo = await tokenService.manualHealthCheck();
      
      setTokenStatus({
        isHealthy: healthInfo.isHealthy,
        status: healthInfo.status,
        timeUntilExpiry: healthInfo.timeUntilExpiry,
        lastCheck: new Date()
      });
    } catch (error) {
      console.error('useTokenHealth - Erreur lors de la vérification:', error);
      setTokenStatus({
        isHealthy: false,
        status: 'error',
        lastCheck: new Date()
      });
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

  // Fonction pour forcer une vérification
  const forceCheck = useCallback(async () => {
    await updateTokenStatus();
  }, [updateTokenStatus]);

  // Initialisation du service
  useEffect(() => {
    const initializeService = async () => {
      try {
        const tokenService = TokenService.getInstance();
        await tokenService.initialize();
        setIsInitialized(true);
      } catch (error) {
        console.error('useTokenHealth - Erreur lors de l\'initialisation:', error);
        setIsInitialized(false);
      }
    };

    initializeService();
  }, []);

  // Configuration des listeners une fois initialisé
  useEffect(() => {
    if (!isInitialized) return;

    const tokenService = TokenService.getInstance();
    
    // Vérification initiale
    updateTokenStatus();
    
    // Écouter les événements de token
    const handleTokenExpiring = (data: any) => {
      console.log('useTokenHealth - Token expirant dans', data.timeUntilExpiry, 'secondes');
      setTokenStatus(prev => ({
        ...prev,
        status: 'expiring',
        timeUntilExpiry: data.timeUntilExpiry,
        lastCheck: new Date()
      }));
    };
    
    const handleTokenExpired = () => {
      console.log('useTokenHealth - Token expiré');
      setTokenStatus(prev => ({
        ...prev,
        status: 'expired',
        isHealthy: false,
        lastCheck: new Date()
      }));
    };
    
    const handleTokenRefreshed = () => {
      console.log('useTokenHealth - Token rafraîchi');
      setTokenStatus(prev => ({
        ...prev,
        status: 'healthy',
        isHealthy: true,
        lastCheck: new Date()
      }));
    };
    
    const handleAuthFailed = (data: any) => {
      console.error('useTokenHealth - Échec d\'authentification:', data.error);
      setTokenStatus(prev => ({
        ...prev,
        status: 'error',
        isHealthy: false,
        lastCheck: new Date()
      }));
    };
    
    const handleAuthChanged = (data: any) => {
      console.log('useTokenHealth - Changement d\'authentification:', data);
      updateTokenStatus();
    };
    
    // S'abonner aux événements
    tokenService.on('token-expiring', handleTokenExpiring);
    tokenService.on('token-expired', handleTokenExpired);
    tokenService.on('token-refreshed', handleTokenRefreshed);
    tokenService.on('auth-failed', handleAuthFailed);
    tokenService.on('auth-changed', handleAuthChanged);
    
    // Cleanup des listeners
    return () => {
      tokenService.off('token-expiring', handleTokenExpiring);
      tokenService.off('token-expired', handleTokenExpired);
      tokenService.off('token-refreshed', handleTokenRefreshed);
      tokenService.off('auth-failed', handleAuthFailed);
      tokenService.off('auth-changed', handleAuthChanged);
    };
  }, [isInitialized, updateTokenStatus]);

  // Vérification périodique légère (seulement pour l'UI)
  useEffect(() => {
    if (!isInitialized) return;
    
    const interval = setInterval(() => {
      // Mettre à jour seulement si le token est proche de l'expiration
      if (tokenStatus.status === 'expiring' && tokenStatus.timeUntilExpiry && tokenStatus.timeUntilExpiry <= 30) {
        updateTokenStatus();
      }
    }, 10000); // Vérifier toutes les 10 secondes si nécessaire

    return () => clearInterval(interval);
  }, [isInitialized, tokenStatus.status, tokenStatus.timeUntilExpiry, updateTokenStatus]);

  return {
    ...tokenStatus,
    isLoading,
    forceCheck,
    // Utilitaires
    isExpiringSoon: tokenStatus.status === 'expiring' && tokenStatus.timeUntilExpiry && tokenStatus.timeUntilExpiry <= 30,
    isCritical: tokenStatus.status === 'expiring' && tokenStatus.timeUntilExpiry && tokenStatus.timeUntilExpiry <= 10,
    timeUntilExpiryFormatted: tokenStatus.timeUntilExpiry 
      ? `${Math.floor(tokenStatus.timeUntilExpiry / 60)}m ${tokenStatus.timeUntilExpiry % 60}s`
      : undefined
  };
};
