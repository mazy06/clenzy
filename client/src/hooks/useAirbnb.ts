import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { airbnbApi } from '../services/api/airbnbApi';
import { propertiesApi } from '../services/api/propertiesApi';
import type {
  AirbnbConnectionStatus,
  AirbnbListingMapping,
  LinkListingRequest,
} from '../services/api/airbnbApi';
import type { Property } from '../services/api/propertiesApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const airbnbKeys = {
  all: ['airbnb'] as const,
  connectionStatus: () => [...airbnbKeys.all, 'status'] as const,
  listings: () => [...airbnbKeys.all, 'listings'] as const,
  properties: () => [...airbnbKeys.all, 'properties'] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

export function useAirbnbConnectionStatus() {
  return useQuery<AirbnbConnectionStatus>({
    queryKey: airbnbKeys.connectionStatus(),
    queryFn: () => airbnbApi.getConnectionStatus(),
    staleTime: 30_000,
  });
}

export function useAirbnbListings() {
  return useQuery<AirbnbListingMapping[]>({
    queryKey: airbnbKeys.listings(),
    queryFn: () => airbnbApi.getListings(),
    staleTime: 30_000,
  });
}

/**
 * Raw properties for linking to Airbnb listings.
 * Uses a separate query key scoped under 'airbnb' to avoid
 * conflicts with the properties-list hook that returns converted data.
 */
export function useChannelProperties() {
  return useQuery<Property[]>({
    queryKey: airbnbKeys.properties(),
    queryFn: () => propertiesApi.getAll(),
    staleTime: 60_000,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useAirbnbConnect() {
  return useMutation({
    mutationFn: () => airbnbApi.connect(),
  });
}

export function useAirbnbDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => airbnbApi.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: airbnbKeys.connectionStatus() });
      queryClient.invalidateQueries({ queryKey: airbnbKeys.listings() });
    },
  });
}

export function useToggleSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, enabled }: { propertyId: number; enabled: boolean }) =>
      airbnbApi.toggleSync(propertyId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: airbnbKeys.listings() });
    },
  });
}

export function useToggleAutoInterventions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, enabled }: { propertyId: number; enabled: boolean }) =>
      airbnbApi.toggleAutoInterventions(propertyId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: airbnbKeys.listings() });
    },
  });
}

export function useToggleAutoPushPricing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, enabled }: { propertyId: number; enabled: boolean }) =>
      airbnbApi.toggleAutoPushPricing(propertyId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: airbnbKeys.listings() });
    },
  });
}

export function useLinkListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LinkListingRequest) => airbnbApi.linkListing(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: airbnbKeys.listings() });
      queryClient.invalidateQueries({ queryKey: airbnbKeys.connectionStatus() });
    },
  });
}

export function useUnlinkListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (propertyId: number) => airbnbApi.unlinkListing(propertyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: airbnbKeys.listings() });
      queryClient.invalidateQueries({ queryKey: airbnbKeys.connectionStatus() });
    },
  });
}
