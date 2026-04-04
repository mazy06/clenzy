import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { propertiesApi, type Property, type UpdatePropertyData, type UpdateInstructionsData, type PropertyPhotoMeta } from '@/api/endpoints/propertiesApi';

const KEYS = {
  all: ['properties'] as const,
  list: (params?: Record<string, string>) => [...KEYS.all, 'list', params] as const,
  detail: (id: number) => [...KEYS.all, 'detail', id] as const,
  channels: (id: number) => [...KEYS.all, 'channels', id] as const,
  photos: (id: number) => [...KEYS.all, 'photos', id] as const,
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

export function usePropertyPhotos(propertyId: number) {
  return useQuery({
    queryKey: KEYS.photos(propertyId),
    queryFn: () => propertiesApi.getPhotos(propertyId),
    enabled: propertyId > 0,
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePropertyData }) =>
      propertiesApi.update(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useUploadPropertyPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, formData }: { propertyId: number; formData: FormData }) =>
      propertiesApi.uploadPhoto(propertyId, formData),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.photos(variables.propertyId) });
      queryClient.invalidateQueries({ queryKey: KEYS.detail(variables.propertyId) });
    },
  });
}

export function useDeletePropertyPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, photoId }: { propertyId: number; photoId: number }) =>
      propertiesApi.deletePhoto(propertyId, photoId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.photos(variables.propertyId) });
      queryClient.invalidateQueries({ queryKey: KEYS.detail(variables.propertyId) });
    },
  });
}

export function useUpdatePropertyInstructions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, data }: { propertyId: number; data: UpdateInstructionsData }) =>
      propertiesApi.updateInstructions(propertyId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.detail(variables.propertyId) });
    },
  });
}

export function useUpdatePropertyAmenities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, amenities }: { propertyId: number; amenities: string[] }) =>
      propertiesApi.updateAmenities(propertyId, amenities),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.detail(variables.propertyId) });
    },
  });
}
