import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import keycloak from '../keycloak';
import { API_CONFIG } from '../config/api';
import { CustomPermissionsContext } from './useCustomPermissions';
import PermissionSyncService from '../services/PermissionSyncService';
import RedisCacheService from '../services/RedisCacheService';

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
      const storedToken = localStorage.getItem('kc_access_token');
      const storedRefreshToken = localStorage.getItem('kc_refresh_token');
      
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
        // Récupérer les informations utilisateur depuis l'API
        const response = await fetch(API_CONFIG.ENDPOINTS.ME, {
          headers: {
            'Authorization': `Bearer ${keycloak.token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const userData = await response.json();
          console.log('🔍 useAuth - Données utilisateur complètes reçues:', userData);
          console.log('🔍 useAuth - userData.role:', userData.role);
          console.log('🔍 useAuth - userData.realm_access:', userData.realm_access);
          console.log('🔍 useAuth - userData.resource_access:', userData.resource_access);
          
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
          
          console.log('🔍 useAuth - Rôles extraits:', roles);
          console.log('🔍 useAuth - Permissions extraites:', permissions);
          
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
          };
          
          setUser(user);
          setLoading(false);
          
          // Initialiser le service de synchronisation des permissions
          permissionSyncService.initialize(user);
          
          // Forcer une synchronisation immédiate pour résoudre le problème d'accès
          try {
            console.log('🔄 useAuth - Synchronisation forcée immédiate au chargement');
            await permissionSyncService.syncNow();
          } catch (error) {
            console.warn('⚠️ useAuth - Erreur lors de la synchronisation forcée:', error);
          }
        } else if (response.status === 400 || response.status === 401) {
          // Erreur 400/401, essayer de rafraîchir le token
          try {
            // Vérifier si on a un refresh token
            if (keycloak.refreshToken) {
              const refreshed = await keycloak.updateToken(30);
              if (refreshed) {
                // Réessayer de charger les infos utilisateur
                await loadUserFromKeycloak();
                return;
              }
            }
          } catch (refreshError) {
            console.error('🔍 useAuth - Erreur lors du rafraîchissement du token:', refreshError);
          }
          
          // Si le rafraîchissement échoue, déconnecter l'utilisateur
          setUser(null);
          setLoading(false);
        } else {
          console.error('🔍 useAuth - Erreur lors du chargement des données utilisateur:', response.status);
          setUser(null);
          setLoading(false);
        }
      } catch (error) {
        console.error('🔍 useAuth - Erreur lors du chargement des données utilisateur:', error);
        setUser(null);
        setLoading(false);
      }
    };

    // Charger les informations utilisateur immédiatement
    loadUserInfo();
    
    // Écouter les changements d'état de Keycloak
    const handleAuthSuccess = () => {
      console.log('🔍 useAuth - handleAuthSuccess appelé');
      loadUserInfo();
    };
    
    const handleAuthLogout = () => {
      console.log('🔍 useAuth - handleAuthLogout appelé');
      setUser(null);
      setLoading(false);
    };
    
    // Écouter l'événement personnalisé de rechargement forcé
    const handleForceUserReload = () => {
      console.log('🔍 useAuth - handleForceUserReload appelé');
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
      console.log('🔍 useAuth - Mise à jour automatique des permissions reçue:', customEvent.detail);
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
    if (!user) {
      console.log('🔍 useAuth.hasPermissionAsync - Aucun utilisateur connecté');
      return false;
    }
    
    console.log('🔍 useAuth.hasPermissionAsync - Vérification de permission:', {
      permission,
      userId: user.id,
      userRoles: user.roles
    });
    
    try {
      // Appel direct à Redis (pas de cache local)
      const redisCacheService = RedisCacheService.getInstance();
      const redisPermissions = await redisCacheService.getPermissionsFromRedis(user.id);
      
      if (redisPermissions && redisPermissions.length > 0) {
        console.log('✅ useAuth.hasPermissionAsync - Permissions trouvées dans Redis:', redisPermissions.length);
        return redisPermissions.includes(permission);
      }
      
      console.log('⚠️ useAuth.hasPermissionAsync - Aucune permission dans Redis, accès refusé');
      return false;
    } catch (error) {
      console.error('❌ useAuth.hasPermissionAsync - Erreur Redis:', error);
      return false;
    }
  }, [user]);

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
    const storedToken = localStorage.getItem('kc_access_token');
    const storedRefreshToken = localStorage.getItem('kc_refresh_token');
    const storedIdToken = localStorage.getItem('kc_id_token');
    const storedExpiresIn = localStorage.getItem('kc_expires_in');
    
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
        (keycloak as any).token = storedToken;
        (keycloak as any).refreshToken = storedRefreshToken;
        (keycloak as any).idToken = storedIdToken;
        (keycloak as any).authenticated = true;
        
        // Restaurer tokenParsed si possible
        if (storedToken) {
          try {
            (keycloak as any).tokenParsed = JSON.parse(atob(storedToken.split('.')[1]));
          } catch (e) {
            console.warn('🔍 useAuth - Impossible de parser le token pour tokenParsed');
          }
        }
        
        return true;
      } catch (error) {
        console.error('🔍 useAuth - Erreur lors de la restauration:', error);
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
    (keycloak as any).token = undefined;
    (keycloak as any).refreshToken = undefined;
    (keycloak as any).authenticated = false;
    (keycloak as any).tokenParsed = undefined;
    
    // Nettoyer le localStorage
    try {
      localStorage.removeItem('kc_access_token');
      localStorage.removeItem('kc_refresh_token');
      localStorage.removeItem('kc_id_token');
      localStorage.removeItem('kc_expires_in');
    } catch (error) {
      console.error('🔍 useAuth - Erreur lors du nettoyage du localStorage:', error);
    }
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
