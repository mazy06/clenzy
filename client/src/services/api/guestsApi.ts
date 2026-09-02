import apiClient from '../apiClient';
import { API_CONFIG } from '../../config/api';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GuestDto {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  fullName: string;
  countryCode?: string;
  language?: string;
  notes?: string;
  /** Photo de profil du voyageur. Absente -> repli sur les initiales. */
  avatarUrl?: string;
}

export interface CreateGuestData {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  countryCode?: string;
  language?: string;
  notes?: string;
}

export interface GuestListDto {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  fullName: string;
  channel?: string;
  totalStays: number;
  totalSpent: number;
  language?: string;
  createdAt?: string;
  organizationId: number;
  organizationName?: string;
  /** Photo de profil du voyageur. Absente -> repli sur les initiales. */
  avatarUrl?: string;
}

export interface GuestListParams {
  search?: string;
  channel?: string;
}

export interface GuestPageParams extends GuestListParams {
  page: number;
  size: number;
}

/** Enveloppe du mode pagine serveur (convention {content, page, size, totalElements}). */
export interface GuestPage {
  content: GuestListDto[];
  page: number;
  size: number;
  totalElements: number;
}

// ─── API ────────────────────────────────────────────────────────────────────

export const guestsApi = {
  /** Recherche de voyageurs par nom (minimum 2 caracteres). */
  async search(query: string): Promise<GuestDto[]> {
    if (!query || query.length < 2) return [];
    return apiClient.get<GuestDto[]>('/guests', { params: { search: query } });
  },

  /** Creer une fiche client (deduplication automatique cote serveur). */
  async create(data: CreateGuestData): Promise<GuestDto> {
    return apiClient.post<GuestDto>('/guests', data);
  },

  /** Mettre a jour la fiche d'un voyageur existant (nom, email, tel, pays, langue, notes). */
  async update(guestId: number, data: CreateGuestData): Promise<GuestDto> {
    return apiClient.put<GuestDto>(`/guests/${guestId}`, data);
  },

  /** Lister tous les voyageurs (page Voyageurs). */
  async list(params?: GuestListParams): Promise<GuestListDto[]> {
    return apiClient.get<GuestListDto[]>('/guests/list', { params: params as Record<string, string | undefined> });
  },

  /** Lister les voyageurs en mode pagine serveur (opt-in via page/size). */
  async listPage(params: GuestPageParams): Promise<GuestPage> {
    return apiClient.get<GuestPage>('/guests/list', {
      params: { ...params } as Record<string, string | number | undefined>,
    });
  },

  /** Mettre a jour l'email d'un voyageur. */
  async updateEmail(guestId: number, email: string): Promise<GuestDto> {
    return apiClient.patch<GuestDto>(`/guests/${guestId}/email`, { email });
  },
};

/**
 * URL exploitable par un `<img src>` pour la photo d'un voyageur.
 *
 * Le backend renvoie une URL SIGNEE **relative** (`/api/guests/{id}/photo?ticket=...`).
 * En dev le front (:3000) et l'API (:8084) sont sur des origines distinctes : un
 * `<img src="/api/...">` viserait Vite, qui repond index.html, et l'avatar
 * tomberait sur les initiales. On prefixe donc la base API — vide en production
 * (meme origine), ou l'URL reste relative et inchangee.
 *
 * Retourne `undefined` quand le voyageur n'a pas de photo : les surfaces
 * d'avatar retombent alors sur ses initiales.
 */
export function guestPhotoSrc(avatarUrl?: string | null): string | undefined {
  if (!avatarUrl) return undefined;
  // Une URL absolue (photo importee d'un canal) ne passe pas par nos routes.
  return avatarUrl.startsWith('/') ? `${API_CONFIG.BASE_URL}${avatarUrl}` : avatarUrl;
}
