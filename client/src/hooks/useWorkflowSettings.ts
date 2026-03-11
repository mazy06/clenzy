import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowSettingsApi } from '../services/api/workflowSettingsApi';
import type { WorkflowSettingsData } from '../services/api/workflowSettingsApi';

// ─── Re-export du type pour retro-compatibilite ─────────────────────────────

export type WorkflowSettings = WorkflowSettingsData;

// ─── Valeurs par defaut (utilisees comme placeholderData) ───────────────────

const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettings = {
  cancellationDeadlineHours: 24,
  autoAssignInterventions: true,
  requireApprovalForChanges: true,
};

// ─── Query keys ─────────────────────────────────────────────────────────────

export const workflowSettingsKeys = {
  all: ['workflow-settings'] as const,
};

// ─── Hook ───────────────────────────────────────────────────────────────────

export const useWorkflowSettings = () => {
  const queryClient = useQueryClient();

  const { data: settings = DEFAULT_WORKFLOW_SETTINGS, isLoading: loading } = useQuery({
    queryKey: workflowSettingsKeys.all,
    queryFn: () => workflowSettingsApi.get(),
    staleTime: 5 * 60 * 1000, // 5 min
    placeholderData: DEFAULT_WORKFLOW_SETTINGS,
  });

  const mutation = useMutation({
    mutationFn: (newSettings: Partial<WorkflowSettings>) =>
      workflowSettingsApi.update({ ...settings, ...newSettings }),
    onMutate: async (newSettings: Partial<WorkflowSettings>) => {
      await queryClient.cancelQueries({ queryKey: workflowSettingsKeys.all });
      const previous = queryClient.getQueryData<WorkflowSettings>(workflowSettingsKeys.all);
      queryClient.setQueryData<WorkflowSettings>(workflowSettingsKeys.all, (old) => ({
        ...(old ?? DEFAULT_WORKFLOW_SETTINGS),
        ...newSettings,
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(workflowSettingsKeys.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workflowSettingsKeys.all });
    },
  });

  const updateSettings = (newSettings: Partial<WorkflowSettings>) => {
    mutation.mutate(newSettings);
  };

  // Verifier si une demande peut encore etre annulee
  const canCancelServiceRequest = (approvedAt: string | null | undefined): boolean => {
    try {
      if (!approvedAt) return false;
      const approvedDate = new Date(approvedAt);
      if (isNaN(approvedDate.getTime())) return false;
      const now = new Date();
      const hoursDiff = (now.getTime() - approvedDate.getTime()) / (1000 * 60 * 60);
      return hoursDiff <= settings.cancellationDeadlineHours;
    } catch {
      return false;
    }
  };

  // Obtenir le temps restant pour annuler (en heures)
  const getRemainingCancellationTime = (approvedAt: string | null | undefined): number => {
    try {
      if (!approvedAt) return 0;
      const approvedDate = new Date(approvedAt);
      if (isNaN(approvedDate.getTime())) return 0;
      const now = new Date();
      const hoursDiff = (now.getTime() - approvedDate.getTime()) / (1000 * 60 * 60);
      return Math.max(0, settings.cancellationDeadlineHours - hoursDiff);
    } catch {
      return 0;
    }
  };

  return {
    settings,
    updateSettings,
    canCancelServiceRequest,
    getRemainingCancellationTime,
    loading,
  };
};
