import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import keycloak, { keycloakInitPromise, syncAuthCookie } from '../keycloak';
import { API_CONFIG } from '../config/api';
import { clearTokenCookie } from '../services/apiClient';
import PermissionSyncService from '../services/PermissionSyncService';
import { clearTokens, clearSessionCookie } from '../services/storageService';
import { idbCache } from '../services/indexedDbCache';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserRole {
  name: string;
  permissions: string[];
}

export interface AuthUser {
  id: string;
  databaseId?: number;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  roles: string[];
  permissions: string[];
  forfait?: string;
  organizationId?: number;
  organizationName?: string;
  organizationType?: string;
  platformRole?: string;
  orgRole?: string;
  profilePictureUrl?: string | null;
  updatedAt?: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  hasPermissionAsync: (permission: string) => Promise<boolean>;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  isSuperAdmin: () => boolean;
  isSuperManager: () => boolean;
  isPlatformStaff: () => boolean;
  isAdmin: () => boolean;
  isManager: () => boolean;
  isHost: () => boolean;
  isTechnician: () => boolean;
  isHousekeeper: () => boolean;
  isSupervisor: () => boolean;
  isLaundry: () => boolean;
  isExteriorTech: () => boolean;
  clearUser: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Hook d'acces a l'etat d'authentification de l'utilisateur courant.
 *
 * <p><b>API stable</b> : meme retour qu'avant le refactor AuthContext (94 sites
 * d'appel continuent de fonctionner sans modification). La difference critique :
 * l'etat est maintenant <b>partage</b> via Context, donc UN SEUL appel /api/me
 * au boot meme si plusieurs composants utilisent useAuth() — fini le storm de
 * requetes paralleles qui causait les 429 / deconnexions.</p>
 *
 * <p>Doit etre utilise sous {@link AuthProvider}. En dehors, leve une erreur
 * explicite plutot que de renvoyer un state vide silencieusement.</p>
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be used within <AuthProvider>. ' +
      'Add <AuthProvider> high in your component tree (typically in main.tsx).');
  }
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * Provider racine du state d'authentification.
 *
 * <p>Mount au plus haut dans l'arbre (typiquement dans main.tsx, juste sous
 * BrowserRouter) pour que tous les consommateurs partagent le meme state.</p>
 *
 * <p><b>Responsabilites</b> :</p>
 * <ul>
 *   <li>Bootstrap : appel /api/me UNIQUE au mount (resilient aux 429/5xx)</li>
 *   <li>Listen : Keycloak events + window events (force-user-reload, etc.)</li>
 *   <li>Refresh : sync permissions en arriere-plan, refresh token a 401</li>
 *   <li>Expose les helpers de role (hasRole, isSuperAdmin, etc.) memoizes</li>
 * </ul>
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const permissionSyncService = PermissionSyncService.getInstance();

  useEffect(() => {
    // /!\ Pas de garde "ne run qu'une fois" via useRef ici. En React.StrictMode
    // dev, useEffect est invoque 2 fois (setup → cleanup → setup) sur la meme
    // instance, et un useRef garde-fou empecherait le 2e setup d'attacher les
    // listeners alors que la cleanup les a deja detaches.
    const loadUserInfo = async () => {
      // CRITIQUE — await keycloakInitPromise AVANT de checker keycloak.authenticated.
      // Sans ce wait, ce useEffect s'execute AVANT que l'init Keycloak (qui inclut
      // la restauration du token via le cookie HttpOnly clenzy_auth) ait fini. On
      // tombe dans le else, setUser(null), et aucun re-fetch n'est jamais declenche
      // → user reste null → spinner infini ou HardRedirectToLogin (cf. App.tsx).
      // Le promise est partage avec App.tsx (resolve une seule fois pour les 2).
      try {
        await keycloakInitPromise;
      } catch {
        // L'erreur d'init est geree dans keycloak.ts — on continue avec le state
        // courant de keycloak (authenticated=false probablement) et on logout.
      }

      if (keycloak.authenticated && keycloak.token) {
        await loadUserFromKeycloak();
      } else {
        setUser(null);
        setLoading(false);
      }
    };

    const loadUserFromKeycloak = async () => {
      try {
        const response = await fetch(API_CONFIG.ENDPOINTS.ME, {
          headers: {
            Authorization: `Bearer ${keycloak.token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const userData = await response.json();
          const permissions = userData.permissions || [];

          let roles: string[] = [];
          if (userData.role) {
            roles = [userData.role];
          } else if (userData.realm_access && userData.realm_access.roles) {
            roles = userData.realm_access.roles.filter(
              (role: string) => role !== 'default-roles-clenzy' && role !== 'offline_access'
            );
          }

          const nextUser: AuthUser = {
            id: userData.subject || userData.id || 'unknown',
            databaseId: userData.id ? Number(userData.id) : undefined,
            email: userData.email || '',
            username: userData.preferred_username || userData.username || 'Utilisateur',
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            fullName:
              userData.fullName ||
              `${userData.firstName || ''} ${userData.lastName || ''}`.trim() ||
              userData.preferred_username ||
              userData.username ||
              'Utilisateur',
            roles: Array.isArray(roles) ? roles : [roles].filter(Boolean),
            permissions: Array.isArray(permissions) ? permissions : [permissions].filter(Boolean),
            forfait: userData.forfait || undefined,
            organizationId: userData.organizationId || undefined,
            organizationName: userData.organizationName || undefined,
            organizationType: userData.organizationType || undefined,
            platformRole: userData.platformRole || userData.role || undefined,
            orgRole: userData.orgRole || undefined,
            profilePictureUrl: userData.profilePictureUrl || null,
            updatedAt: userData.updatedAt || undefined,
          };

          setUser(nextUser);
          setLoading(false);

          syncAuthCookie().catch(() => { /* best-effort */ });
          permissionSyncService.initialize(nextUser);
          try {
            await permissionSyncService.syncNow();
          } catch (error) {
            console.warn('AuthProvider - Erreur lors de la synchronisation forcée:', error);
          }
        } else if (response.status === 400 || response.status === 401) {
          // Erreur d'auth : tenter un refresh, sinon logout
          try {
            if (keycloak.refreshToken) {
              const refreshed = await keycloak.updateToken(30);
              if (refreshed && keycloak.token) {
                syncAuthCookie().catch(() => { /* best-effort */ });
                await loadUserFromKeycloak();
                return;
              }
            }
          } catch (refreshError) {
            console.error('AuthProvider - Erreur lors du rafraîchissement du token:', refreshError);
          }
          setUser(null);
          setLoading(false);
        } else if (response.status === 429 || response.status >= 500) {
          // Erreur transitoire (rate limit / serveur indisponible) : ne PAS
          // deconnecter — garder le state actuel, le prochain trigger retentera.
          console.warn(
            'AuthProvider - Erreur transitoire sur /api/me (status ' + response.status
              + '), conservation du state utilisateur courant.'
          );
          setLoading(false);
        } else {
          // 403 / 404 / autres 4xx : vraie incoherence → deconnexion
          console.error('AuthProvider - Erreur lors du chargement /api/me:', response.status);
          setUser(null);
          setLoading(false);
        }
      } catch (error) {
        // Erreur reseau (fetch a leve) — comme 429/5xx, transitoire → garder le state
        console.warn(
          'AuthProvider - Erreur reseau lors du chargement /api/me, conservation du state:',
          error instanceof Error ? error.message : error
        );
        setLoading(false);
      }
    };

    loadUserInfo();

    const handleAuthSuccess = () => {
      loadUserInfo();
      window.dispatchEvent(new CustomEvent('keycloak-auth-success'));
    };

    const handleAuthLogout = () => {
      setUser(null);
      setLoading(false);
      clearSessionCookie();
      window.dispatchEvent(new CustomEvent('keycloak-auth-logout'));
    };

    const handleForceUserReload = () => {
      setTimeout(() => loadUserInfo(), 100);
    };

    const handleKeycloakAuthSuccess = () => {
      setTimeout(() => loadUserInfo(), 50);
    };

    const handlePermissionsRefresh = () => {
      loadUserInfo();
    };

    const handlePermissionsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent;
      // Lecture du user via closure : on capture via setUser fn-form pour
      // toujours acceder au state le plus recent (le user de la closure peut
      // etre stale puisque cet effect ne se re-run pas).
      setUser((prev) => {
        if (!prev || customEvent.detail.userId !== prev.id) return prev;
        return { ...prev, permissions: customEvent.detail.permissions };
      });
    };

    keycloak.onAuthSuccess = handleAuthSuccess;
    keycloak.onAuthLogout = handleAuthLogout;
    window.addEventListener('force-user-reload', handleForceUserReload);
    window.addEventListener('keycloak-auth-success', handleKeycloakAuthSuccess);
    window.addEventListener('permissions-refreshed', handlePermissionsRefresh);
    window.addEventListener('permissions-updated', handlePermissionsUpdated);

    return () => {
      keycloak.onAuthSuccess = undefined;
      keycloak.onAuthLogout = undefined;
      window.removeEventListener('force-user-reload', handleForceUserReload);
      window.removeEventListener('keycloak-auth-success', handleKeycloakAuthSuccess);
      window.removeEventListener('permissions-refreshed', handlePermissionsRefresh);
      window.removeEventListener('permissions-updated', handlePermissionsUpdated);
      permissionSyncService.shutdown();
    };
  }, []);

  // ─── Helpers de role/permission ──────────────────────────────────────────

  const hasPermissionAsync = useCallback(
    async (permission: string): Promise<boolean> => {
      if (loading) return false;
      if (!user) return false;

      if (user.permissions && user.permissions.length > 0) {
        if (user.permissions.includes(permission)) return true;
      }

      try {
        const syncResponse = await fetch(
          `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/permissions/sync`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${keycloak.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: user.id }),
          },
        );

        if (!syncResponse.ok) {
          console.error('AuthProvider - Erreur sync permissions:', syncResponse.status);
          return false;
        }

        const syncData = await syncResponse.json();
        if (syncData.permissions && syncData.permissions.length > 0) {
          setUser((prevUser) => {
            if (!prevUser) return null;
            const currentPerms = prevUser.permissions || [];
            const newPerms = syncData.permissions || [];
            if (
              currentPerms.length === newPerms.length &&
              currentPerms.every((p: string) => newPerms.includes(p)) &&
              newPerms.every((p: string) => currentPerms.includes(p))
            ) {
              return prevUser;
            }
            return { ...prevUser, permissions: syncData.permissions };
          });
          return syncData.permissions.includes(permission);
        }
        return false;
      } catch {
        return false;
      }
    },
    [user, loading],
  );

  const hasRole = useCallback((role: string): boolean => {
    if (!user) return false;
    return user.roles.includes(role);
  }, [user]);

  const hasAnyRole = useCallback((roles: string[]): boolean => {
    if (!user) return false;
    return roles.some((role) => user.roles.includes(role));
  }, [user]);

  const isSuperAdmin = useCallback((): boolean => hasAnyRole(['SUPER_ADMIN']), [hasAnyRole]);
  const isSuperManager = useCallback((): boolean => hasAnyRole(['SUPER_MANAGER']), [hasAnyRole]);
  const isPlatformStaff = useCallback(
    (): boolean => hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']),
    [hasAnyRole],
  );
  const isAdmin = useCallback((): boolean => hasAnyRole(['SUPER_ADMIN']), [hasAnyRole]);
  const isManager = useCallback((): boolean => hasAnyRole(['SUPER_MANAGER']), [hasAnyRole]);
  const isHost = useCallback((): boolean => hasRole('HOST'), [hasRole]);
  const isTechnician = useCallback((): boolean => hasRole('TECHNICIAN'), [hasRole]);
  const isHousekeeper = useCallback((): boolean => hasRole('HOUSEKEEPER'), [hasRole]);
  const isSupervisor = useCallback((): boolean => hasRole('SUPERVISOR'), [hasRole]);
  const isLaundry = useCallback((): boolean => hasRole('LAUNDRY'), [hasRole]);
  const isExteriorTech = useCallback((): boolean => hasRole('EXTERIOR_TECH'), [hasRole]);

  const clearUser = useCallback(() => {
    setUser(null);
    setLoading(false);
    keycloak.token = undefined;
    keycloak.refreshToken = undefined;
    keycloak.authenticated = false;
    keycloak.tokenParsed = undefined;
    clearTokenCookie().catch(() => { /* silent */ });
    clearTokens();
    idbCache.deleteByPrefix('amenity-icons:').catch(() => { /* best-effort */ });
    window.dispatchEvent(new CustomEvent('keycloak-auth-logout'));
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    hasPermissionAsync,
    hasRole,
    hasAnyRole,
    isSuperAdmin,
    isSuperManager,
    isPlatformStaff,
    isAdmin,
    isManager,
    isHost,
    isTechnician,
    isHousekeeper,
    isSupervisor,
    isLaundry,
    isExteriorTech,
    clearUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
