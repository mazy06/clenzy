import { useState, useEffect, useCallback } from 'react';
import keycloak from '../keycloak';
import { API_CONFIG } from '../config/api';

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

  useEffect(() => {
    const loadUserInfo = async () => {
      // Vérifier d'abord si on a des tokens en localStorage
      const storedToken = localStorage.getItem('kc_access_token');
      const storedRefreshToken = localStorage.getItem('kc_refresh_token');
      
      console.log('🔍 useAuth - Tokens stockés:', { 
        hasAccessToken: !!storedToken, 
        hasRefreshToken: !!storedRefreshToken 
      });

      // Vérifier d'abord l'état de Keycloak
      if (keycloak.authenticated && keycloak.token) {
        console.log('🔍 useAuth - Keycloak authentifié, chargement des infos...');
        await loadUserFromKeycloak();
      } else if (storedToken && storedRefreshToken) {
        console.log('🔍 useAuth - Tokens trouvés en localStorage mais Keycloak non authentifié');
        
        // Tenter de restaurer l'état Keycloak
        const restored = restoreKeycloakState();
        if (restored) {
          console.log('🔍 useAuth - État Keycloak restauré, chargement des infos...');
          await loadUserFromKeycloak();
        } else {
          console.log('🔍 useAuth - Échec de la restauration, déconnexion...');
          setUser(null);
          setLoading(false);
        }
      } else {
        console.log('🔍 useAuth - Aucune authentification trouvée');
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
          
          console.log('🔍 useAuth - Données reçues de /me:', userData);
          console.log('🔍 useAuth - firstName:', userData.firstName, 'first_name:', userData.first_name);
          console.log('🔍 useAuth - lastName:', userData.lastName, 'last_name:', userData.last_name);
          console.log('🔍 useAuth - fullName:', userData.fullName, 'full_name:', userData.full_name);
          
          // Utiliser directement les permissions depuis l'API
          const permissions = userData.permissions || [];
          // Le backend retourne 'role' (singulier), pas 'roles' (pluriel)
          const role = userData.role || '';
          const roles = role ? [role] : [];
          
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

          console.log('🔍 useAuth - Utilisateur chargé avec succès:', user);
          console.log('🔍 useAuth - Permissions:', user.permissions);
          console.log('🔍 useAuth - Rôles:', user.roles);
          
          setUser(user);
          setLoading(false);
        } else if (response.status === 400 || response.status === 401) {
          console.log('🔍 useAuth - Erreur 400/401, tentative de rafraîchissement du token...');
          // Erreur 400/401, essayer de rafraîchir le token
          try {
            // Vérifier si on a un refresh token
            if (keycloak.refreshToken) {
              const refreshed = await keycloak.updateToken(30);
              if (refreshed) {
                console.log('🔍 useAuth - Token rafraîchi, nouvelle tentative de chargement...');
                // Réessayer de charger les infos utilisateur
                await loadUserFromKeycloak();
                return;
              }
            }
          } catch (refreshError) {
            console.error('🔍 useAuth - Erreur lors du rafraîchissement du token:', refreshError);
          }
          
          // Si le rafraîchissement échoue, déconnecter l'utilisateur
          console.log('🔍 useAuth - Rafraîchissement échoué, déconnexion...');
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
      console.log('🔍 useAuth - Événement d\'authentification Keycloak reçu');
      loadUserInfo();
    };
    
    const handleAuthLogout = () => {
      console.log('🔍 useAuth - Événement de déconnexion Keycloak reçu');
      setUser(null);
      setLoading(false);
    };
    
    // Écouter l'événement personnalisé de rechargement forcé
    const handleForceUserReload = () => {
      console.log('🔍 useAuth - Événement de rechargement forcé reçu');
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
    
    return () => {
      // Nettoyer les écouteurs
      keycloak.onAuthSuccess = undefined;
      keycloak.onAuthLogout = undefined;
      window.removeEventListener('force-user-reload', handleForceUserReload);
    };
  }, []); // Dépendances vides pour s'exécuter une seule fois au montage

  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;
    return user.permissions.includes(permission);
  }, [user]);

  const hasRole = useCallback((role: string): boolean => {
    if (!user) return false;
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
    console.log('🔍 useAuth - Tentative de restauration de l\'état Keycloak...');
    
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
          console.log('🔍 useAuth - Token expiré, nettoyage...');
          clearUser();
          return false;
        }
        
        // Restaurer l'état Keycloak
        console.log('🔍 useAuth - Restauration de l\'état Keycloak...');
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
        
        console.log('🔍 useAuth - État Keycloak restauré avec succès');
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
    console.log('🔍 useAuth - Nettoyage complet de l\'état utilisateur');
    
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
    
    console.log('🔍 useAuth - Nettoyage terminé');
  }, []);

  return {
    user,
    loading,
    hasPermission,
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
