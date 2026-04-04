import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationsApi, type ReservationUpdatePayload } from '@/api/endpoints/reservationsApi';

const KEYS = {
  all: ['reservations'] as const,
  list: (params?: Record<string, string>) => [...KEYS.all, 'list', params] as const,
  detail: (id: number) => [...KEYS.all, 'detail', id] as const,
  byProperty: (propertyId: number) => [...KEYS.all, 'property', propertyId] as const,
  interventions: (id: number) => [...KEYS.all, 'interventions', id] as const,
};

export function useReservations(params?: Record<string, string>) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => reservationsApi.getAll(params),
  });
}

export function useReservation(id: number) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn: () => reservationsApi.getById(id),
    enabled: id > 0,
  });
}

export function useReservationInterventions(reservationId: number) {
  return useQuery({
    queryKey: KEYS.interventions(reservationId),
    queryFn: () => reservationsApi.getLinkedInterventions(reservationId),
    enabled: reservationId > 0,
  });
}

export function usePropertyReservations(propertyId: number) {
  return useQuery({
    queryKey: KEYS.byProperty(propertyId),
    queryFn: () => reservationsApi.getByProperty(propertyId),
    enabled: propertyId > 0,
  });
}

export function useUpdateReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ReservationUpdatePayload }) =>
      reservationsApi.update(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useCancelReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      reservationsApi.cancel(id, reason),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useSendReservationPaymentLink() {
  return useMutation({
    mutationFn: (id: number) => reservationsApi.sendPaymentLink(id),
  });
}
