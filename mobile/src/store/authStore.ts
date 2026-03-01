import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { API_CONFIG, KEYCLOAK_CONFIG } from '@/config/api';

export interface AuthUser {
  id: string;
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
  organizationType?: string; // 'INDIVIDUAL' | 'CONCIERGE' | 'CLEANING_COMPANY' | 'SYSTEM'
  platformRole?: string;
  orgRole?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  loadUser: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<void>;

  // Role helpers (ported from web useAuth.ts)
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  isSuperAdmin: () => boolean;
  isSuperManager: () => boolean;
  isPlatformStaff: () => boolean;
  isHost: () => boolean;
  isTechnician: () => boolean;
  isHousekeeper: () => boolean;
  isSupervisor: () => boolean;
  isLaundry: () => boolean;
  isExteriorTech: () => boolean;
}

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'clenzy_access_token',
  REFRESH_TOKEN: 'clenzy_refresh_token',
} as const;

/** Fetch with timeout (AbortController) - returns undefined on failure */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 5000,
): Promise<Response | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    try {
      console.log('[AUTH] initialize: reading tokens from SecureStore...');
      const accessToken = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      console.log('[AUTH] initialize: tokens found:', !!accessToken, !!refreshToken);

      if (accessToken && refreshToken) {
        set({ accessToken, refreshToken });

        // Check if token is expired
        try {
          const payload = JSON.parse(atob(accessToken.split('.')[1]));
          const now = Math.floor(Date.now() / 1000);
          const isExpired = !payload.exp || payload.exp <= now;
          console.log('[AUTH] initialize: token expired:', isExpired, 'exp:', payload.exp, 'now:', now);

          if (!isExpired) {
            console.log('[AUTH] initialize: loading user...');
            await get().loadUser();
            console.log('[AUTH] initialize: loadUser complete');
          } else {
            console.log('[AUTH] initialize: refreshing token...');
            const refreshed = await get().refreshAccessToken();
            console.log('[AUTH] initialize: refresh result:', refreshed);
            if (refreshed) {
              await get().loadUser();
            } else {
              console.log('[AUTH] initialize: refresh failed, logging out...');
              await get().logout();
              console.log('[AUTH] initialize: logout complete');
            }
          }
        } catch (e) {
          console.error('[AUTH] initialize: error during token check:', e);
          await get().logout();
        }
      } else {
        console.log('[AUTH] initialize: no tokens, showing login');
      }
    } catch (e) {
      console.error('[AUTH] initialize: outer error:', e);
    } finally {
      console.log('[AUTH] initialize: FINALLY - setting isInitialized=true');
      set({ isLoading: false, isInitialized: true });
    }
  },

  login: async (username: string, password: string) => {
    const tokenUrl = `${KEYCLOAK_CONFIG.issuer}/protocol/openid-connect/token`;

    try {
      const response = await fetchWithTimeout(
        tokenUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'password',
            client_id: KEYCLOAK_CONFIG.clientId,
            username,
            password,
            scope: KEYCLOAK_CONFIG.scopes.join(' '),
          }).toString(),
        },
        15000,
      );

      if (!response) {
        throw new Error('Impossible de contacter le serveur. Verifiez votre connexion internet.');
      }

      if (response.ok) {
        const data = await response.json();
        await get().setTokens(data.access_token, data.refresh_token);
        await get().loadUser();
      } else if (response.status === 401 || response.status === 400) {
        throw new Error('Identifiants incorrects. Verifiez votre email et mot de passe.');
      } else {
        throw new Error(`Erreur serveur (${response.status}). Reessayez plus tard.`);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('Identifiants')) throw e;
      if (e instanceof Error && e.message.includes('Impossible')) throw e;
      if (e instanceof Error && e.message.includes('Erreur serveur')) throw e;
      throw new Error('Impossible de contacter le serveur. Verifiez votre connexion internet.');
    }
  },

  setTokens: async (accessToken: string, refreshToken: string) => {
    await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    set({ accessToken, refreshToken, isAuthenticated: true });
  },

  loadUser: async () => {
    const { accessToken } = get();
    if (!accessToken) return;

    try {
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}${API_CONFIG.ENDPOINTS.ME}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
        10000,
      );

      if (response?.ok) {
        const userData = await response.json();
        const permissions = userData.permissions || [];
        let roles: string[] = [];
        if (userData.role) {
          roles = [userData.role];
        } else if (userData.realm_access?.roles) {
          roles = userData.realm_access.roles.filter(
            (role: string) => role !== 'default-roles-clenzy' && role !== 'offline_access'
          );
        }

        const user: AuthUser = {
          id: userData.subject || userData.id || 'unknown',
          email: userData.email || '',
          username: userData.preferred_username || userData.username || 'Utilisateur',
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          fullName:
            userData.fullName ||
            `${userData.firstName || ''} ${userData.lastName || ''}`.trim() ||
            userData.preferred_username || userData.username || 'Utilisateur',
          roles: Array.isArray(roles) ? roles : [roles].filter(Boolean),
          permissions: Array.isArray(permissions) ? permissions : [permissions].filter(Boolean),
          forfait: userData.forfait,
          organizationId: userData.organizationId,
          organizationName: userData.organizationName,
          organizationType: userData.organizationType,
          platformRole: userData.platformRole || userData.role,
          orgRole: userData.orgRole,
        };

        set({ user, isAuthenticated: true });
      } else if (response?.status === 401) {
        const refreshed = await get().refreshAccessToken();
        if (refreshed) {
          await get().loadUser();
        } else {
          await get().logout();
        }
      }
    } catch {
      // Network error - stay authenticated if we have tokens (offline)
    }
  },

  refreshAccessToken: async () => {
    const { refreshToken } = get();
    if (!refreshToken) return false;

    try {
      const tokenUrl = `${KEYCLOAK_CONFIG.issuer}/protocol/openid-connect/token`;
      const response = await fetchWithTimeout(
        tokenUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: KEYCLOAK_CONFIG.clientId,
            refresh_token: refreshToken,
          }).toString(),
        },
        10000,
      );

      if (response?.ok) {
        const data = await response.json();
        await get().setTokens(data.access_token, data.refresh_token);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  },

  logout: async () => {
    const { refreshToken, accessToken } = get();

    // 1. Clear local tokens FIRST (ensures UI unblocks immediately)
    await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });

    // 2. Best-effort server-side cleanup (non-blocking, with 5s timeout)
    // Revoke refresh token + end Keycloak session in parallel
    const cleanupPromises: Promise<unknown>[] = [];

    if (refreshToken) {
      cleanupPromises.push(
        fetchWithTimeout(
          `${KEYCLOAK_CONFIG.issuer}/protocol/openid-connect/revoke`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: KEYCLOAK_CONFIG.clientId,
              token: refreshToken,
              token_type_hint: 'refresh_token',
            }).toString(),
          },
        ),
      );
    }

    if (refreshToken || accessToken) {
      cleanupPromises.push(
        fetchWithTimeout(
          `${KEYCLOAK_CONFIG.issuer}/protocol/openid-connect/logout`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: KEYCLOAK_CONFIG.clientId,
              refresh_token: refreshToken || '',
            }).toString(),
          },
        ),
      );
    }

    // Fire and forget - don't block on server cleanup
    if (cleanupPromises.length > 0) {
      Promise.allSettled(cleanupPromises).catch(() => {
        console.warn('[AUTH] Server-side logout cleanup failed');
      });
    }
  },

  // Role helpers
  hasRole: (role: string) => {
    return get().user?.roles.includes(role) ?? false;
  },

  hasAnyRole: (roles: string[]) => {
    const userRoles = get().user?.roles || [];
    return roles.some((r) => userRoles.includes(r));
  },

  isSuperAdmin: () => get().hasRole('SUPER_ADMIN'),
  isSuperManager: () => get().hasRole('SUPER_MANAGER'),
  isPlatformStaff: () => get().hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']),
  isHost: () => get().hasRole('HOST'),
  isTechnician: () => get().hasRole('TECHNICIAN'),
  isHousekeeper: () => get().hasRole('HOUSEKEEPER'),
  isSupervisor: () => get().hasRole('SUPERVISOR'),
  isLaundry: () => get().hasRole('LAUNDRY'),
  isExteriorTech: () => get().hasRole('EXTERIOR_TECH'),
}));
