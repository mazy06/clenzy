import { useCallback } from 'react';
import { permissionsApi } from '../services/api';

export const usePermissionRefresh = () => {
  // Fonction pour rafraîchir les permissions d'un utilisateur
  const refreshUserPermissions = useCallback(async (role: string): Promise<string[]> => {
    const permissions = await permissionsApi.getByRole(role);
    return permissions;
  }, []);

  // Fonction pour déclencher un événement de rafraîchissement global
  const triggerGlobalRefresh = useCallback(() => {
    // Déclencher un événement personnalisé pour notifier tous les composants
    window.dispatchEvent(new CustomEvent('permissions-refreshed'));
  }, []);

  return {
    refreshUserPermissions,
    triggerGlobalRefresh,
  };
};
