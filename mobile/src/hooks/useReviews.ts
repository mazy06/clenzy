import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  reviewsApi,
  type GuestReview,
  type ReviewStats,
  type ChannelName,
} from '@/api/endpoints/reviewsApi';
import type { PaginatedResponse } from '@/api/apiClient';

const KEYS = {
  reviews: (propertyId?: number) => ['reviews', propertyId] as const,
  stats: (propertyId: number) => ['review-stats', propertyId] as const,
};

/** Fetch paginated reviews, optionally filtered by property */
export function useReviews(propertyId?: number, channel?: ChannelName) {
  return useQuery<PaginatedResponse<GuestReview>>({
    queryKey: KEYS.reviews(propertyId),
    queryFn: () => reviewsApi.getAll({ propertyId, channel, size: 50 }),
    staleTime: 30_000,
  });
}

/** Fetch review stats for a property */
export function useReviewStats(propertyId: number) {
  return useQuery<ReviewStats>({
    queryKey: KEYS.stats(propertyId),
    queryFn: () => reviewsApi.getStats(propertyId),
    enabled: propertyId > 0,
    staleTime: 60_000,
  });
}

/** Respond to a review */
export function useRespondToReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, response }: { id: number; response: string }) =>
      reviewsApi.respond(id, response),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}

/** Trigger sync */
export function useSyncReviews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (propertyId: number) => reviewsApi.sync(propertyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['review-stats'] });
    },
  });
}
