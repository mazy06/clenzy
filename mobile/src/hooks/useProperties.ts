import { useQuery } from '@tanstack/react-query';
import { propertiesApi, type Property } from '@/api/endpoints/propertiesApi';

const KEYS = {
  all: ['properties'] as const,
  list: (params?: Record<string, string>) => [...KEYS.all, 'list', params] as const,
  detail: (id: number) => [...KEYS.all, 'detail', id] as const,
  channels: (id: number) => [...KEYS.all, 'channels', id] as const,
};

export function useProperties(params?: Record<string, string>) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => propertiesApi.getAll(params),
  });
}

export function useProperty(id: number) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn: () => propertiesApi.getById(id),
    enabled: id > 0,
  });
}

export function usePropertyChannels(propertyId: number) {
  return useQuery({
    queryKey: KEYS.channels(propertyId),
    queryFn: () => propertiesApi.getChannels(propertyId),
    enabled: propertyId > 0,
  });
}
