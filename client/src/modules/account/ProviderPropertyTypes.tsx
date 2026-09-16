import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import apiClient from '../../services/apiClient';
import { Button, Skeleton } from '../../components/ui';

const TYPES = ['APARTMENT','HOUSE','STUDIO','VILLA','LOFT','DUPLEX','TOWNHOUSE','BUNGALOW','RIAD','GUEST_ROOM','COTTAGE','CHALET','BOAT','OTHER'];
export default function ProviderPropertyTypes() {
  const { user } = useAuth();
  return user ? <PropertyTypesEditor key={`${user.id}:${user.organizationId}`} /> : null;
}

function PropertyTypesEditor() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const client = useQueryClient();
  const key = ['provider-property-types', user?.id, user?.organizationId];
  const query = useQuery({ queryKey: key, queryFn: () => apiClient.get<string[]>('/my-property-types'), enabled: !!user });
  const [draft, setDraft] = useState<string[] | null>(null);
  const selected = draft ?? query.data ?? [];
  const mutation = useMutation({
    mutationFn: (types: string[]) => apiClient.put<string[]>('/my-property-types', types),
    onSuccess: (types) => { client.setQueryData(key, types); setDraft(null); void client.invalidateQueries({ queryKey: ['provider-catalog'] }); },
  });
  return <fieldset className="min-w-0 border-t border-border pt-3">
    <legend className="text-sm font-medium">{t('marketplaceWorkflow.propertyTypes')}</legend>
    <p className="text-xs text-muted-foreground">{t('marketplaceWorkflow.propertyTypesHelp')}</p>
    {query.isLoading ? <Skeleton className="h-20 w-full" /> : query.isError
      ? <p role="alert" className="text-sm text-destructive-ink">{t('marketplaceWorkflow.loadFailed')}</p>
      : <>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {TYPES.map((type) => <label key={type} className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={selected.includes(type)} disabled={mutation.isPending}
              onChange={(event) => setDraft(event.target.checked ? [...selected,type] : selected.filter((value) => value!==type))} />
            {t('marketplaceWorkflow.types.' + type)}
          </label>)}
        </div>
        <Button type="button" className="mt-3" size="sm" variant="outline"
          disabled={draft===null || mutation.isPending} onClick={() => mutation.mutate(selected)}>{t('marketplaceWorkflow.saveTypes')}</Button>
        {mutation.isSuccess && draft===null && <p role="status" className="text-xs">{t('marketplaceWorkflow.saved')}</p>}
      </>}
    {mutation.isError && <p role="alert" className="text-sm text-destructive-ink">{t('marketplaceWorkflow.sendFailed')}</p>}
  </fieldset>;
}
