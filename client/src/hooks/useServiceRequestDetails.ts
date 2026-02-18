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
  propertyId: number;
  propertyName: string;
  propertyAddress: string;
  propertyCity: string;
  propertyPostalCode?: string;
  propertyCountry?: string;
  requestorId: number;
  requestorName: string;
  requestorEmail?: string;
  assignedToId?: number;
  assignedToName?: string;
  assignedToEmail?: string;
  assignedToType?: 'user' | 'team';
  estimatedDuration: number;
  dueDate: string;
  createdAt: string;
  updatedAt?: string;
  approvedAt?: string;
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
    propertyId: (raw.propertyId as number) || 0,
    propertyName: (property?.name as string) || 'Propriété inconnue',
    propertyAddress: (property?.address as string) || '',
    propertyCity: (property?.city as string) || '',
    propertyPostalCode: (property?.postalCode as string) || undefined,
    propertyCountry: (property?.country as string) || undefined,
    requestorId: (raw.userId as number) || (raw.requestorId as number) || 0,
    requestorName: user
      ? `${user.firstName} ${user.lastName}`
      : requestor
        ? `${requestor.firstName} ${requestor.lastName}`
        : 'Demandeur inconnu',
    requestorEmail: (user?.email as string) || (requestor?.email as string) || undefined,
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
    estimatedDuration: (raw.estimatedDurationHours as number) || (raw.estimatedDuration as number) || 1,
    dueDate: (raw.desiredDate as string) || (raw.dueDate as string) || '',
    createdAt: (raw.createdAt as string) || '',
    updatedAt: (raw.updatedAt as string) || undefined,
    approvedAt: (raw.approvedAt as string) || undefined,
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
