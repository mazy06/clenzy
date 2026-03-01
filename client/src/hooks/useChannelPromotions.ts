import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { channelPromotionsApi } from '../services/api/channelPromotionsApi';
import type { CreateChannelPromotionData } from '../services/api/channelPromotionsApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const channelPromotionsKeys = {
  all: ['channel-promotions'] as const,
  byProperty: (propertyId: number) => [...channelPromotionsKeys.all, 'property', propertyId] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useChannelPromotions(propertyId?: number) {
  return useQuery({
    queryKey: propertyId ? channelPromotionsKeys.byProperty(propertyId) : channelPromotionsKeys.all,
    queryFn: () => channelPromotionsApi.getAll(propertyId),
    staleTime: 60_000,
  });
}

export function useCreatePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateChannelPromotionData) => channelPromotionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelPromotionsKeys.all });
    },
  });
}

export function useUpdatePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateChannelPromotionData }) =>
      channelPromotionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelPromotionsKeys.all });
    },
  });
}

export function useTogglePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => channelPromotionsApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelPromotionsKeys.all });
    },
  });
}

export function useSyncPromotions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (propertyId: number) => channelPromotionsApi.sync(propertyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelPromotionsKeys.all });
    },
  });
}

export function useDeletePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => channelPromotionsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelPromotionsKeys.all });
    },
  });
}
