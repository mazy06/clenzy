import apiClient from '../apiClient';
import { API_CONFIG } from '../../config/api';

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  /** Public URL to fetch the profile picture (served by the PMS). null when no avatar. */
  profilePictureUrl?: string | null;
  // Contact
  phoneNumber?: string;
  // Profil host (donnees du formulaire de devis)
  companyName?: string;
  forfait?: string;
  city?: string;
  postalCode?: string;
  propertyType?: string;
  propertyCount?: number;
  surface?: number;
  guestCapacity?: number;
  // Donnees supplementaires du formulaire de devis
  bookingFrequency?: string;
  cleaningSchedule?: string;
  calendarSync?: string;
  services?: string;       // Séparé par virgule
  servicesDevis?: string;  // Séparé par virgule
  deferredPayment?: boolean;
  // Organisation rattachee
  organizationId?: number;
  organizationName?: string;
}

export interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role: string;
  phoneNumber?: string;
  status?: string;
  deferredPayment?: boolean;
  organizationId?: number;
  orgRole?: string;
}

export interface LockoutStatus {
  isLocked: boolean;
  remainingSeconds: number;
  captchaRequired: boolean;
  failedAttempts: number;
}

export const usersApi = {
  getAll(params?: { role?: string }) {
    return apiClient.get<User[]>('/users', { params });
  },
  getById(id: number) {
    return apiClient.get<User>(`/users/${id}`);
  },
  create(data: UserFormData) {
    return apiClient.post<User>('/users', data);
  },
  update(id: number, data: Partial<UserFormData>) {
    return apiClient.put<User>(`/users/${id}`, data);
  },
  delete(id: number) {
    return apiClient.delete(`/users/${id}`);
  },
  // ─── Lockout management (admin) ─────────────────────
  getLockoutStatus(userId: number) {
    return apiClient.get<LockoutStatus>(`/users/${userId}/lockout-status`);
  },
  unlockUser(userId: number) {
    return apiClient.post<{ success: boolean; message: string }>(`/users/${userId}/unlock`, {});
  },

  // ─── Profile picture ────────────────────────────────────────────────────

  /** Upload a new profile picture for the user and return the updated record. */
  uploadProfilePicture(userId: number, file: File): Promise<User> {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.upload<User>(`/users/${userId}/profile-picture`, formData);
  },

  /** Remove the profile picture and return the updated record. */
  deleteProfilePicture(userId: number): Promise<User> {
    return apiClient.delete<User>(`/users/${userId}/profile-picture`);
  },

  /**
   * Stable URL used by avatar surfaces. Appends a cache-busting token derived from
   * `updatedAt` so a freshly uploaded photo replaces the cached blob immediately.
   */
  profilePictureUrl(userId: number, cacheBust?: string | null): string {
    const base = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/users/${userId}/profile-picture`;
    return cacheBust ? `${base}?v=${encodeURIComponent(cacheBust)}` : base;
  },
};

/**
 * Helper for any `<Avatar>` surface that wants to display a user's photo if it exists
 * and gracefully fall back to initials otherwise.
 *
 * Returns `undefined` when:
 *  - the user object is null/undefined
 *  - no numeric id is resolvable (Keycloak string ids are ignored — we need the DB id)
 *  - the user has no `profilePictureUrl` (i.e. never uploaded a photo)
 *
 * Returns the cache-busted served URL otherwise. MUI's `<Avatar>` automatically falls
 * back to its `children` (the initials) when `src` is undefined or 404s.
 *
 * Accepts mixed shapes (numeric `id`, numeric `databaseId`, or even a string Keycloak id)
 * to keep call sites simple.
 */
export function userAvatarSrc(
  user: {
    id?: number | string | null;
    databaseId?: number | null;
    profilePictureUrl?: string | null;
    updatedAt?: string | null;
  } | null | undefined,
): string | undefined {
  if (!user) return undefined;
  if (!user.profilePictureUrl) return undefined;
  // Prefer databaseId (numeric Long) when present; fall back to id if it's numeric.
  const candidate = user.databaseId != null ? user.databaseId : user.id;
  const numericId
    = typeof candidate === 'number'
      ? candidate
      : typeof candidate === 'string' && /^\d+$/.test(candidate)
        ? Number(candidate)
        : undefined;
  if (numericId == null) return undefined;
  return usersApi.profilePictureUrl(numericId, user.updatedAt ?? null);
}
