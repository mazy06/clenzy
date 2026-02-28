import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  smartLockApi,
  type SmartLockDeviceDto,
  type SmartLockStatusDto,
  type CreateSmartLockDeviceDto,
} from '@/api/endpoints/smartLockApi';

const KEYS = {
  all: ['smart-locks'] as const,
  list: ['smart-locks', 'list'] as const,
  status: (id: number) => ['smart-locks', 'status', id] as const,
};

/** Fetch all smart locks for the current user */
export function useSmartLocks() {
  return useQuery<SmartLockDeviceDto[]>({
    queryKey: KEYS.list,
    queryFn: () => smartLockApi.getAll(),
    staleTime: 30_000,
  });
}

/** Fetch live status for a single smart lock */
export function useSmartLockStatus(id: number) {
  return useQuery<SmartLockStatusDto>({
    queryKey: KEYS.status(id),
    queryFn: () => smartLockApi.getStatus(id),
    enabled: id > 0,
    refetchInterval: 30_000, // Poll every 30s for live status
    staleTime: 10_000,
  });
}

/** Create a new smart lock device */
export function useCreateSmartLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSmartLockDeviceDto) => smartLockApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.list });
    },
  });
}

/** Delete a smart lock device */
export function useDeleteSmartLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => smartLockApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.list });
    },
  });
}

/** Lock a smart lock device (optimistic update) */
export function useLockSmartLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => smartLockApi.lock(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: KEYS.status(id) });
      const previous = queryClient.getQueryData<SmartLockStatusDto>(KEYS.status(id));

      queryClient.setQueryData<SmartLockStatusDto>(KEYS.status(id), (old) =>
        old ? { ...old, locked: true } : old,
      );

      // Also update lock state in list
      queryClient.setQueryData<SmartLockDeviceDto[]>(KEYS.list, (old) =>
        old?.map((d) => (d.id === id ? { ...d, lockState: 'LOCKED' as const } : d)),
      );

      return { previous, id };
    },

    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(KEYS.status(context.id), context.previous);
      }
      queryClient.invalidateQueries({ queryKey: KEYS.list });
    },

    onSettled: (_data, _err, id) => {
      queryClient.invalidateQueries({ queryKey: KEYS.status(id) });
      queryClient.invalidateQueries({ queryKey: KEYS.list });
    },
  });
}

/** Unlock a smart lock device (optimistic update) */
export function useUnlockSmartLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => smartLockApi.unlock(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: KEYS.status(id) });
      const previous = queryClient.getQueryData<SmartLockStatusDto>(KEYS.status(id));

      queryClient.setQueryData<SmartLockStatusDto>(KEYS.status(id), (old) =>
        old ? { ...old, locked: false } : old,
      );

      queryClient.setQueryData<SmartLockDeviceDto[]>(KEYS.list, (old) =>
        old?.map((d) => (d.id === id ? { ...d, lockState: 'UNLOCKED' as const } : d)),
      );

      return { previous, id };
    },

    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(KEYS.status(context.id), context.previous);
      }
      queryClient.invalidateQueries({ queryKey: KEYS.list });
    },

    onSettled: (_data, _err, id) => {
      queryClient.invalidateQueries({ queryKey: KEYS.status(id) });
      queryClient.invalidateQueries({ queryKey: KEYS.list });
    },
  });
}
