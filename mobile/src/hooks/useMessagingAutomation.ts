import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { guestMessagingApi, type MessagingAutomationConfig } from '@/api/endpoints/guestMessagingApi';

const KEYS = {
  config: ['messaging-automation-config'] as const,
};

/** Fetch messaging automation config */
export function useMessagingAutomation() {
  return useQuery<MessagingAutomationConfig>({
    queryKey: KEYS.config,
    queryFn: () => guestMessagingApi.getAutomationConfig(),
  });
}

/** Update a single field in the automation config (optimistic update) */
export function useUpdateMessagingAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partial: Partial<MessagingAutomationConfig>) => {
      const current = queryClient.getQueryData<MessagingAutomationConfig>(KEYS.config);
      if (!current) throw new Error('Config not loaded');
      return guestMessagingApi.updateAutomationConfig({ ...current, ...partial });
    },

    onMutate: async (partial) => {
      await queryClient.cancelQueries({ queryKey: KEYS.config });
      const previous = queryClient.getQueryData<MessagingAutomationConfig>(KEYS.config);

      if (previous) {
        queryClient.setQueryData<MessagingAutomationConfig>(KEYS.config, {
          ...previous,
          ...partial,
        });
      }

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(KEYS.config, context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.config });
    },
  });
}
