import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { propertiesApi } from '../services/api';
import type { Property as ApiProperty } from '../services/api/propertiesApi';
import { extractApiList } from '../types';
import { useAuth } from './useAuth';

// ============================================================================
// Types
// ============================================================================

export interface PropertyListItem {
  id: string;
  name: string;
  type: 'apartment' | 'house' | 'villa' | 'studio';
  address: string;
  city: string;
  postalCode?: string;
  country?: string;
  status: 'active' | 'inactive' | 'maintenance';
  rating: number;
  nightlyPrice: number;
  guests: number;
  bedrooms: number;
  bathrooms: number;
  squareMeters?: number;
  description?: string;
  amenities?: string[];
  cleaningFrequency?: string;
  contactPhone?: string;
  contactEmail?: string;
  imageUrl?: string;
  lastCleaning?: string;
  nextCleaning?: string;
  ownerId?: string;
  createdAt?: string;
  cleaningBasePrice?: number;
  numberOfFloors?: number;
  hasExterior?: boolean;
  hasLaundry?: boolean;
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
}

// ============================================================================
// Query keys (exported for cross-module invalidation)
// ============================================================================

export const propertiesListKeys = {
  all: ['properties-list'] as const,
  list: (userId: string | undefined) =>
    [...propertiesListKeys.all, userId ?? 'all'] as const,
};

// ============================================================================
// Converter
// ============================================================================

function convertProperty(raw: ApiProperty): PropertyListItem {
  return {
    id: raw.id.toString(),
    name: raw.name,
    type: (raw.type?.toLowerCase() || 'apartment') as PropertyListItem['type'],
    address: raw.address,
    city: raw.city,
    postalCode: raw.postalCode,
    country: raw.country,
    status: (raw.status?.toLowerCase() || 'active') as PropertyListItem['status'],
    rating: 4.5,
    nightlyPrice: raw.nightlyPrice || 0,
    guests: raw.maxGuests || 2,
    bedrooms: raw.bedroomCount || 1,
    bathrooms: raw.bathroomCount || 1,
    squareMeters: raw.squareMeters,
    description: raw.description,
    amenities: raw.amenities || [],
    cleaningFrequency: raw.cleaningFrequency || 'ON_DEMAND',
    contactPhone: '',
    contactEmail: '',
    imageUrl: undefined,
    lastCleaning: undefined,
    nextCleaning: undefined,
    ownerId: raw.ownerId?.toString(),
    createdAt: raw.createdAt,
    cleaningBasePrice: raw.cleaningBasePrice,
    numberOfFloors: raw.numberOfFloors,
    hasExterior: raw.hasExterior,
    hasLaundry: raw.hasLaundry,
    defaultCheckInTime: raw.defaultCheckInTime,
    defaultCheckOutTime: raw.defaultCheckOutTime,
  };
}

// ============================================================================
// Hook
// ============================================================================

export interface UsePropertiesListReturn {
  properties: PropertyListItem[];
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  deleteProperty: (id: string) => void;
  isDeleting: boolean;
}

export function usePropertiesList(): UsePropertiesListReturn {
  const { user, isAdmin, isManager, isHost } = useAuth();
  const queryClient = useQueryClient();

  const isHostOnly = isHost() && !isAdmin() && !isManager();
  const userId = isHostOnly ? user?.id?.toString() : undefined;

  // ─── Properties query ──────────────────────────────────────────────
  const propertiesQuery = useQuery({
    queryKey: propertiesListKeys.list(userId),
    queryFn: async () => {
      const params = isHostOnly && user?.id ? { ownerId: user.id } : undefined;
      const data = await propertiesApi.getAll(params);
      return extractApiList<ApiProperty>(data).map(convertProperty);
    },
    staleTime: 60_000,
  });

  // ─── Delete mutation ───────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => propertiesApi.delete(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertiesListKeys.all });
      queryClient.invalidateQueries({ queryKey: ['property-details'] });
    },
  });

  return useMemo(() => ({
    properties: propertiesQuery.data ?? [],
    isLoading: propertiesQuery.isLoading,
    isError: propertiesQuery.isError,
    error: propertiesQuery.error
      ? (propertiesQuery.error as { message?: string }).message ?? 'Erreur de chargement'
      : null,
    deleteProperty: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  }), [propertiesQuery.data, propertiesQuery.isLoading, propertiesQuery.isError, propertiesQuery.error, deleteMutation.mutate, deleteMutation.isPending]);
}
