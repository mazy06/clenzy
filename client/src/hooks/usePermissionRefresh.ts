import { useCallback } from 'react';
import { API_CONFIG } from '../config/api';

export const usePermissionRefresh = () => {
  // Fonction pour rafraîchir les permissions d'un utilisateur
  const refreshUserPermissions = useCallback(async (role: string): Promise<string[]> => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/permissions/user/${role}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const permissions = await response.json();
      console.log('🔧 usePermissionRefresh - Permissions rafraîchies pour le rôle', role, permissions);
      return permissions;
    } catch (error) {
      console.error('🔍 usePermissionRefresh - Erreur lors du rafraîchissement des permissions:', error);
      throw error;
    }
  }, []);

  // Fonction pour déclencher un événement de rafraîchissement global
  const triggerGlobalRefresh = useCallback(() => {
    // Déclencher un événement personnalisé pour notifier tous les composants
    window.dispatchEvent(new CustomEvent('permissions-refreshed'));
    console.log('🔧 usePermissionRefresh - Événement de rafraîchissement global déclenché');
  }, []);

  return {
    refreshUserPermissions,
    triggerGlobalRefresh,
  };
};
