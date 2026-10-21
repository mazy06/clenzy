import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { prospectsApi, type BaitlyCrmContactWrite, type BaitlyCrmFilters } from '../services/api/prospectsApi';

export const prospectsKeys = { all: ['prospects'] as const, list: (org?: number) => ['prospects', org, 'list'] as const };
export function useProspects() {
  const { user } = useAuth();
  return useQuery({ queryKey: prospectsKeys.list(user?.organizationId), queryFn: prospectsApi.getAll,
    enabled: !!user?.permissions.includes('baitly-crm:view'), staleTime: 60_000 });
}
export function useBaitlyCrm(filters: BaitlyCrmFilters) {
  const { user } = useAuth();
  const org = user?.organizationId;
  const access = useQuery({ queryKey: ['prospects', user?.id, org, 'access'], queryFn: prospectsApi.access,
    enabled: !!user?.permissions.includes('baitly-crm:view') });
  const contacts = useQuery({ queryKey: ['prospects', user?.id, org, 'page', filters],
    queryFn: () => prospectsApi.page(filters), enabled: access.isSuccess });
  return { access, contacts, org };
}
export function useImportProspects() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ file, category, provenance }: { file: File; category: string; provenance?: string }) =>
      prospectsApi.importCsv(file, category, provenance),
    onSuccess: () => client.invalidateQueries({ queryKey: prospectsKeys.all }),
  });
}
export function useUpdateProspect() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: number; data: BaitlyCrmContactWrite }) => prospectsApi.update(id, data),
    onSuccess: () => client.invalidateQueries({ queryKey: prospectsKeys.all }) });
}
