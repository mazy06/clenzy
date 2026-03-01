import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { interventionsApi, type Intervention, type InterventionListParams } from '@/api/endpoints/interventionsApi';

const KEYS = {
  all: ['interventions'] as const,
  list: (params?: InterventionListParams) => [...KEYS.all, 'list', params] as const,
  detail: (id: number) => [...KEYS.all, 'detail', id] as const,
};

export function useInterventions(params?: InterventionListParams) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => interventionsApi.getAll(params),
  });
}

export function useMyTodayMissions() {
  const today = new Date().toISOString().split('T')[0];
  return useMissionsForDate(today);
}

export function useMissionsForDate(date: string) {
  return useQuery({
    queryKey: [...KEYS.all, 'missions', date],
    queryFn: () => interventionsApi.getAll({ startDate: date, endDate: date }),
    refetchInterval: 15_000,
  });
}

export function useIntervention(id: number) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn: () => interventionsApi.getById(id),
    enabled: id > 0,
  });
}

export function useUpdateIntervention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Intervention> }) =>
      interventionsApi.update(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useCreateIntervention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Intervention>) => interventionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useDeleteIntervention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => interventionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useUploadPhotos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }: { id: number; formData: FormData }) =>
      interventionsApi.uploadPhotos(id, formData),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.detail(variables.id) });
    },
  });
}
