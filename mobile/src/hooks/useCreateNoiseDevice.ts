import { useMutation, useQueryClient } from '@tanstack/react-query';
import { noiseApi, type CreateNoiseDeviceRequest } from '@/api/endpoints/noiseApi';

/** Create a new noise device and invalidate related queries */
export function useCreateNoiseDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateNoiseDeviceRequest) => noiseApi.createDevice(data),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['noise-chart-data'] });
      queryClient.invalidateQueries({ queryKey: ['noise-devices'] });
    },
  });
}
