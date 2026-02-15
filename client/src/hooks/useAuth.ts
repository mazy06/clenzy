import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import keycloak from '../keycloak';
import { API_CONFIG } from '../config/api';
import { CustomPermissionsContext } from './useCustomPermissions';
import PermissionSyncService from '../services/PermissionSyncService';
import RedisCacheService from '../services/RedisCacheService';
import { getItem, clearTokens, STORAGE_KEYS } from '../services/storageService';

export interface UserRole {
  name: string;
  permissions: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  firstName?: string;  // Prénom métier
  lastName?: string;   // Nom métier
  fullName?: string;   // Nom complet métier
  roles: string[];
  permissions: string[];
  forfait?: string;    // Forfait abonnement: essentiel, confort, premium
}

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const permissionSyncService = PermissionSyncService.getInstance();
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const loadUserInfo = async () => {
      // Vérifier d'abord si on a des tokens en localStorage
      const storedToken = getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const storedRefreshToken = getItem(STORAGE_KEYS.REFRESH_TOKEN);

      // Vérifier d'abord l'état de Keycloak
      if (keycloak.authenticated && keycloak.token) {
        await loadUserFromKeycloak();
      } else if (storedToken && storedRefreshToken) {
        // Tenter de restaurer l'état Keycloak
        const restored = restoreKeycloakState();
        if (restored) {
          await loadUserFromKeycloak();
        } else {
          setUser(null);
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    };

    const loadUserFromKeycloak = async () => {
      try {
        // Récupérer les informations utilisateur depuis l'API avec fetch + keycloak.token
        const response = await fetch(API_CONFIG.ENDPOINTS.ME, {
          headers: {
            'Authorization': `Bearer ${keycloak.token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const userData = await response.json();
          console.log('useAuth - Données utilisateur reçues:', userData);

          // Utiliser directement les permissions depuis l'API
          const permissions = userData.permissions || [];

          // Extraire les rôles depuis realm_access (Keycloak) si le backend ne les retourne pas
          let roles: string[] = [];
          if (userData.role) {
            // Le backend retourne 'role' (singulier)
            roles = [userData.role];
          } else if (userData.realm_access && userData.realm_access.roles) {
            // Extraire depuis realm_access (Keycloak)
            roles = userData.realm_access.roles.filter((role: string) => role !== 'default-roles-clenzy' && role !== 'offline_access');
          }

          console.log('useAuth - Rôles extraits:', roles);
          console.log('useAuth - Permissions extraites:', permissions);

          // Créer l'objet utilisateur avec les permissions directes ET les données métier
          const user: AuthUser = {
            id: userData.subject || userData.id || 'unknown',
            email: userData.email || '',
            username: userData.preferred_username || userData.username || 'Utilisateur',
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            fullName: userData.fullName ||
                     `${userData.firstName || ''} ${userData.lastName || ''}`.trim() ||
                     userData.preferred_username || userData.username || 'Utilisateur',
            roles: Array.isArray(roles) ? roles : [roles].filter(Boolean),
            permissions: Array.isArray(permissions) ? permissions : [permissions].filter(Boolean),
            forfait: userData.forfait || undefined,
          };

          setUser(user);
          setLoading(false);

          // Initialiser le service de synchronisation des permissions
          permissionSyncService.initialize(user);

          // Forcer une synchronisation immédiate pour résoudre le problème d'accès
          try {
            console.log('useAuth - Synchronisation forcée immédiate au chargement');
            await permissionSyncService.syncNow();
          } catch (error) {
            console.warn('useAuth - Erreur lors de la synchronisation forcée:', error);
          }
        } else if (response.status === 400 || response.status === 401) {
          // Erreur 400/401, essayer de rafraîchir le token
          try {
            if (keycloak.refreshToken) {
              const refreshed = await keycloak.updateToken(30);
              if (refreshed) {
                await loadUserFromKeycloak();
                return;
              }
            }
          } catch (refreshError) {
            console.error('useAuth - Erreur lors du rafraîchissement du token:', refreshError);
          }

          setUser(null);
          setLoading(false);
        } else {
          console.error('useAuth - Erreur lors du chargement des données utilisateur:', response.status);
          setUser(null);
          setLoading(false);
        }
      } catch (error) {
        console.error('useAuth - Erreur lors du chargement des données utilisateur:', error);
        setUser(null);
        setLoading(false);
      }
    };

    // Charger les informations utilisateur immédiatement
    loadUserInfo();

    // Écouter les changements d'état de Keycloak
    const handleAuthSuccess = () => {
      loadUserInfo();
    };

    const handleAuthLogout = () => {
      setUser(null);
      setLoading(false);
    };

    // Écouter l'événement personnalisé de rechargement forcé
    const handleForceUserReload = () => {
      // Ajouter un délai pour éviter les appels trop fréquents
      setTimeout(() => {
        loadUserInfo();
      }, 100);
    };

    // Ajouter les écouteurs d'événements Keycloak
    keycloak.onAuthSuccess = handleAuthSuccess;
    keycloak.onAuthLogout = handleAuthLogout;

    // Ajouter l'écouteur d'événement personnalisé
    window.addEventListener('force-user-reload', handleForceUserReload);

        // Écouter les changements de permissions
    const handlePermissionsRefresh = () => {
      // Recharger les informations utilisateur pour obtenir les nouvelles permissions
      loadUserInfo();
    };

    // Écouter les mises à jour automatiques des permissions
    const handlePermissionsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (user && customEvent.detail.userId === user.id) {
        // Mettre à jour les permissions de l'utilisateur
        setUser(prevUser => prevUser ? {
          ...prevUser,
          permissions: customEvent.detail.permissions
        } : null);
      }
    };

    window.addEventListener('permissions-refreshed', handlePermissionsRefresh);
    window.addEventListener('permissions-updated', handlePermissionsUpdated);

    return () => {
      // Nettoyer les écouteurs
      keycloak.onAuthSuccess = undefined;
      keycloak.onAuthLogout = undefined;
      window.removeEventListener('force-user-reload', handleForceUserReload);
      window.removeEventListener('permissions-refreshed', handlePermissionsRefresh);
      window.removeEventListener('permissions-updated', handlePermissionsUpdated);

      // Arrêter le service de synchronisation
      permissionSyncService.shutdown();
    };
  }, []); // Dépendances vides avec useRef pour éviter les violations des règles des hooks

  // Fonction unique pour la vérification des permissions (appelle Redis directement)
  const hasPermissionAsync = useCallback(async (permission: string): Promise<boolean> => {
    // Attendre que l'utilisateur soit chargé
    if (loading) {
      return false;
    }

    if (!user) {
      return false;
    }

    // Vérifier d'abord dans les permissions de l'utilisateur chargées depuis l'API
    if (user.permissions && user.permissions.length > 0) {
      const hasPermission = user.permissions.includes(permission);
      if (hasPermission) {
        return true;
      }
    }

    try {
      // Toujours synchroniser depuis l'API pour avoir les dernières permissions
      const syncResponse = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/permissions/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!syncResponse.ok) {
        console.error('useAuth - Erreur lors de la synchronisation:', syncResponse.status);
        return false;
      }

      const syncData = await syncResponse.json();

      if (syncData.permissions && syncData.permissions.length > 0) {
        // Mettre à jour les permissions de l'utilisateur seulement si elles ont changé
        setUser(prevUser => {
          if (!prevUser) return null;
          // Éviter la mise à jour si les permissions sont identiques
          const currentPerms = prevUser.permissions || [];
          const newPerms = syncData.permissions || [];
          if (currentPerms.length === newPerms.length &&
              currentPerms.every((p: string) => newPerms.includes(p)) &&
              newPerms.every((p: string) => currentPerms.includes(p))) {
            return prevUser; // Pas de changement, retourner la même référence
          }
          return {
            ...prevUser,
            permissions: syncData.permissions
          };
        });

        const hasPermission = syncData.permissions.includes(permission);
        return hasPermission;
      }

      return false;
    } catch (error) {
      return false;
    }
  }, [user, loading]);

  const hasRole = useCallback((role: string): boolean => {
    if (!user) return false;

    // Fallback vers les rôles normaux
    return user.roles.includes(role);
  }, [user]);

  const hasAnyRole = useCallback((roles: string[]): boolean => {
    if (!user) return false;
    return roles.some(role => user.roles.includes(role));
  }, [user]);

  const isAdmin = useCallback((): boolean => hasRole('ADMIN'), [hasRole]);
  const isManager = useCallback((): boolean => hasRole('MANAGER'), [hasRole]);
  const isHost = useCallback((): boolean => hasRole('HOST'), [hasRole]);
  const isTechnician = useCallback((): boolean => hasRole('TECHNICIAN'), [hasRole]);
  const isHousekeeper = useCallback((): boolean => hasRole('HOUSEKEEPER'), [hasRole]);
  const isSupervisor = useCallback((): boolean => hasRole('SUPERVISOR'), [hasRole]);

  // Fonction pour nettoyer l'état utilisateur lors de la déconnexion
  // Fonction pour restaurer l'état Keycloak depuis le localStorage
  const restoreKeycloakState = useCallback(() => {
    const storedToken = getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const storedRefreshToken = getItem(STORAGE_KEYS.REFRESH_TOKEN);
    const storedIdToken = getItem(STORAGE_KEYS.ID_TOKEN);
    const storedExpiresIn = getItem(STORAGE_KEYS.EXPIRES_IN);

    if (storedToken && storedRefreshToken) {
      try {
        // Vérifier si le token est expiré
        const tokenData = JSON.parse(atob(storedToken.split('.')[1]));
        const currentTime = Math.floor(Date.now() / 1000);

        if (tokenData.exp && tokenData.exp < currentTime) {
          clearUser();
          return false;
        }

        // Restaurer l'état Keycloak
        keycloak.token = storedToken;
        keycloak.refreshToken = storedRefreshToken;
        keycloak.idToken = storedIdToken ?? undefined;
        keycloak.authenticated = true;

        // Restaurer tokenParsed si possible
        if (storedToken) {
          try {
            keycloak.tokenParsed = JSON.parse(atob(storedToken.split('.')[1]));
          } catch {
            // Token parsing failed silently
          }
        }

        return true;
      } catch (error) {
        clearUser();
        return false;
      }
    }

    return false;
  }, []);

  const clearUser = useCallback(() => {
    // Nettoyer l'état React
    setUser(null);
    setLoading(false);

    // Nettoyer l'état Keycloak
    keycloak.token = undefined;
    keycloak.refreshToken = undefined;
    keycloak.authenticated = false;
    keycloak.tokenParsed = undefined;

    // Nettoyer le localStorage
    clearTokens();
  }, []);

  return {
    user,
    loading,
    hasPermissionAsync, // Fonction pour vérifier les permissions en temps réel
    hasRole,
    hasAnyRole,
    isAdmin,
    isManager,
    isHost,
    isTechnician,
    isHousekeeper,
    isSupervisor,
    clearUser, // Exposer la fonction de nettoyage
    restoreKeycloakState, // Exposer la fonction de restauration
  };
};
