import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi, GenerateDocumentRequest } from '../../../services/api/documentsApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const documentKeys = {
  all: ['documents'] as const,
  templates: () => [...documentKeys.all, 'templates'] as const,
  template: (id: number) => [...documentKeys.templates(), id] as const,
  generations: (page: number, size: number) => [...documentKeys.all, 'generations', { page, size }] as const,
  documentTypes: () => [...documentKeys.all, 'types'] as const,
  tagCategories: () => [...documentKeys.all, 'tagCategories'] as const,
  complianceStats: () => [...documentKeys.all, 'complianceStats'] as const,
};

// ─── Templates ──────────────────────────────────────────────────────────────

export function useTemplates() {
  return useQuery({
    queryKey: documentKeys.templates(),
    queryFn: () => documentsApi.getTemplates(),
  });
}

export function useTemplate(id: number) {
  return useQuery({
    queryKey: documentKeys.template(id),
    queryFn: () => documentsApi.getTemplate(id),
    enabled: !!id,
  });
}

export function useUploadTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: FormData) => documentsApi.uploadTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.templates() });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; description?: string; eventTrigger?: string; emailSubject?: string; emailBody?: string } }) =>
      documentsApi.updateTemplate(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.template(variables.id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.templates() });
    },
  });
}

export function useActivateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => documentsApi.activateTemplate(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.template(id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.templates() });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => documentsApi.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.templates() });
    },
  });
}

export function useReparseTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => documentsApi.reparseTemplate(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.template(id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.templates() });
    },
  });
}

// ─── Generations ────────────────────────────────────────────────────────────

export function useGenerations(page: number, size: number) {
  return useQuery({
    queryKey: documentKeys.generations(page, size),
    queryFn: () => documentsApi.getGenerations({ page, size }),
  });
}

export function useGenerateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: GenerateDocumentRequest) => documentsApi.generateDocument(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}

// ─── References ─────────────────────────────────────────────────────────────

export function useDocumentTypes() {
  return useQuery({
    queryKey: documentKeys.documentTypes(),
    queryFn: () => documentsApi.getDocumentTypes(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useTagCategories() {
  return useQuery({
    queryKey: documentKeys.tagCategories(),
    queryFn: () => documentsApi.getTagCategories(),
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Compliance ─────────────────────────────────────────────────────────────

export function useComplianceStats() {
  return useQuery({
    queryKey: documentKeys.complianceStats(),
    queryFn: () => documentsApi.getComplianceStats(),
  });
}

export function useCheckTemplateCompliance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: number) => documentsApi.checkTemplateCompliance(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.complianceStats() });
    },
  });
}

export function useVerifyDocumentIntegrity() {
  return useMutation({
    mutationFn: (generationId: number) => documentsApi.verifyDocumentIntegrity(generationId),
  });
}
