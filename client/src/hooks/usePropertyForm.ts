import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { propertiesApi, usersApi } from '../services/api';
import { propertySchema } from '../schemas';
import type { PropertyFormValues } from '../schemas';
import { extractApiList } from '../types';
import { propertyDetailsKeys } from './usePropertyDetails';
import { propertiesListKeys } from './usePropertiesList';

// ============================================================================
// Types
// ============================================================================

export interface FormUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface UsePropertyFormReturn {
  // Form (react-hook-form)
  control: ReturnType<typeof useForm<PropertyFormValues>>['control'];
  errors: ReturnType<typeof useForm<PropertyFormValues>>['formState']['errors'];
  handleSubmit: ReturnType<typeof useForm<PropertyFormValues>>['handleSubmit'];
  setValue: ReturnType<typeof useForm<PropertyFormValues>>['setValue'];
  // Queries
  users: FormUser[];
  isLoadingProperty: boolean;
  isLoadingUsers: boolean;
  // Mutation
  submitForm: (data: PropertyFormValues) => void;
  isSubmitting: boolean;
  isSuccess: boolean;
  submitError: string | null;
}

// ============================================================================
// Query keys
// ============================================================================

export const propertyFormKeys = {
  all: ['property-form'] as const,
  users: () => [...propertyFormKeys.all, 'users'] as const,
  property: (id: number) => [...propertyFormKeys.all, 'property', id] as const,
};

// ============================================================================
// Default form values
// ============================================================================

const DEFAULT_VALUES: PropertyFormValues = {
  name: '',
  address: '',
  city: '',
  postalCode: '',
  country: 'France',
  type: 'APARTMENT',
  status: 'ACTIVE',
  bedroomCount: 1,
  bathroomCount: 1,
  squareMeters: 0,
  nightlyPrice: 0,
  description: '',
  maxGuests: 2,
  cleaningFrequency: 'AFTER_EACH_STAY',
  ownerId: 0,
  defaultCheckInTime: '15:00',
  defaultCheckOutTime: '11:00',
  cleaningBasePrice: undefined,
  numberOfFloors: undefined,
  hasExterior: false,
  hasLaundry: true,
  windowCount: 0,
  frenchDoorCount: 0,
  slidingDoorCount: 0,
  hasIroning: false,
  hasDeepKitchen: false,
  hasDisinfection: false,
  amenities: [],
  cleaningNotes: undefined,
};

// ============================================================================
// Hook
// ============================================================================

interface UsePropertyFormParams {
  propertyId?: number;
  isEditMode: boolean;
  onSuccess?: () => void;
  onNavigate?: (path: string) => void;
}

