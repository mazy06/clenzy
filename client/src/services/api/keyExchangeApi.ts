import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KeyExchangePointDto {
  id: number;
  propertyId: number;
  propertyName: string;
  provider: 'KEYNEST' | 'CLENZY_KEYVAULT';
  guardianType: 'MERCHANT' | 'INDIVIDUAL' | null;
  providerStoreId: string | null;
  storeName: string;
  storeAddress: string | null;
  storePhone: string | null;
  storeLat: number | null;
  storeLng: number | null;
  storeOpeningHours: string | null;
  verificationToken: string | null;
  status: string;
  activeCodesCount: number;
  createdAt: string;
}

export interface CreateKeyExchangePointDto {
  propertyId: number;
  provider: 'KEYNEST' | 'CLENZY_KEYVAULT';
  guardianType?: 'MERCHANT' | 'INDIVIDUAL';
  providerStoreId?: string;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeLat?: number;
  storeLng?: number;
  storeOpeningHours?: string;
}

export interface KeyExchangeCodeDto {
  id: number;
  pointId: number;
  pointName: string | null;
  propertyId: number;
  reservationId: number | null;
  guestName: string | null;
  code: string;
  codeType: 'COLLECTION' | 'DROP_OFF';
  status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';
  validFrom: string | null;
  validUntil: string | null;
  collectedAt: string | null;
  returnedAt: string | null;
  providerCodeId: string | null;
  createdAt: string;
}

export interface CreateKeyExchangeCodeDto {
  pointId: number;
  guestName?: string;
  codeType?: 'COLLECTION' | 'DROP_OFF';
  reservationId?: number;
  validFrom?: string;
  validUntil?: string;
}

export interface KeyExchangeEventDto {
  id: number;
  codeId: number | null;
  pointId: number | null;
  pointName: string | null;
  propertyId: number;
  propertyName: string | null;
  eventType: string;
  actorName: string | null;
  notes: string | null;
  source: string;
  createdAt: string;
}

export interface KeyExchangeEventsPage {
  content: KeyExchangeEventDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface KeyNestStoreDto {
  storeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
  openingHours: string | null;
  type: string | null;
}

// ─── Key Exchange API ──────────────────────────────────────────────────────

export const keyExchangeApi = {
  // ─── Points ───────────────────────────────────────────────

  /** Liste des points d'echange de l'organisation */
  getPoints() {
    return apiClient.get<KeyExchangePointDto[]>('/key-exchange/points');
  },

  /** Creer un point d'echange */
  createPoint(data: CreateKeyExchangePointDto) {
    return apiClient.post<KeyExchangePointDto>('/key-exchange/points', data);
  },

  /** Supprimer un point d'echange */
  deletePoint(id: number) {
    return apiClient.delete(`/key-exchange/points/${id}`);
  },

  // ─── Codes ────────────────────────────────────────────────

  /** Codes actifs d'un point */
  getActiveCodesByPoint(pointId: number) {
    return apiClient.get<KeyExchangeCodeDto[]>(`/key-exchange/points/${pointId}/codes`);
  },

  /** Generer un code d'echange */
  generateCode(data: CreateKeyExchangeCodeDto) {
    return apiClient.post<KeyExchangeCodeDto>('/key-exchange/codes', data);
  },

  /** Annuler un code */
  cancelCode(id: number) {
    return apiClient.delete(`/key-exchange/codes/${id}`);
  },

  // ─── Events ───────────────────────────────────────────────

  /** Historique pagine des evenements */
  getEvents(params?: { propertyId?: number; page?: number; size?: number }) {
    const query = new URLSearchParams();
    if (params?.propertyId) query.set('propertyId', String(params.propertyId));
    if (params?.page !== undefined) query.set('page', String(params.page));
    if (params?.size !== undefined) query.set('size', String(params.size));
    const qs = query.toString();
    return apiClient.get<KeyExchangeEventsPage>(`/key-exchange/events${qs ? `?${qs}` : ''}`);
  },

  // ─── KeyNest stores (Phase 4) ─────────────────────────────

  /** Rechercher les points KeyNest proches */
  searchKeyNestStores(lat: number, lng: number, radiusKm: number = 5) {
    return apiClient.get<KeyNestStoreDto[]>(
      `/key-exchange/keynest/stores?lat=${lat}&lng=${lng}&radius=${radiusKm}`,
    );
  },
};
