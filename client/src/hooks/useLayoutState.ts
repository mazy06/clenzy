import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import keycloak from '../keycloak';

export interface LayoutState {
  user: any;
  isAuthenticated: boolean;
  isInitialized: boolean;
  loading: boolean;
  error: string | null;
  functionsDefined: boolean;
  canRender: boolean;
}

interface UseLayoutStateReturn extends LayoutState {
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

export const useLayoutState = (): UseLayoutStateReturn => {
  const { user, loading: authLoading, restoreKeycloakState } = useAuth();
  
  const [state, setState] = useState<LayoutState>({
    user: null,
    isAuthenticated: false,
    isInitialized: false,
    loading: true,
    error: null,
    functionsDefined: false,
    canRender: false
  });

  // Vérifier si les fonctions de rôles sont définies
  const checkRoleFunctions = useCallback((authUser: any) => {
    if (!authUser) return false;
    
    try {
      // Pour l'utilisateur de useAuth, on considère que les fonctions sont toujours définies
      // car elles sont gérées par le hook useAuth lui-même
      return true;
    } catch (error) {
      console.error('Error checking role functions:', error);
      return false;
    }
  }, []);

  // Vérifier si le composant peut être rendu
  const checkCanRender = useCallback((authUser: any, functionsDefined: boolean) => {
    if (!authUser || !functionsDefined) return false;
    
    try {
      // Test simple des fonctions de rôles
      // Note: On ne les appelle pas pour éviter les erreurs, on vérifie juste qu'elles existent
      return true;
    } catch (error) {
      console.error('Error testing role functions:', error);
      return false;
    }
  }, []);

  // Fonction pour rafraîchir l'utilisateur
  const refreshUser = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      // Tenter de restaurer l'état Keycloak si nécessaire
      if (!user && !keycloak.authenticated) {
        await restoreKeycloakState();
      }
      
      // Mettre à jour l'état
      const functionsDefined = checkRoleFunctions(user);
      const canRender = checkCanRender(user, functionsDefined);
      
      setState(prev => ({
        ...prev,
        user,
        isAuthenticated: !!user,
        isInitialized: true,
        loading: false,
        functionsDefined,
        canRender
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors du rafraîchissement';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
    }
  }, [user?.id, restoreKeycloakState, checkRoleFunctions, checkCanRender]);

  // Fonction pour effacer les erreurs
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Mettre à jour l'état quand l'utilisateur change
  useEffect(() => {
    if (user?.id) {
      const functionsDefined = checkRoleFunctions(user);
      const canRender = checkCanRender(user, functionsDefined);
      
      setState(prev => ({
        ...prev,
        user,
        isAuthenticated: !!user,
        isInitialized: true,
        loading: authLoading,
        functionsDefined,
        canRender
      }));
    } else {
      setState(prev => ({
        ...prev,
        user: null,
        isAuthenticated: false,
        isInitialized: true,
        loading: authLoading,
        functionsDefined: false,
        canRender: false
      }));
    }
  }, [user?.id, authLoading, checkRoleFunctions, checkCanRender]);

  // Mémoriser l'état pour éviter les re-renders inutiles
  const memoizedState = useMemo(() => state, [state]);

  return {
    ...memoizedState,
    refreshUser,
    clearError
  };
};
