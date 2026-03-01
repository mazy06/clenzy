import { apiClient, type PaginatedResponse } from '../apiClient';

/* ─── Types ─── */

export type SentimentLabel = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export type ChannelName = 'AIRBNB' | 'BOOKING' | 'VRBO' | 'GOOGLE_VACATION_RENTALS' | 'HOMEAWAY' | 'TRIPADVISOR' | 'AGODA' | 'HOTELS_COM' | 'DIRECT' | 'OTHER';

export interface GuestReview {
  id: number;
  propertyId: number;
  reservationId: number | null;
  channelName: ChannelName;
  guestName: string;
  rating: number;
  reviewText: string;
  hostResponse: string | null;
  hostRespondedAt: string | null;
  reviewDate: string;
  sentimentScore: number | null;
  sentimentLabel: SentimentLabel | null;
  language: string | null;
  tags: string[];
  isPublic: boolean;
  createdAt: string;
}

export interface ReviewStats {
  propertyId: number;
  averageRating: number | null;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  sentimentBreakdown: Record<SentimentLabel, number>;
}

/* ─── API ─── */

export const reviewsApi = {
  /** Get paginated reviews with optional filters */
  getAll(params?: { propertyId?: number; channel?: ChannelName; page?: number; size?: number }) {
    return apiClient.get<PaginatedResponse<GuestReview>>('/reviews', { params });
  },

  /** Get review stats for a property */
  getStats(propertyId: number) {
    return apiClient.get<ReviewStats>(`/reviews/stats/${propertyId}`);
  },

  /** Respond to a review */
  respond(id: number, response: string) {
    return apiClient.put<GuestReview>(`/reviews/${id}/respond`, { response });
  },

  /** Trigger review sync for a property */
  sync(propertyId: number) {
    return apiClient.post<{ synced: number; propertyId: number }>(`/reviews/sync/${propertyId}`);
  },
};
