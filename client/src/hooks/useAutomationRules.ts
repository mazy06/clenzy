import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { automationRulesApi } from '../services/api/automationRulesApi';
import type { CreateAutomationRuleData } from '../services/api/automationRulesApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const automationRulesKeys = {
  all: ['automation-rules'] as const,
  executions: (ruleId: number, page: number) => ['automation-rule-executions', ruleId, page] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useAutomationRules() {
  return useQuery({
    queryKey: automationRulesKeys.all,
    queryFn: () => automationRulesApi.getAll(),
    staleTime: 60_000,
  });
}

export function useCreateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAutomationRuleData) => automationRulesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: automationRulesKeys.all });
    },
  });
}

export function useUpdateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateAutomationRuleData }) =>
      automationRulesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: automationRulesKeys.all });
    },
  });
}

export function useToggleRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => automationRulesApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: automationRulesKeys.all });
    },
  });
}

export function useDeleteRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => automationRulesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: automationRulesKeys.all });
    },
  });
}

export function useRuleExecutions(ruleId: number, page = 0) {
  return useQuery({
    queryKey: automationRulesKeys.executions(ruleId, page),
    queryFn: () => automationRulesApi.getExecutions(ruleId, page),
    enabled: ruleId > 0,
    staleTime: 30_000,
  });
}
