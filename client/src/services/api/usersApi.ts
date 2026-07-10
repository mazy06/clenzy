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

  // ─── Preferences marketing (RGPD article 7-3) ─────────────────────────────

  /** Lit l'opt-in newsletter de l'utilisateur courant. */
  getMyMarketingPreferences(): Promise<{ newsletterOptIn: boolean }> {
    return apiClient.get<{ newsletterOptIn: boolean }>('/users/me/marketing-preferences');
  },

  /**
   * Met a jour l'opt-in newsletter de l'utilisateur courant.
   *
   * <p>Retour cle pour la conformite RGPD : l'utilisateur doit pouvoir retirer
   * son consentement aussi simplement qu'il l'a donne (article 7-3).</p>
   */
  updateMyMarketingPreferences(newsletterOptIn: boolean): Promise<{ newsletterOptIn: boolean }> {
    return apiClient.put<{ newsletterOptIn: boolean }>('/users/me/marketing-preferences', { newsletterOptIn });
  },
};

/**
 * Helper for any `<Avatar>` surface that wants to display a user's photo if it exists
 * and gracefully fall back to initials otherwise.
 *
 * Le backend renvoie une URL SIGNEE **relative** (`/api/users/..?ticket=..`). Comme le front
 * (:3000) et l'API (:8084) sont sur des origines distinctes en dev, cette URL doit etre
 * prefixee de la base API — sinon un `<img src="/api/..">` vise l'origine de la page (Vite),
 * qui renvoie index.html, et l'avatar tombe sur les initiales. En prod (same-origin), la base
 * est vide et l'URL reste relative, donc inchangee.
 *
 * Returns `undefined` when the user is null/undefined or has no `profilePictureUrl`. MUI's
 * `<Avatar>` retombe sur ses `children` (les initiales) quand `src` est undefined ou 404.
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
  if (user.profilePictureUrl) {
    // Le backend renvoie une URL SIGNEE (ticket HMAC, cf. UserService.publicAvatarUrl) ou
    // une URL externe SSO. ATTENTION : /me et les DTO renvoient une URL RELATIVE
    // (`/api/users/..`). Le front (:3000) et l'API (:8084) etant sur des origines distinctes
    // en dev, un `<img src="/api/..">` resout contre l'origine de la PAGE (Vite :3000), qui
    // renvoie index.html au lieu de l'image -> <img> casse -> initiales. On prefixe donc la
    // base API pour viser le backend (BASE_URL vide en prod same-origin -> inchange). Les
    // URL externes (http/https, SSO) passent telles quelles.
    const raw = user.profilePictureUrl;
    const url = raw.startsWith('/') ? `${API_CONFIG.BASE_URL}${raw}` : raw;
    if (!user.updatedAt) return url;
    // Cache-bust sur upload (l'URL signee a deja un '?ticket=').
    return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(user.updatedAt)}`;
  }
  return undefined;
}
