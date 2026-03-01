import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationPreferencesApi, type NotificationPreferences } from '@/api/endpoints/notificationPreferencesApi';

const KEYS = {
  all: ['notification-preferences'] as const,
};

/** Fetch all notification preferences */
export function useNotificationPreferences() {
  return useQuery<NotificationPreferences>({
    queryKey: KEYS.all,
    queryFn: () => notificationPreferencesApi.getAll(),
  });
}

/** Toggle a single notification preference key (optimistic update) */
export function useUpdateNotificationPreference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => {
      // Get current preferences and send the full map with the toggled key
      const current = queryClient.getQueryData<NotificationPreferences>(KEYS.all) ?? {};
      return notificationPreferencesApi.update({ ...current, [key]: enabled });
    },

    onMutate: async ({ key, enabled }) => {
      await queryClient.cancelQueries({ queryKey: KEYS.all });
      const previous = queryClient.getQueryData<NotificationPreferences>(KEYS.all);

      queryClient.setQueryData<NotificationPreferences>(KEYS.all, (old) => ({
        ...old,
        [key]: enabled,
      }));

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(KEYS.all, context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

/** Toggle all keys in a category at once (optimistic update) */
export function useUpdateCategoryPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ keys, enabled }: { keys: string[]; enabled: boolean }) => {
      const current = queryClient.getQueryData<NotificationPreferences>(KEYS.all) ?? {};
      const updated = { ...current };
      for (const key of keys) {
        updated[key] = enabled;
      }
      return notificationPreferencesApi.update(updated);
    },

    onMutate: async ({ keys, enabled }) => {
      await queryClient.cancelQueries({ queryKey: KEYS.all });
      const previous = queryClient.getQueryData<NotificationPreferences>(KEYS.all);

      queryClient.setQueryData<NotificationPreferences>(KEYS.all, (old) => {
        const updated = { ...old };
        for (const key of keys) {
          updated[key] = enabled;
        }
        return updated;
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(KEYS.all, context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
