import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  systemEmailTemplatesApi,
  type SystemEmailTemplate,
  type SystemEmailTemplateGroup,
  type UpsertSystemEmailTemplatePayload,
} from '../services/api/systemEmailTemplatesApi';
import type { TemplateVariable } from '../services/api/guestMessagingApi';

// ─── Query keys ──────────────────────────────────────────────────────────────

export const systemEmailTemplatesKeys = {
  all: ['system-email-templates'] as const,
  list: () => [...systemEmailTemplatesKeys.all, 'list'] as const,
  detail: (key: string) => [...systemEmailTemplatesKeys.all, 'detail', key] as const,
  variables: () => [...systemEmailTemplatesKeys.all, 'variables'] as const,
};

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useSystemEmailTemplatesList() {
  return useQuery<SystemEmailTemplateGroup[]>({
    queryKey: systemEmailTemplatesKeys.list(),
    queryFn: () => systemEmailTemplatesApi.list(),
    staleTime: 60_000,
  });
}

export function useSystemEmailTemplateDetail(key: string | null, enabled = true) {
  return useQuery<SystemEmailTemplateGroup>({
    queryKey: systemEmailTemplatesKeys.detail(key ?? ''),
    queryFn: () => systemEmailTemplatesApi.getByKey(key!),
    enabled: enabled && Boolean(key),
    staleTime: 30_000,
  });
}

export function useSystemEmailTemplateVariables() {
  return useQuery<TemplateVariable[]>({
    queryKey: systemEmailTemplatesKeys.variables(),
    queryFn: () => systemEmailTemplatesApi.getVariables(),
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useUpsertSystemEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation<
    SystemEmailTemplate,
    Error,
    { key: string; language: string; payload: UpsertSystemEmailTemplatePayload }
  >({
    mutationFn: ({ key, language, payload }) =>
      systemEmailTemplatesApi.upsertOverride(key, language, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: systemEmailTemplatesKeys.list() });
      queryClient.invalidateQueries({ queryKey: systemEmailTemplatesKeys.detail(variables.key) });
    },
  });
}

export function useRemoveSystemEmailTemplateOverride() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { key: string; language: string }>({
    mutationFn: ({ key, language }) => systemEmailTemplatesApi.removeOverride(key, language),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: systemEmailTemplatesKeys.list() });
      queryClient.invalidateQueries({ queryKey: systemEmailTemplatesKeys.detail(variables.key) });
    },
  });
}
