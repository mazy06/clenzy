import apiClient from '../apiClient';

/**
 * Code promo / cooptation (vue admin).
 * Le champ {@code usedCount} est incremente atomiquement cote backend a chaque
 * inscription utilisant le code, donc peut bouger entre 2 GET.
 */
export interface PromoCode {
  id: number;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  validFrom: string | null;   // ISO-8601 LocalDateTime
  validUntil: string | null;
  active: boolean;
  description: string | null;
  createdAt: string;
  createdBy: string | null;
}

/**
 * Payload de creation. Le code est normalise UPPER cote backend.
 * {@code validFrom} et {@code validUntil} doivent etre au format ISO-8601
 * sans timezone (LocalDateTime), ex: "2026-06-01T00:00:00".
 */
export interface PromoCodeCreatePayload {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  maxUses?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  description?: string | null;
}

export const promoCodesApi = {
  list(): Promise<PromoCode[]> {
    return apiClient.get<PromoCode[]>('/admin/promo-codes');
  },

  create(payload: PromoCodeCreatePayload): Promise<PromoCode> {
    return apiClient.post<PromoCode>('/admin/promo-codes', payload);
  },

  activate(id: number): Promise<PromoCode> {
    return apiClient.put<PromoCode>(`/admin/promo-codes/${id}/activate`, {});
  },

  deactivate(id: number): Promise<PromoCode> {
    return apiClient.put<PromoCode>(`/admin/promo-codes/${id}/deactivate`, {});
  },
};
