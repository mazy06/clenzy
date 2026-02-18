import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { serviceRequestsApi } from '../services/api';
import type { ServiceRequestApiResponse, ServiceRequest } from '../modules/service-requests/serviceRequestsUtils';

// ============================================================================
// Query keys (exported for cross-module invalidation)
// ============================================================================

export const serviceRequestsListKeys = {
  all: ['service-requests-list'] as const,
  list: () => [...serviceRequestsListKeys.all] as const,
};

// ============================================================================
// Converter
// ============================================================================

function convertServiceRequest(req: ServiceRequestApiResponse): ServiceRequest {
  return {
    id: req.id.toString(),
    title: req.title,
    description: req.description,
    type: req.type?.toLowerCase() || req.serviceType?.toLowerCase() || 'other',
    status: req.status || 'PENDING',
    priority: req.priority?.toLowerCase() || 'medium',
    propertyId: req.propertyId,
    propertyName: req.property?.name || 'Propriété inconnue',
    propertyAddress: req.property?.address || '',
    propertyCity: req.property?.city || '',
    requestorId: req.userId || req.requestorId || 0,
    requestorName: req.user
      ? `${req.user.firstName} ${req.user.lastName}`
      : req.requestor
        ? `${req.requestor.firstName} ${req.requestor.lastName}`
        : 'Demandeur inconnu',
    assignedToId: req.assignedToId || undefined,
    assignedToName: req.assignedTo
      ? `${req.assignedTo.firstName} ${req.assignedTo.lastName}`
      : undefined,
    assignedToType: (req.assignedToType || (req.assignedTo ? 'user' : undefined)) as
      | 'user'
      | 'team'
      | undefined,
    estimatedDuration: req.estimatedDurationHours || req.estimatedDuration || 1,
    estimatedCost: req.estimatedCost || undefined,
    dueDate: req.desiredDate || req.dueDate || '',
    createdAt: req.createdAt,
  };
}

// ============================================================================
// Hook
// ============================================================================

export interface UseServiceRequestsListReturn {
  serviceRequests: ServiceRequest[];
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  deleteServiceRequest: (id: string) => void;
  isDeleting: boolean;
  refetch: () => void;
}

export function useServiceRequestsListQuery(): UseServiceRequestsListReturn {
  const queryClient = useQueryClient();

  // ─── Service requests query ─────────────────────────────────────────
  const query = useQuery({
    queryKey: serviceRequestsListKeys.list(),
    queryFn: async () => {
      const data = await serviceRequestsApi.getAll();
      const requestsList = (data as unknown as { content?: ServiceRequestApiResponse[] }).content || data;
      return (requestsList as unknown as ServiceRequestApiResponse[]).map(convertServiceRequest);
    },
    staleTime: 60_000,
  });

  // ─── Delete mutation ────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => serviceRequestsApi.delete(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceRequestsListKeys.all });
    },
  });

  return useMemo(
    () => ({
      serviceRequests: query.data ?? [],
      isLoading: query.isLoading,
      isError: query.isError,
      error: query.error ? (query.error as { message?: string }).message ?? 'Erreur de chargement' : null,
      deleteServiceRequest: deleteMutation.mutate,
      isDeleting: deleteMutation.isPending,
      refetch: query.refetch,
    }),
    [query.data, query.isLoading, query.isError, query.error, query.refetch, deleteMutation.mutate, deleteMutation.isPending],
  );
}
