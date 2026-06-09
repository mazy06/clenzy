import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AirbnbConnectionStatus {
  connected: boolean;
  airbnbUserId: string | null;
  status: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  scopes: string | null;
  linkedListingsCount: number;
  errorMessage: string | null;
}

export interface AirbnbListingMapping {
  id: number;
  organizationId: number;
  propertyId: number;
  propertyName?: string;
  airbnbListingId: string;
  airbnbListingTitle: string;
  airbnbListingUrl: string;
  syncEnabled: boolean;
  autoCreateInterventions: boolean;
  autoPushPricing: boolean;
  lastSyncAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface LinkListingRequest {
  propertyId: number;
  airbnbListingId: string;
  airbnbListingTitle: string;
  airbnbListingUrl: string;
}

export interface AirbnbMessage {
  id: string;
  reservationId: string;
  threadId: string;
  senderName: string;
  senderRole: string;
  content: string;
  sentAt: string;
  read: boolean;
}

export interface AirbnbReview {
  id: number;
  propertyId: number;
  propertyName: string;
  reservationId: number | null;
  guestName: string;
  rating: number;
  comment: string;
  hostReply: string | null;
  source: string;
  createdAt: string;
}

export interface CreateReviewReply {
  reply: string;
}

export interface GuestProfile {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  totalStays: number;
  lastStayDate: string | null;
  averageRating: number | null;
  specialRequests: string | null;
  notes: string | null;
  reservations: GuestReservationSummary[];
}

export interface GuestReservationSummary {
  id: number;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  source: string;
  totalPrice: number;
}

export interface CheckInInstructions {
  id: number;
  propertyId: number;
  accessCode: string | null;
  wifiName: string | null;
  wifiPassword: string | null;
  parkingInfo: string | null;
  arrivalInstructions: string | null;
  departureInstructions: string | null;
  houseRules: string | null;
  emergencyContact: string | null;
  additionalNotes: string | null;
  /** JSON [{key, caption}] — photos d'indication d'accès. Géré séparément (état accessPhotos). */
  arrivalPhotos?: string | null;
  /** Régénère le code d'accès automatiquement après chaque départ (opt-in par logement). */
  accessCodeAutoRotate?: boolean;
  /** Format JSON ({pattern, letters, symbols}) du générateur, pour régénérer le code côté serveur. */
  accessCodeFormat?: string | null;
  /** JSON [{label, code}] — codes additionnels libres (résidence, immeuble, parking…). */
  extraAccessCodes?: string | null;
  /** Autorise le voyageur à ouvrir la porte depuis le livret (serrure pilotable à distance). */
  guestUnlockEnabled?: boolean;
  updatedAt: string | null;
}

export type UpdateCheckInInstructions = Omit<CheckInInstructions, 'id' | 'propertyId' | 'updatedAt'>;

// ─── API ─────────────────────────────────────────────────────────────────────

const AIRBNB_BASE = '/airbnb';

export const airbnbApi = {
  // ── OAuth ──
  getConnectionStatus: (): Promise<AirbnbConnectionStatus> =>
    apiClient.get(`${AIRBNB_BASE}/status`),

  connect: (): Promise<{ authorizationUrl: string }> =>
    apiClient.get(`${AIRBNB_BASE}/connect`),

  disconnect: (): Promise<void> =>
    apiClient.post(`${AIRBNB_BASE}/disconnect`, {}),

  // ── Listings ──
  getListings: (): Promise<AirbnbListingMapping[]> =>
    apiClient.get(`${AIRBNB_BASE}/listings`),

  linkListing: (data: LinkListingRequest): Promise<AirbnbListingMapping> =>
    apiClient.post(`${AIRBNB_BASE}/listings/link`, data),

  unlinkListing: (propertyId: number): Promise<void> =>
    apiClient.delete(`${AIRBNB_BASE}/listings/${propertyId}/unlink`),

  toggleSync: (propertyId: number, enabled: boolean): Promise<AirbnbListingMapping> =>
    apiClient.put(`${AIRBNB_BASE}/listings/${propertyId}/sync`, undefined, {
      params: { enabled },
    }),

  toggleAutoInterventions: (propertyId: number, enabled: boolean): Promise<AirbnbListingMapping> =>
    apiClient.put(`${AIRBNB_BASE}/listings/${propertyId}/auto-interventions`, undefined, {
      params: { enabled },
    }),

  toggleAutoPushPricing: (propertyId: number, enabled: boolean): Promise<AirbnbListingMapping> =>
    apiClient.put(`${AIRBNB_BASE}/listings/${propertyId}/auto-push-pricing`, undefined, {
      params: { enabled },
    }),

  // ── Messages ──
  getMessages: (reservationId?: string): Promise<AirbnbMessage[]> =>
    apiClient.get(`${AIRBNB_BASE}/messages`, {
      params: reservationId ? { reservationId } : undefined,
    }),

  // ── Reviews ──
  getReviews: (params?: { propertyId?: number; page?: number; size?: number }): Promise<AirbnbReview[]> =>
    apiClient.get(`${AIRBNB_BASE}/reviews`, { params }),

  replyToReview: (reviewId: number, data: CreateReviewReply): Promise<AirbnbReview> =>
    apiClient.post(`${AIRBNB_BASE}/reviews/${reviewId}/reply`, data),

  // ── Guest Profiles ──
  getGuestProfile: (guestId: number): Promise<GuestProfile> =>
    apiClient.get(`/guests/${guestId}`),

  getGuestsByProperty: (propertyId: number): Promise<GuestProfile[]> =>
    apiClient.get(`/guests/property/${propertyId}`),

  updateGuestNotes: (guestId: number, notes: string): Promise<GuestProfile> =>
    apiClient.put(`/guests/${guestId}/notes`, { notes }),

  // ── Check-in Instructions ──
  getCheckInInstructions: (propertyId: number): Promise<CheckInInstructions> =>
    apiClient.get(`/properties/${propertyId}/check-in-instructions`),

  updateCheckInInstructions: (propertyId: number, data: UpdateCheckInInstructions): Promise<CheckInInstructions> =>
    apiClient.put(`/properties/${propertyId}/check-in-instructions`, data),

  /** Code d'accès courant généré par la serrure connectée (séjour en cours/à venir), pour pré-remplir le champ. */
  getSmartLockCode: (propertyId: number): Promise<{ hasSmartLock: boolean; code: string }> =>
    apiClient.get(`/properties/${propertyId}/check-in-instructions/smart-lock-code`),

  /** Upload d'une photo d'indication d'accès → renvoie la clé de stockage à placer dans arrivalPhotos. */
  uploadAccessPhoto: (propertyId: number, file: File): Promise<{ key: string }> => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.upload(`/properties/${propertyId}/check-in-instructions/access-photos`, form);
  },

  // ── Channel Health (per-property) ──
  getPropertyChannelStatus: (propertyId: number): Promise<{
    airbnb: { linked: boolean; syncEnabled: boolean; lastSyncAt: string | null; status: string };
  }> =>
    apiClient.get(`/properties/${propertyId}/channels`),
};
