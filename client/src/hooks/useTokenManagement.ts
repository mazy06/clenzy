import { useState, useEffect, useCallback, useRef } from 'react';
import TokenService, { TokenValidationResult } from '../services/TokenService';

interface TokenManagementState {
  isTokenValid: boolean;
  timeUntilExpiry: number;
  isLoading: boolean;
  error: string | null;
}

interface TokenManagementActions {
  validateToken: () => Promise<void>;
  refreshToken: () => Promise<void>;
  resetTokenService: () => void;
  getTokenStats: () => Promise<any>;
}

export const useTokenManagement = (): TokenManagementState & TokenManagementActions => {
  const [state, setState] = useState<TokenManagementState>({
    isTokenValid: false,
    timeUntilExpiry: 0,
    isLoading: false,
    error: null
  });

  const tokenService = useRef(new TokenService());
  const validationInterval = useRef<number | null>(null);

  // Validation automatique du token
  const validateToken = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const tokenInfo = tokenService.current.getCurrentTokenInfo();
      
      if (tokenInfo && tokenInfo.isValid) {
        setState(prev => ({
          ...prev,
          isTokenValid: true,
          timeUntilExpiry: tokenInfo.timeUntilExpiry || 0,
          isLoading: false
        }));
      } else {
        setState(prev => ({
          ...prev,
          isTokenValid: false,
          timeUntilExpiry: 0,
          isLoading: false
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erreur de validation du token',
        isLoading: false
      }));
    }
  }, []);

  // Rafraîchissement du token
  const refreshToken = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const result = await tokenService.current.refreshToken();
      
      if (result.success) {
        await validateToken(); // Revalider après rafraîchissement
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || 'Échec du rafraîchissement du token',
          isLoading: false
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erreur lors du rafraîchissement',
        isLoading: false
      }));
    }
  }, [validateToken]);

  // Réinitialisation du service
  const resetTokenService = useCallback(() => {
    // Nettoyer le localStorage
    localStorage.removeItem('clenzy_token');
    localStorage.removeItem('clenzy_refresh_token');
    localStorage.removeItem('clenzy_token_expiry');
    
    setState({
      isTokenValid: false,
      timeUntilExpiry: 0,
      isLoading: false,
      error: null
    });
  }, []);

  // Récupération des statistiques des tokens
  const getTokenStats = useCallback(async () => {
    try {
      return await tokenService.current.getCurrentTokenInfo();
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      return null;
    }
  }, []);

  // Configuration de la validation automatique
  useEffect(() => {
    // Validation initiale
    validateToken();

    // Configuration de la validation périodique (toutes les 30 secondes)
    validationInterval.current = window.setInterval(() => {
      validateToken();
    }, 30000);

    // Nettoyage à la destruction du composant
    return () => {
      if (validationInterval.current) {
        clearInterval(validationInterval.current);
      }
    };
  }, [validateToken]);

  // Validation automatique quand le token approche de l'expiration
  useEffect(() => {
    if (state.timeUntilExpiry > 0 && state.timeUntilExpiry <= 300) { // 5 minutes avant expiration
      refreshToken();
    }
  }, [state.timeUntilExpiry, refreshToken]);

  return {
    ...state,
    validateToken,
    refreshToken,
    resetTokenService,
    getTokenStats
  };
};
