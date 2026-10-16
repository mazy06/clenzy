import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { API_CONFIG } from '@/config/api';
import { baitlyCredentials, BaitlyLoginError } from '@/services/auth/baitlyCredentials';
import { clearAllMissionDrafts } from '@/features/missions/drafts';
import { queryClient, queryPersister } from '@/config/queryClient';
import { useOfflineStore } from '@/store/offlineStore';
import { useNotificationStore } from '@/store/notificationStore';

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
  login: (username: string, password: string, captchaToken?: string) => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  loadUser: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  logout: (preserveDrafts?: boolean) => Promise<void>;

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

let refreshFlight: Promise<boolean> | null = null;
let sessionGeneration = 0;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      if (refreshToken) {
        set({ refreshToken });
        if (await get().refreshAccessToken()) await get().loadUser();
        if (!get().user) await get().logout(true);
      }
    } catch (e) {
      console.error('[AUTH] initialize: outer error:', e);
    } finally {
      set({ isLoading: false, isInitialized: true });
    }
  },

  login: async (username, password, captchaToken) => {
    const generation = ++sessionGeneration;
    const tokens = await baitlyCredentials(username, password, captchaToken);
    if (generation !== sessionGeneration) return;
    await get().setTokens(tokens.accessToken, tokens.refreshToken!);
    await get().loadUser();
    if (!get().user) {
      await get().logout(true);
      throw new BaitlyLoginError('profile');
    }
  },

  setTokens: async (accessToken: string, refreshToken: string) => {
    // Access token stays in memory; remove the legacy persisted copy.
    await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    set({ accessToken, refreshToken });
  },

  loadUser: async () => {
    const generation = sessionGeneration;
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
        if (generation !== sessionGeneration || get().accessToken !== accessToken) return;
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
        if (generation === sessionGeneration) await get().logout(true);
      }
    } catch {
      // Network error - stay authenticated if we have tokens (offline)
    }
  },

  refreshAccessToken: () => {
    if (refreshFlight) return refreshFlight;
    const generation = sessionGeneration;
    refreshFlight = (async () => {
    const { refreshToken } = get();
    if (!refreshToken) return false;

    try {
      const tokenUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/public/baitly-session/refresh`;
      const response = await fetchWithTimeout(
        tokenUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
          credentials: 'omit',
        },
        10000,
      );

      if (response?.ok) {
        const data = await response.json();
        if (generation !== sessionGeneration || get().refreshToken !== refreshToken) return false;
        await get().setTokens(data.access_token, data.refresh_token || refreshToken);
        return true;
      }

      return false;
    } catch {
      return false;
    }

    })().finally(() => { refreshFlight = null; });
    return refreshFlight;
  },

  logout: async (preserveDrafts = false) => {
    sessionGeneration += 1;
    if (!preserveDrafts) await clearAllMissionDrafts().catch(() => {});
    const { refreshToken } = get();

    // 0. Désenregistrer le token push TANT QUE la session est encore valide
    // (le DELETE /devices est authentifié). Best-effort borné à 1,5 s pour ne
    // jamais retarder le logout.
    try {
      const { unregisterPushNotifications } = await import('@/services/push/pushService');
      await Promise.race([
        unregisterPushNotifications(),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    } catch {
      // Best effort — le token orphelin sera réassigné au prochain login.
    }

    // 1. Clear local tokens FIRST (ensures UI unblocks immediately)
    await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    queryClient.clear();
    await queryPersister.removeClient();
    useOfflineStore.getState().clearSession();
    useNotificationStore.getState().resetUnread();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });

    // 2. Best-effort server-side cleanup (non-blocking, with 5s timeout)
    // Revoke the session through the Baitly backend that issued the tokens.
    const cleanupPromises: Promise<unknown>[] = [];

    if (refreshToken) {
      cleanupPromises.push(
        fetchWithTimeout(
          `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/public/baitly-session/logout`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
            credentials: 'omit',
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
