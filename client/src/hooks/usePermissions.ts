import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { useCustomPermissions } from './useCustomPermissions';

export const usePermissions = () => {
  const { user, hasPermissionAsync: authHasPermissionAsync, hasRole: authHasRole } = useAuth();
  const { isCustomMode, hasCustomPermission } = useCustomPermissions();

  // Fonction de vérification des permissions qui prend en compte les permissions personnalisées
  const hasPermission = useCallback(async (permission: string): Promise<boolean> => {
    if (!user) return false;
    
    // Si le mode personnalisé est activé, utiliser les permissions personnalisées
    if (isCustomMode && user.roles.length > 0) {
      const userRole = user.roles[0];
      return hasCustomPermission(userRole, permission);
    }
    
    // Sinon, utiliser les permissions normales
    return await authHasPermissionAsync(permission);
  }, [user, isCustomMode, hasCustomPermission, authHasPermissionAsync]);

  // Fonction de vérification des rôles qui prend en compte les permissions personnalisées
  const hasRole = useCallback((role: string): boolean => {
    if (!user) return false;
    
    // Si le mode personnalisé est activé, on peut simuler n'importe quel rôle
    if (isCustomMode) {
      // Pour l'instant, on garde la logique normale des rôles
      // Mais on pourrait ajouter une logique de simulation ici
      return authHasRole(role);
    }
    
    // Sinon, utiliser les rôles normaux
    return authHasRole(role);
  }, [user, isCustomMode, authHasRole]);

  // Fonction pour vérifier si l'utilisateur a au moins un des rôles spécifiés
  const hasAnyRole = useCallback((roles: string[]): boolean => {
    if (!user) return false;
    return roles.some(role => hasRole(role));
  }, [user, hasRole]);

  // Fonctions de vérification de rôles spécifiques
  const isAdmin = useCallback((): boolean => hasRole('ADMIN'), [hasRole]);
  const isManager = useCallback((): boolean => hasRole('MANAGER'), [hasRole]);
  const isHost = useCallback((): boolean => hasRole('HOST'), [hasRole]);
  const isTechnician = useCallback((): boolean => hasRole('TECHNICIAN'), [hasRole]);
  const isHousekeeper = useCallback((): boolean => hasRole('HOUSEKEEPER'), [hasRole]);
  const isSupervisor = useCallback((): boolean => hasRole('SUPERVISOR'), [hasRole]);

  return {
    user,
    hasPermission,
    hasRole,
    hasAnyRole,
    isAdmin,
    isManager,
    isHost,
    isTechnician,
    isHousekeeper,
    isSupervisor,
    isCustomMode,
  };
};
