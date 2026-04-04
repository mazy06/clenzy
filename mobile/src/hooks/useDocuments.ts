import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi, type GenerateDocumentRequest } from '@/api/endpoints/documentsApi';

const KEYS = {
  all: ['documents'] as const,
  list: () => [...KEYS.all, 'list'] as const,
  templates: () => [...KEYS.all, 'templates'] as const,
  generations: () => [...KEYS.all, 'generations'] as const,
  detail: (id: number) => [...KEYS.all, 'detail', id] as const,
};

/** Unified list: templates + generated documents */
export function useDocuments() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn: () => documentsApi.getAll(),
  });
}

/** Templates only */
export function useDocumentTemplates() {
  return useQuery({
    queryKey: KEYS.templates(),
    queryFn: () => documentsApi.getTemplates(),
  });
}

/** Generated documents (paginated) */
export function useDocumentGenerations(page = 0, size = 50) {
  return useQuery({
    queryKey: KEYS.generations(),
    queryFn: async () => {
      const res = await documentsApi.getGenerations(page, size);
      return Array.isArray(res) ? res : res.content ?? [];
    },
  });
}

/** Documents linked to a reservation or intervention */
export function useDocumentsByReference(referenceType: string, referenceId: number) {
  return useQuery({
    queryKey: [...KEYS.all, 'ref', referenceType, referenceId],
    queryFn: () => documentsApi.getGenerationsByReference(referenceType, referenceId),
    enabled: !!referenceType && referenceId > 0,
  });
}

export function useGenerateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: GenerateDocumentRequest) => documentsApi.generate(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useDownloadDocument() {
  return useMutation({
    mutationFn: (id: number) => documentsApi.downloadGeneration(id),
  });
}