export function usePropertyForm({
  propertyId,
  isEditMode,
  onSuccess,
  onNavigate,
}: UsePropertyFormParams): UsePropertyFormReturn {
  const queryClient = useQueryClient();

  // ─── React Hook Form ────────────────────────────────────────────────
  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema) as any,
    defaultValues: DEFAULT_VALUES,
  });

  // ─── Users query (for owner dropdown) ───────────────────────────────
  const usersQuery = useQuery({
    queryKey: propertyFormKeys.users(),
    queryFn: async () => {
      const data = await usersApi.getAll();
      return extractApiList<FormUser>(data);
    },
    staleTime: 120_000,
  });

  // ─── Property query (edit mode only) ────────────────────────────────
  const propertyQuery = useQuery({
    queryKey: propertyFormKeys.property(propertyId ?? 0),
    queryFn: () => propertiesApi.getById(propertyId!),
    enabled: isEditMode && !!propertyId,
    staleTime: 60_000,
  });

  // Reset form when property data arrives (edit mode)
  useEffect(() => {
    if (!propertyQuery.data) return;
    const p = propertyQuery.data;
    reset({
      name: p.name || '',
      address: p.address || '',
      city: p.city || '',
      postalCode: p.postalCode || '',
      country: p.country || '',
      type: p.type?.toUpperCase() || 'APARTMENT',
      status: p.status?.toUpperCase() || 'ACTIVE',
      bedroomCount: p.bedroomCount || 1,
      bathroomCount: p.bathroomCount || 1,
      squareMeters: p.squareMeters || 0,
      nightlyPrice: p.nightlyPrice || 0,
      description: p.description || '',
      maxGuests: p.maxGuests || 2,
      cleaningFrequency: p.cleaningFrequency?.toUpperCase() || 'AFTER_EACH_STAY',
      ownerId: p.ownerId || 0,
      defaultCheckInTime: p.defaultCheckInTime || '15:00',
      defaultCheckOutTime: p.defaultCheckOutTime || '11:00',
      cleaningBasePrice: p.cleaningBasePrice ?? undefined,
      numberOfFloors: p.numberOfFloors ?? undefined,
      hasExterior: p.hasExterior ?? false,
      hasLaundry: p.hasLaundry ?? true,
      windowCount: p.windowCount ?? 0,
      frenchDoorCount: p.frenchDoorCount ?? 0,
      slidingDoorCount: p.slidingDoorCount ?? 0,
      hasIroning: p.hasIroning ?? false,
      hasDeepKitchen: p.hasDeepKitchen ?? false,
      hasDisinfection: p.hasDisinfection ?? false,
      amenities: p.amenities || [],
      cleaningNotes: p.cleaningNotes ?? undefined,
    });
  }, [propertyQuery.data, reset]);

  // ─── Submit mutation ────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async (formData: PropertyFormValues) => {
      const backendData = {
        name: formData.name,
        address: formData.address,
        city: formData.city,
        postalCode: formData.postalCode,
        country: formData.country,
        type: formData.type,
        status: formData.status,
        bedroomCount: formData.bedroomCount,
        bathroomCount: formData.bathroomCount,
        squareMeters: formData.squareMeters,
        nightlyPrice: formData.nightlyPrice,
        description: formData.description,
        maxGuests: formData.maxGuests,
        cleaningFrequency: formData.cleaningFrequency,
        ownerId: formData.ownerId,
        defaultCheckInTime: formData.defaultCheckInTime,
        defaultCheckOutTime: formData.defaultCheckOutTime,
        cleaningBasePrice: formData.cleaningBasePrice,
        numberOfFloors: formData.numberOfFloors,
        hasExterior: formData.hasExterior,
        hasLaundry: formData.hasLaundry,
        windowCount: formData.windowCount,
        frenchDoorCount: formData.frenchDoorCount,
        slidingDoorCount: formData.slidingDoorCount,
        hasIroning: formData.hasIroning,
        hasDeepKitchen: formData.hasDeepKitchen,
        hasDisinfection: formData.hasDisinfection,
        amenities: formData.amenities,
        cleaningNotes: formData.cleaningNotes,
      };

      if (isEditMode && propertyId) {
        return propertiesApi.update(propertyId, backendData);
      }
      return propertiesApi.create(backendData);
    },
    onSuccess: () => {
      // Invalidate related caches
      queryClient.invalidateQueries({ queryKey: propertyDetailsKeys.all });
      queryClient.invalidateQueries({ queryKey: propertiesListKeys.all });
      queryClient.invalidateQueries({ queryKey: ['planning'] });

      // Navigate after short delay for UX
      setTimeout(() => {
        if (isEditMode && propertyId) {
          onNavigate?.(`/properties/${propertyId}`);
        } else {
          onSuccess?.();
        }
      }, 1200);
    },
  });

  // ─── Derived state ──────────────────────────────────────────────────
  const submitError = mutation.error
    ? ((mutation.error as { message?: string }).message ?? 'Erreur inconnue')
    : null;

  return {
    control,
    errors,
    handleSubmit,
    setValue,
    users: usersQuery.data ?? [],
    isLoadingProperty: propertyQuery.isLoading && isEditMode,
    isLoadingUsers: usersQuery.isLoading,
    submitForm: mutation.mutate,
    isSubmitting: mutation.isPending,
    isSuccess: mutation.isSuccess,
    submitError,
  };
}
