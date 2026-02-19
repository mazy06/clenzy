import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { serviceRequestsApi } from '../services/api';

// ============================================================================
// Types
// ============================================================================

export interface ServiceRequestDetailsData {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  // Property
  propertyId: number;
  propertyName: string;
  propertyAddress: string;
  propertyCity: string;
  propertyPostalCode?: string;
  propertyCountry?: string;
  propertyType?: string;
  propertyBedroomCount?: number;
  propertyBathroomCount?: number;
  propertySquareMeters?: number;
  propertyMaxGuests?: number;
  propertyNumberOfFloors?: number;
  propertyHasExterior?: boolean;
  propertyHasLaundry?: boolean;
  propertyCleaningDurationMinutes?: number;
  propertyCleaningBasePrice?: number;
  propertyCleaningNotes?: string;
  propertyDescription?: string;
  // Property add-on services
  propertyHasIroning?: boolean;
  propertyHasDeepKitchen?: boolean;
  propertyHasDisinfection?: boolean;
  propertyWindowCount?: number;
  propertyFrenchDoorCount?: number;
  propertySlidingDoorCount?: number;
  // Source (parsed from specialInstructions)
  importSource?: string;
  // People
  requestorId: number;
  requestorName: string;
  requestorEmail?: string;
  requestorRole?: string;
  assignedToId?: number;
  assignedToName?: string;
  assignedToEmail?: string;
  assignedToType?: 'user' | 'team';
  // Planning
  estimatedDuration: number;
  dueDate: string;
  guestCheckoutTime?: string;
  guestCheckinTime?: string;
  // Costs
  estimatedCost?: number;
  actualCost?: number;
  // Flags
  urgent: boolean;
  requiresApproval: boolean;
  // Notes
  specialInstructions?: string;
  accessNotes?: string;
  // Approval / Devis
  approvedBy?: string;
  approvedAt?: string;
  devisAcceptedBy?: string;
  devisAcceptedAt?: string;
  // System
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

// ============================================================================
// Query keys
// ============================================================================

export const serviceRequestDetailsKeys = {
  all: ['service-request-details'] as const,
  detail: (id: string | undefined) => [...serviceRequestDetailsKeys.all, id] as const,
};

// ============================================================================
// Converter
// ============================================================================

function convertDetail(raw: Record<string, unknown>): ServiceRequestDetailsData {
  const property = raw.property as Record<string, unknown> | undefined;
  const user = raw.user as Record<string, unknown> | undefined;
  const requestor = raw.requestor as Record<string, unknown> | undefined;
  const assignedToUser = raw.assignedToUser as Record<string, unknown> | undefined;
  const assignedToTeam = raw.assignedToTeam as Record<string, unknown> | undefined;

  return {
    id: String(raw.id),
    title: (raw.title as string) || '',
    description: (raw.description as string) || '',
    type: ((raw.type as string) || (raw.serviceType as string) || 'other').toLowerCase(),
    status: (raw.status as string) || 'PENDING',
    priority: ((raw.priority as string) || 'medium').toLowerCase(),
    // Property
    propertyId: (raw.propertyId as number) || 0,
    propertyName: (property?.name as string) || 'Propriété inconnue',
    propertyAddress: (property?.address as string) || '',
    propertyCity: (property?.city as string) || '',
    propertyPostalCode: (property?.postalCode as string) || undefined,
    propertyCountry: (property?.country as string) || undefined,
    propertyType: (property?.type as string) || undefined,
    propertyBedroomCount: (property?.bedroomCount as number) || undefined,
    propertyBathroomCount: (property?.bathroomCount as number) || undefined,
    propertySquareMeters: (property?.squareMeters as number) || undefined,
    propertyMaxGuests: (property?.maxGuests as number) || undefined,
    propertyNumberOfFloors: (property?.numberOfFloors as number) || undefined,
    propertyHasExterior: (property?.hasExterior as boolean) || undefined,
    propertyHasLaundry: (property?.hasLaundry as boolean) || undefined,
    propertyCleaningDurationMinutes: (property?.cleaningDurationMinutes as number) || undefined,
    propertyCleaningBasePrice: (property?.cleaningBasePrice as number) || undefined,
    propertyCleaningNotes: (property?.cleaningNotes as string) || undefined,
    propertyDescription: (property?.description as string) || undefined,
    // Property add-on services
    propertyHasIroning: (property?.hasIroning as boolean) || undefined,
    propertyHasDeepKitchen: (property?.hasDeepKitchen as boolean) || undefined,
    propertyHasDisinfection: (property?.hasDisinfection as boolean) || undefined,
    propertyWindowCount: (property?.windowCount as number) || undefined,
    propertyFrenchDoorCount: (property?.frenchDoorCount as number) || undefined,
    propertySlidingDoorCount: (property?.slidingDoorCount as number) || undefined,
    // Source — parse from specialInstructions [SOURCE:xxx]
    importSource: (() => {
      const si = (raw.specialInstructions as string) || '';
      const match = si.match(/\[SOURCE:(\w+)\]/i);
      return match ? match[1] : undefined;
    })(),
    // People
    requestorId: (raw.userId as number) || (raw.requestorId as number) || 0,
    requestorName: user
      ? `${user.firstName} ${user.lastName}`
      : requestor
        ? `${requestor.firstName} ${requestor.lastName}`
        : 'Demandeur inconnu',
    requestorEmail: (user?.email as string) || (requestor?.email as string) || undefined,
    requestorRole: (user?.role as string) || (requestor?.role as string) || undefined,
    assignedToId: (raw.assignedToId as number) || undefined,
    assignedToName: assignedToUser
      ? `${assignedToUser.firstName} ${assignedToUser.lastName}`
      : assignedToTeam
        ? (assignedToTeam.name as string)
        : undefined,
    assignedToEmail: (assignedToUser?.email as string) || undefined,
    assignedToType: ((raw.assignedToType as string) || (assignedToUser ? 'user' : assignedToTeam ? 'team' : undefined)) as
      | 'user'
      | 'team'
      | undefined,
    // Planning
    estimatedDuration: (raw.estimatedDurationHours as number) || (raw.estimatedDuration as number) || 1,
    dueDate: (raw.desiredDate as string) || (raw.dueDate as string) || '',
    guestCheckoutTime: (raw.guestCheckoutTime as string) || undefined,
    guestCheckinTime: (raw.guestCheckinTime as string) || undefined,
    // Costs
    estimatedCost: (raw.estimatedCost as number) || undefined,
    actualCost: (raw.actualCost as number) || undefined,
    // Flags
    urgent: (raw.urgent as boolean) || false,
    requiresApproval: (raw.requiresApproval as boolean) || false,
    // Notes
    specialInstructions: (raw.specialInstructions as string) || undefined,
    accessNotes: (raw.accessNotes as string) || undefined,
    // Approval / Devis
    approvedBy: (raw.approvedBy as string) || undefined,
    approvedAt: (raw.approvedAt as string) || undefined,
    devisAcceptedBy: (raw.devisAcceptedBy as string) || undefined,
    devisAcceptedAt: (raw.devisAcceptedAt as string) || undefined,
    // System
    createdAt: (raw.createdAt as string) || '',
    updatedAt: (raw.updatedAt as string) || undefined,
    completedAt: (raw.completedAt as string) || undefined,
  };
}

// ============================================================================
// Hook
// ============================================================================

export interface UseServiceRequestDetailsReturn {
  serviceRequest: ServiceRequestDetailsData | null;
  isLoading: boolean;
  isError: boolean;
  error: string | null;
}

export function useServiceRequestDetails(id: string | undefined): UseServiceRequestDetailsReturn {
  const query = useQuery({
    queryKey: serviceRequestDetailsKeys.detail(id),
    queryFn: async () => {
      if (!id) throw new Error('No ID');
      const data = await serviceRequestsApi.getById(Number(id));
      return convertDetail(data as unknown as Record<string, unknown>);
    },
    enabled: !!id,
    staleTime: 30_000,
  });

  return useMemo(
    () => ({
      serviceRequest: query.data ?? null,
      isLoading: query.isLoading,
      isError: query.isError,
      error: query.error ? (query.error as { message?: string }).message ?? 'Erreur de chargement' : null,
    }),
    [query.data, query.isLoading, query.isError, query.error],
  );
}
