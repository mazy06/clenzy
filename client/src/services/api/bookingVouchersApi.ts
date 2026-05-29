import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Type de declenchement d'un voucher. */
export type VoucherType = 'MANUAL_CODE' | 'AUTO_CAMPAIGN';

/** Type de remise (semantique de discountValue depend de ce type). */
export type VoucherDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_NIGHTS';

/** Etat du cycle de vie d'un voucher. */
export type VoucherStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED';

/** Canal autorise pour l'application d'un voucher. */
export type VoucherChannelScope = 'ALL' | 'BOOKING_ENGINE' | 'DIRECT_LINK' | 'WHATSAPP' | 'EMAIL';

/** Type d'organisation creatrice du voucher. */
export type VoucherCreatorOrgType = 'HOST' | 'MANAGEMENT_ORG';

/**
 * Codes d'erreur retournes par l'endpoint public /validate. Sert a la
 * traduction i18n du message d'erreur cote frontend (chaque code = 1 message).
 */
export type VoucherValidationError =
  | 'NOT_FOUND'
  | 'DRAFT_NOT_ACTIVE'
  | 'PAUSED'
  | 'EXPIRED'
  | 'NOT_YET_ACTIVE'
  | 'PROPERTY_NOT_IN_SCOPE'
  | 'MIN_STAY_NOT_MET'
  | 'MAX_STAY_EXCEEDED'
  | 'MIN_TOTAL_NOT_MET'
  | 'USAGE_LIMIT_REACHED'
  | 'GUEST_LIMIT_REACHED'
  | 'CHANNEL_NOT_ALLOWED'
  | 'INVALID_INPUT';

/**
 * Voucher tel que retourne par l'API admin.
 */
export interface BookingVoucher {
  id: number;
  organizationId: number;
  name: string;
  description: string | null;
  /** Code texte (NULL pour les AUTO_CAMPAIGN). */
  code: string | null;
  type: VoucherType;
  discountType: VoucherDiscountType;
  /** Decimal en string pour eviter les pertes de precision JS. */
  discountValue: string;
  validFrom: string | null;
  validUntil: string | null;
  minStayNights: number | null;
  minTotalAmount: string | null;
  maxStayNights: number | null;
  maxUsesTotal: number | null;
  maxUsesPerGuest: number | null;
  usageCount: number;
  channelScope: VoucherChannelScope;
  status: VoucherStatus;
  createdByOrgType: VoucherCreatorOrgType;
  createdByUserId: number | null;
  /** Liste vide = applicable a toutes les properties de l'org. */
  propertyIds: number[];
  createdAt: string;
  updatedAt: string;
}

/** Payload pour la creation d'un voucher (POST /api/vouchers). */
export interface BookingVoucherCreateRequest {
  name: string;
  description?: string | null;
  code?: string | null;
  type: VoucherType;
  discountType: VoucherDiscountType;
  discountValue: number | string;
  validFrom?: string | null;
  validUntil?: string | null;
  minStayNights?: number | null;
  minTotalAmount?: number | string | null;
  maxStayNights?: number | null;
  maxUsesTotal?: number | null;
  maxUsesPerGuest?: number | null;
  channelScope?: VoucherChannelScope;
  status?: VoucherStatus;
  propertyIds?: number[];
}

/** Payload pour l'edition d'un voucher (PUT /api/vouchers/{id}). Tous les champs optionnels. */
export type BookingVoucherUpdateRequest = Partial<BookingVoucherCreateRequest>;

// ─── Public endpoint (booking engine guest) ──────────────────────────────────

export interface VoucherValidationRequest {
  organizationId: number;
  code: string;
  propertyId: number;
  stayNights: number;
  /** Decimal en string ou number. */
  subtotal: number | string;
  guestEmail?: string | null;
  channel: VoucherChannelScope;
}

export interface VoucherValidationResponse {
  valid: boolean;
  /** Echo du code valide (UI display). NULL si invalid. */
  code: string | null;
  discountAmount: string | null;
  finalTotal: string | null;
  /** NULL si valid. Sert a la traduction i18n. */
  errorCode: VoucherValidationError | null;
  errorMessage: string | null;
}

// ─── Analytics ──────────────────────────────────────────────────────────────

/** Stats individuelles d'un voucher (renvoye par /analytics et /{id}/analytics). */
export interface VoucherStats {
  voucherId: number;
  voucherName: string;
  voucherCode: string | null;
  usageCount: number;
  totalGross: string;
  totalDiscount: string;
  totalNet: string;
  avgDiscountPct: string;
}

/** Reponse /api/vouchers/analytics — aggregation org-level. */
export interface VoucherAnalytics {
  from: string;
  to: string;
  totalUsages: number;
  totalGross: string;
  totalDiscount: string;
  totalNet: string;
  activeVouchersCount: number;
  topVouchers: VoucherStats[];
}

// ─── API ─────────────────────────────────────────────────────────────────────

const BASE_ADMIN = '/vouchers';
const BASE_PUBLIC = '/public/vouchers';

export const bookingVouchersApi = {
  // ── Admin (PMS) ─────────────────────────────────────────────────────────
  list: (statusFilter?: VoucherStatus): Promise<BookingVoucher[]> => {
    const qs = statusFilter ? `?status=${statusFilter}` : '';
    return apiClient.get(`${BASE_ADMIN}${qs}`);
  },

  getById: (id: number): Promise<BookingVoucher> =>
    apiClient.get(`${BASE_ADMIN}/${id}`),

  create: (payload: BookingVoucherCreateRequest): Promise<BookingVoucher> =>
    apiClient.post(BASE_ADMIN, payload),

  update: (id: number, payload: BookingVoucherUpdateRequest): Promise<BookingVoucher> =>
    apiClient.put(`${BASE_ADMIN}/${id}`, payload),

  delete: (id: number): Promise<void> =>
    apiClient.delete(`${BASE_ADMIN}/${id}`),

  pause: (id: number): Promise<BookingVoucher> =>
    apiClient.post(`${BASE_ADMIN}/${id}/pause`, {}),

  resume: (id: number): Promise<BookingVoucher> =>
    apiClient.post(`${BASE_ADMIN}/${id}/resume`, {}),

  // ── Analytics (admin) ────────────────────────────────────────────────────
  /**
   * Aggregation cross-vouchers de l'org. `from`/`to` optionnels : default = 30 derniers jours.
   */
  getAnalytics: (from?: string, to?: string): Promise<VoucherAnalytics> => {
    const params: string[] = [];
    if (from) params.push(`from=${encodeURIComponent(from)}`);
    if (to) params.push(`to=${encodeURIComponent(to)}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    return apiClient.get(`${BASE_ADMIN}/analytics${qs}`);
  },

  getVoucherStats: (id: number): Promise<VoucherStats> =>
    apiClient.get(`${BASE_ADMIN}/${id}/analytics`),

  // ── Public (booking engine guest) ────────────────────────────────────────
  validate: (payload: VoucherValidationRequest): Promise<VoucherValidationResponse> =>
    apiClient.post(`${BASE_PUBLIC}/validate`, payload),
};
