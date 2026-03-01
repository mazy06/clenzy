import { useQuery } from '@tanstack/react-query';
import { reservationsApi } from '@/api/endpoints/reservationsApi';

const KEYS = {
  all: ['reservations'] as const,
  list: (params?: Record<string, string>) => [...KEYS.all, 'list', params] as const,
  detail: (id: number) => [...KEYS.all, 'detail', id] as const,
  byProperty: (propertyId: number) => [...KEYS.all, 'property', propertyId] as const,
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

export function usePropertyReservations(propertyId: number) {
  return useQuery({
    queryKey: KEYS.byProperty(propertyId),
    queryFn: () => reservationsApi.getByProperty(propertyId),
    enabled: propertyId > 0,
  });
}
