import { useCommerceScope } from '../../../hooks/useCommerceScope';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi, GenerateDocumentRequest } from '../../../services/api/documentsApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const documentKeys = {
  all: ['documents'] as const,
  templates: () => [...documentKeys.all, 'templates'] as const,
  template: (id: number) => [...documentKeys.templates(), id] as const,
  generations: (page: number, size: number) => [...documentKeys.all, 'generations', { page, size }] as const,
  generationsByReference: (refType: string, refId: number) => [...documentKeys.all, 'by-reference', refType, refId] as const,
  documentTypes: () => [...documentKeys.all, 'types'] as const,
  tagCategories: () => [...documentKeys.all, 'tagCategories'] as const,
  complianceStats: () => [...documentKeys.all, 'complianceStats'] as const,
};

// ─── Templates ──────────────────────────────────────────────────────────────

export function useTemplates() {
  const scope = useCommerceScope();
  return useQuery({
    enabled: !!scope,
    queryKey: [...documentKeys.templates(), scope],
    queryFn: () => documentsApi.getTemplates(),
  });
}

export function useTemplate(id: number) {
  const scope = useCommerceScope();
  return useQuery({
    queryKey: [...documentKeys.template(id), scope],
    queryFn: () => documentsApi.getTemplate(id),
    enabled: !!scope && !!id,
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

export function useReplaceTemplateFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) =>
      documentsApi.replaceTemplateFile(id, file),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.template(id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.templates() });
    },
  });
}

// ─── Generations ────────────────────────────────────────────────────────────

export function useGenerations(page: number, size: number) {
  const scope = useCommerceScope();
  return useQuery({
    enabled: !!scope,
    queryKey: [...documentKeys.generations(page, size), scope],
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

export function useGenerationsByReference(referenceType: string, referenceId: number) {
  const scope = useCommerceScope();
  return useQuery({
    queryKey: [...documentKeys.generationsByReference(referenceType, referenceId), scope],
    queryFn: () => documentsApi.getGenerationsByReference(referenceType, referenceId),
    enabled: !!scope && !!referenceId,
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

// ─── Compliance ─────────────────────────────────────────────────────────────

export function useComplianceStats() {
  const scope = useCommerceScope();
  return useQuery({
    enabled: !!scope,
    queryKey: [...documentKeys.complianceStats(), scope],
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
