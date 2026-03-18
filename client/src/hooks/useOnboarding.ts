import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import onboardingApi from '../services/api/onboardingApi';
import type { OnboardingStatus } from '../services/api/onboardingApi';
import { getOnboardingSteps } from '../config/onboardingConfig';
import type { OnboardingStepConfig } from '../config/onboardingConfig';
import { useAuth } from './useAuth';

const QUERY_KEY = ['onboarding', 'me'];

export interface OnboardingStepWithStatus extends OnboardingStepConfig {
  completed: boolean;
  completedAt: string | null;
  locked: boolean; // true if previous step is not completed (sequential)
}

export function useOnboarding() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Determine the user's primary role for onboarding
  const userRole = useMemo(() => {
    if (!user?.roles?.length) return '';
    // Priority: platform roles first, then business roles
    const rolePriority = ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST', 'SUPERVISOR', 'TECHNICIAN', 'HOUSEKEEPER', 'LAUNDRY', 'EXTERIOR_TECH'];
    return rolePriority.find((r) => user.roles.includes(r)) ?? user.roles[0];
  }, [user?.roles]);

  const { data: status, isLoading } = useQuery<OnboardingStatus>({
    queryKey: QUERY_KEY,
    queryFn: onboardingApi.getMyStatus,
    enabled: !!userRole,
    staleTime: 5 * 60 * 1000,
  });

  // Merge config steps with server status
  const steps: OnboardingStepWithStatus[] = useMemo(() => {
    const configSteps = getOnboardingSteps(userRole);
    const serverSteps = status?.steps ?? [];
    const serverMap = new Map(serverSteps.map((s) => [s.key, s]));

    let previousCompleted = true;
    return configSteps.map((config) => {
      const server = serverMap.get(config.key);
      const completed = server?.completed ?? false;
      const locked = !previousCompleted;
      previousCompleted = completed;
      return {
        ...config,
        completed,
        completedAt: server?.completedAt ?? null,
        locked,
      };
    });
  }, [userRole, status]);

  const completedCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
  const isAllCompleted = totalCount > 0 && completedCount === totalCount;
  const isDismissed = status?.dismissed ?? false;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Current active step (first non-completed, non-locked)
  const activeStep = useMemo(() => {
    return steps.find((s) => !s.completed && !s.locked) ?? null;
  }, [steps]);

  const completeMutation = useMutation({
    mutationFn: (stepKey: string) => onboardingApi.completeStep(stepKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const dismissMutation = useMutation({
    mutationFn: () => onboardingApi.dismiss(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const resetMutation = useMutation({
    mutationFn: () => onboardingApi.reset(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const completeStep = useCallback((stepKey: string) => {
    completeMutation.mutate(stepKey);
  }, [completeMutation]);

  const dismiss = useCallback(() => {
    dismissMutation.mutate();
  }, [dismissMutation]);

  const reset = useCallback(() => {
    resetMutation.mutate();
  }, [resetMutation]);

  return {
    steps,
    completedCount,
    totalCount,
    isAllCompleted,
    isDismissed,
    progressPercent,
    activeStep,
    isLoading,
    userRole,
    completeStep,
    dismiss,
    reset,
  };
}
