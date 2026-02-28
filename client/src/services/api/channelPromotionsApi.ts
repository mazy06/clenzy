import apiClient from '../apiClient';

// ─── Enums ──────────────────────────────────────────────────────────────────

export type ChannelName = 'AIRBNB' | 'BOOKING';

export type PromotionType =
  | 'genius'
  | 'preferred_partner'
  | 'visibility_booster'
  | 'mobile_rate'
  | 'country_rate'
  | 'early_bird_ota'
  | 'flash_sale'
  | 'long_stay_ota';

export type PromotionStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'REJECTED';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ChannelPromotion {
  id: number;
  propertyId: number;
  channelName: ChannelName;
  promotionType: PromotionType;
  enabled: boolean;
  config: Record<string, unknown> | null;
  discountPercentage: number | null;
  startDate: string | null;
  endDate: string | null;
  status: PromotionStatus;
  externalPromotionId: string | null;
  syncedAt: string | null;
  createdAt: string;
}

export interface CreateChannelPromotionData {
  propertyId: number;
  channelName: ChannelName;
  promotionType: PromotionType;
  discountPercentage?: number;
  startDate?: string;
  endDate?: string;
  config?: Record<string, unknown>;
}

// ─── Display helpers ────────────────────────────────────────────────────────

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  genius: 'Genius',
  preferred_partner: 'Preferred Partner',
  visibility_booster: 'Visibility Booster',
  mobile_rate: 'Mobile Rate',
  country_rate: 'Country Rate',
  early_bird_ota: 'Early Bird',
  flash_sale: 'Flash Sale',
  long_stay_ota: 'Long Stay',
};

export const PROMOTION_STATUS_COLORS: Record<PromotionStatus, string> = {
  PENDING: '#D4A574',
  ACTIVE: '#4A9B8E',
  EXPIRED: '#9e9e9e',
  REJECTED: '#d32f2f',
};

// ─── API ────────────────────────────────────────────────────────────────────

export const channelPromotionsApi = {
  async getAll(propertyId?: number): Promise<ChannelPromotion[]> {
    const params: Record<string, string | number | boolean | null | undefined> = {};
    if (propertyId) params.propertyId = propertyId;
    return apiClient.get<ChannelPromotion[]>('/channel-promotions', { params });
  },

  async getById(id: number): Promise<ChannelPromotion> {
    return apiClient.get<ChannelPromotion>(`/channel-promotions/${id}`);
  },

  async create(data: CreateChannelPromotionData): Promise<ChannelPromotion> {
    return apiClient.post<ChannelPromotion>('/channel-promotions', data);
  },

  async update(id: number, data: CreateChannelPromotionData): Promise<ChannelPromotion> {
    return apiClient.put<ChannelPromotion>(`/channel-promotions/${id}`, data);
  },

  async toggle(id: number): Promise<ChannelPromotion> {
    return apiClient.put<ChannelPromotion>(`/channel-promotions/${id}/toggle`);
  },

  async sync(propertyId: number): Promise<void> {
    return apiClient.post(`/channel-promotions/sync/${propertyId}`);
  },

  async remove(id: number): Promise<void> {
    return apiClient.delete(`/channel-promotions/${id}`);
  },
};
