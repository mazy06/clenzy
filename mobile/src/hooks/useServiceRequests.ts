import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serviceRequestsApi, type ServiceRequest } from '@/api/endpoints/serviceRequestsApi';

const KEYS = {
  all: ['serviceRequests'] as const,
  list: (params?: Record<string, string>) => [...KEYS.all, 'list', params] as const,
  detail: (id: number) => [...KEYS.all, 'detail', id] as const,
};

export function useServiceRequests(params?: Record<string, string>) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => serviceRequestsApi.getAll(params),
  });
}

export function useServiceRequest(id: number) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn: () => serviceRequestsApi.getById(id),
    enabled: id > 0,
  });
}

export function useCreateServiceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ServiceRequest>) => serviceRequestsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useUpdateServiceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ServiceRequest> }) =>
      serviceRequestsApi.update(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
