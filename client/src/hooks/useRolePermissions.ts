import { useState, useCallback, useEffect } from 'react';
import { permissionsApi } from '../services/api/permissionsApi';
import type { ApiError } from '../services/apiClient';
import PermissionSyncService from '../services/PermissionSyncService';
// Hors composant : la langue se lit a l'appel, pas au chargement du module.
import i18n from '../i18n/config';

export interface RolePermissions {
  role: string;
  permissions: string[];
  isDefault: boolean;
}

export const useRolePermissions = () => {
  const [roles, setRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [rolePermissions, setRolePermissions] = useState<RolePermissions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger tous les rôles disponibles
  const loadRoles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const rolesData = await permissionsApi.getAllRoles();
      setRoles(rolesData);

      // Ne pas sélectionner de rôle par défaut - l'utilisateur doit choisir
      // if (rolesData.length > 0 && !selectedRole) {
      //   setSelectedRole(rolesData[0]);
      // }
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t('permissions.errors.loadRoles'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger les permissions d'un rôle spécifique
  const loadRolePermissions = useCallback(async (role: string) => {
    if (!role) return;

    try {
      setLoading(true);
      setError(null);

      const permissionsData = await permissionsApi.getRolePermissions(role);
      setRolePermissions(permissionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t('permissions.errors.loadPermissions'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Mettre à jour les permissions d'un rôle
  const updateRolePermissions = useCallback(async (role: string, permissions: string[]) => {
    try {
      setLoading(true);
      setError(null);

      const updatedRole = await permissionsApi.updateRole(role, permissions);
      setRolePermissions(updatedRole);

      return updatedRole;
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t('permissions.errors.updatePermissions'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Réinitialiser les permissions d'un rôle aux valeurs par défaut
  const resetRolePermissions = useCallback(async (role: string) => {
    try {
      setLoading(true);
      setError(null);

      const resetRole = await permissionsApi.resetRole(role);
      setRolePermissions(resetRole);

      return resetRole;
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t('permissions.errors.resetPermissions'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Réinitialiser aux permissions initiales depuis la base de données
  const resetToInitialPermissions = useCallback(async (role: string) => {
    try {
      setLoading(true);
      setError(null);

      const resetRole = await permissionsApi.resetRoleToInitial(role);
      setRolePermissions(resetRole);

      return resetRole;
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t('permissions.errors.resetInitial'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Activer/désactiver une permission (modification locale uniquement)
  const togglePermission = useCallback((permission: string) => {
    if (!rolePermissions) return;

    const currentPermissions = rolePermissions.permissions;
    let newPermissions: string[];

    if (currentPermissions.includes(permission)) {
      // Désactiver la permission
      newPermissions = currentPermissions.filter(p => p !== permission);
    } else {
      // Activer la permission
      newPermissions = [...currentPermissions, permission];
    }

    // Mise à jour locale uniquement, pas d'appel API
    setRolePermissions({
      ...rolePermissions,
      permissions: newPermissions,
      isDefault: false // Marquer comme modifié
    });

  }, [rolePermissions]);

  // Appliquer les changements locaux (appelé lors de la sauvegarde)
  const applyLocalChanges = useCallback(async (role: string) => {
    if (!rolePermissions) return;

    try {
      setLoading(true);
      setError(null);

      const updatedRole = await permissionsApi.updateRole(role, rolePermissions.permissions);
      setRolePermissions(updatedRole);

      return updatedRole;
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t('permissions.errors.applyPermissions'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [rolePermissions]);

  // Sauvegarder les permissions d'un rôle (persistance en base)
  const saveRolePermissions = useCallback(async (role: string) => {
    try {
      setLoading(true);
      setError(null);

      let result: unknown;
      try {
        // Appeler l'endpoint de sauvegarde (pour l'instant, on utilise update)
        // En production, on pourrait avoir un endpoint spécifique /save
        result = await permissionsApi.saveRole(role, []);
      } catch (saveErr: unknown) {
        // Si l'endpoint n'existe pas encore, on simule la sauvegarde
        if (typeof saveErr === 'object' && saveErr !== null && 'status' in saveErr && (saveErr as ApiError).status === 404) {
          // Déclencher la synchronisation même en mode simulation
          try {
            const permissionSyncService = PermissionSyncService.getInstance();
            await permissionSyncService.syncAfterPermissionUpdate();
          } catch (syncError) {
          }

          // Simuler une sauvegarde réussie
          return { success: true, message: i18n.t('permissions.savedSimulated') };
        }
        throw saveErr;
      }

      // Déclencher la synchronisation des permissions pour tous les utilisateurs
      try {
        const permissionSyncService = PermissionSyncService.getInstance();
        await permissionSyncService.syncAfterPermissionUpdate();
      } catch (syncError) {
        // Ne pas faire échouer la sauvegarde à cause de la synchronisation
      }

      return result;
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) {
        // Endpoint non implémenté, on simule la sauvegarde
        return { success: true, message: i18n.t('permissions.savedSimulated') };
      }

      setError(err instanceof Error ? err.message : i18n.t('permissions.errors.savePermissions'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger les rôles au montage du composant
  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // Charger les permissions quand le rôle sélectionné change
  useEffect(() => {
    if (selectedRole) {
      loadRolePermissions(selectedRole);
    }
  }, [selectedRole, loadRolePermissions]);

  return {
    roles,
    selectedRole,
    setSelectedRole,
    rolePermissions,
    loading,
    error,
    togglePermission,
    updateRolePermissions,
    resetRolePermissions,
    resetToInitialPermissions,
    saveRolePermissions,
    loadRoles,
    loadRolePermissions,
    applyLocalChanges,
  };
};
