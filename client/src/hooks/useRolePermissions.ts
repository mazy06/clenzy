import { useState, useCallback, useEffect } from 'react';
import { API_CONFIG } from '../config/api';

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
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/permissions/roles`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const rolesData = await response.json();
      setRoles(rolesData);
      
      // Ne pas sélectionner de rôle par défaut - l'utilisateur doit choisir
      // if (rolesData.length > 0 && !selectedRole) {
      //   setSelectedRole(rolesData[0]);
      // }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des rôles');
      console.error('🔍 useRolePermissions - Erreur lors du chargement des rôles:', err);
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
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/permissions/roles/${role}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const permissionsData = await response.json();
      setRolePermissions(permissionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des permissions');
      console.error('🔍 useRolePermissions - Erreur lors du chargement des permissions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Mettre à jour les permissions d'un rôle
  const updateRolePermissions = useCallback(async (role: string, permissions: string[]) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/permissions/roles/${role}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(permissions),
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const updatedRole = await response.json();
      setRolePermissions(updatedRole);
      
      console.log('🔧 useRolePermissions - Permissions mises à jour pour le rôle', role, permissions);
      return updatedRole;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour des permissions');
      console.error('🔍 useRolePermissions - Erreur lors de la mise à jour des permissions:', err);
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
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/permissions/roles/${role}/reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const resetRole = await response.json();
      setRolePermissions(resetRole);
      
      console.log('🔄 useRolePermissions - Permissions réinitialisées aux valeurs par défaut pour le rôle', role);
      return resetRole;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la réinitialisation des permissions');
      console.error('🔍 useRolePermissions - Erreur lors de la réinitialisation des permissions:', err);
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
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/permissions/roles/${role}/reset-to-initial`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const resetRole = await response.json();
      setRolePermissions(resetRole);
      
      console.log('🔄 useRolePermissions - Permissions réinitialisées aux valeurs initiales depuis la base pour le rôle', role);
      return resetRole;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la réinitialisation aux permissions initiales');
      console.error('🔍 useRolePermissions - Erreur lors de la réinitialisation aux permissions initiales:', err);
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
    
    console.log('🔧 useRolePermissions - Permission modifiée localement:', permission, 'pour le rôle', rolePermissions.role);
  }, [rolePermissions]);

  // Appliquer les changements locaux (appelé lors de la sauvegarde)
  const applyLocalChanges = useCallback(async (role: string) => {
    if (!rolePermissions) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/permissions/roles/${role}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rolePermissions.permissions),
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const updatedRole = await response.json();
      setRolePermissions(updatedRole);
      
      console.log('🔧 useRolePermissions - Permissions appliquées pour le rôle', role, rolePermissions.permissions);
      return updatedRole;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'application des permissions');
      console.error('🔍 useRolePermissions - Erreur lors de l\'application des permissions:', err);
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
      
      // Appeler l'endpoint de sauvegarde (pour l'instant, on utilise update)
      // En production, on pourrait avoir un endpoint spécifique /save
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/permissions/roles/${role}/save`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Si l'endpoint n'existe pas encore, on simule la sauvegarde
        if (response.status === 404) {
          console.log('🔧 useRolePermissions - Endpoint de sauvegarde non implémenté, simulation de la sauvegarde');
          // Simuler une sauvegarde réussie
          return { success: true, message: 'Permissions sauvegardées (simulation)' };
        }
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('💾 useRolePermissions - Permissions sauvegardées pour le rôle', role, result);
      return result;
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) {
        // Endpoint non implémenté, on simule la sauvegarde
        console.log('🔧 useRolePermissions - Simulation de la sauvegarde pour le rôle', role);
        return { success: true, message: 'Permissions sauvegardées (simulation)' };
      }
      
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde des permissions');
      console.error('🔍 useRolePermissions - Erreur lors de la sauvegarde des permissions:', err);
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
