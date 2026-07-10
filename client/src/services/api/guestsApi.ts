import apiClient from '../apiClient';

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
}

export interface GuestListParams {
  search?: string;
  channel?: string;
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

  /** Mettre a jour l'email d'un voyageur. */
  async updateEmail(guestId: number, email: string): Promise<GuestDto> {
    return apiClient.patch<GuestDto>(`/guests/${guestId}/email`, { email });
  },
};
