import apiClient from '../apiClient';

/** Statistiques d'avis d'un logement — GET /api/reviews/stats/{propertyId} (org-scopé par le JWT). */
export interface ReviewStats {
  propertyId: number;
  averageRating: number;
  totalReviews: number;
  ratingDistribution?: Record<string, number>;
  sentimentBreakdown?: Record<string, number>;
}

export const reviewsApi = {
  /** Note moyenne + nombre d'avis d'un logement. */
  getStats(propertyId: number): Promise<ReviewStats> {
    return apiClient.get<ReviewStats>(`/reviews/stats/${propertyId}`);
  },
};
