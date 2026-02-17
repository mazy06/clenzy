import { useQuery } from '@tanstack/react-query';
import { propertiesApi, interventionsApi } from '../services/api';
import type { Property } from '../services/api/propertiesApi';
import type { Intervention as ApiIntervention } from '../services/api/interventionsApi';
import { extractApiList } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface PropertyDetailsData {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  propertyType: string;
  status: string;
  nightlyPrice: number;
  bedrooms: number;
  bathrooms: number;
  surfaceArea: number;
  description: string;
  amenities: string[];
  cleaningFrequency: string;
  maxGuests: number;
  contactPhone: string;
  contactEmail: string;
  rating?: number;
  lastCleaning?: string;
  nextCleaning?: string;
  ownerId?: string;
  ownerName?: string;
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
  // Tarification ménage
  cleaningBasePrice?: number;
  cleaningDurationMinutes?: number;
  numberOfFloors?: number;
  hasExterior?: boolean;
  hasLaundry?: boolean;
  // Prestations à la carte
  windowCount?: number;
  frenchDoorCount?: number;
  slidingDoorCount?: number;
  hasIroning?: boolean;
  hasDeepKitchen?: boolean;
  hasDisinfection?: boolean;
  cleaningNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PropertyIntervention {
  id: string;
  type: string;
  status: string;
  scheduledDate: string;
  description: string;
  assignedTo?: string;
  cost?: number;
}

// ============================================================================
// Query keys (exported for cross-module invalidation)
// ============================================================================

export const propertyDetailsKeys = {
  all: ['property-details'] as const,
  detail: (id: string) => [...propertyDetailsKeys.all, id] as const,
  interventions: (id: string) => [...propertyDetailsKeys.all, id, 'interventions'] as const,
};

// ============================================================================
// Conversion helpers
// ============================================================================

function convertProperty(raw: Property): PropertyDetailsData {
  return {
    id: raw.id.toString(),
    name: raw.name,
    address: raw.address,
    city: raw.city,
    postalCode: raw.postalCode,
    country: raw.country,
    propertyType: raw.type?.toLowerCase() || 'apartment',
    status: raw.status?.toLowerCase() || 'active',
    nightlyPrice: raw.nightlyPrice || 0,
    bedrooms: raw.bedroomCount || 1,
    bathrooms: raw.bathroomCount || 1,
    surfaceArea: raw.squareMeters || 0,
    description: raw.description || '',
    amenities: raw.amenities || [],
    cleaningFrequency: raw.cleaningFrequency?.toLowerCase() || 'after_each_stay',
    maxGuests: raw.maxGuests || 2,
    contactPhone: '',
    contactEmail: '',
    rating: 4.5,
    lastCleaning: undefined,
    nextCleaning: undefined,
    ownerId: raw.ownerId?.toString(),
    ownerName: raw.ownerName,
    defaultCheckInTime: raw.defaultCheckInTime,
    defaultCheckOutTime: raw.defaultCheckOutTime,
    cleaningBasePrice: raw.cleaningBasePrice,
    cleaningDurationMinutes: raw.cleaningDurationMinutes,
    numberOfFloors: raw.numberOfFloors,
    hasExterior: raw.hasExterior,
    hasLaundry: raw.hasLaundry,
    windowCount: raw.windowCount,
    frenchDoorCount: raw.frenchDoorCount,
    slidingDoorCount: raw.slidingDoorCount,
    hasIroning: raw.hasIroning,
    hasDeepKitchen: raw.hasDeepKitchen,
    hasDisinfection: raw.hasDisinfection,
    cleaningNotes: raw.cleaningNotes,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function convertIntervention(raw: ApiIntervention): PropertyIntervention {
  return {
    id: raw.id.toString(),
    type: raw.type,
    status: raw.status,
    scheduledDate: raw.scheduledDate,
    description: raw.description || '',
    assignedTo: raw.assignedToName,
    cost: raw.estimatedCost ?? raw.actualCost,
  };
}

// ============================================================================
// Hook
// ============================================================================

export interface UsePropertyDetailsReturn {
  property: PropertyDetailsData | undefined;
  interventions: PropertyIntervention[];
  isLoading: boolean;
  isError: boolean;
  error: string | null;
}

export function usePropertyDetails(id: string | undefined): UsePropertyDetailsReturn {
  const numericId = id ? Number(id) : undefined;
  const enabled = !!numericId && !isNaN(numericId);

  // ─── Property query ─────────────────────────────────────────────────
  const propertyQuery = useQuery({
    queryKey: propertyDetailsKeys.detail(id ?? ''),
    queryFn: () => propertiesApi.getById(numericId!),
    enabled,
    staleTime: 60_000,
    select: convertProperty,
  });

  // ─── Interventions query ────────────────────────────────────────────
  const interventionsQuery = useQuery({
    queryKey: propertyDetailsKeys.interventions(id ?? ''),
    queryFn: async () => {
      const data = await interventionsApi.getAll({ propertyId: numericId! });
      return extractApiList<ApiIntervention>(data).map(convertIntervention);
    },
    enabled,
    staleTime: 60_000,
  });

  return {
    property: propertyQuery.data,
    interventions: interventionsQuery.data ?? [],
    isLoading: propertyQuery.isLoading,
    isError: propertyQuery.isError,
    error: propertyQuery.error
      ? (propertyQuery.error as { message?: string }).message ?? 'Erreur de chargement'
      : null,
  };
}
