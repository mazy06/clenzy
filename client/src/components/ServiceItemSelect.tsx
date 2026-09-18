import { useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import { useTranslation } from '../hooks/useTranslation';
import { Field, FieldLabel, FieldError, Skeleton } from './ui';
import { Combobox, ComboboxInput, ComboboxContent, ComboboxEmpty, ComboboxItem, ComboboxList } from './ui/combobox';

export interface ServiceReferenceItem { code: string; labelFr: string; labelEn: string; legacyType: string; executionMode?: 'ON_SITE' | 'REMOTE' | 'DELIVERY'; propertyRequired?: boolean; slotRequired?: boolean; domain?: string; categoryCode?: string; payer?: string }
export const serviceReferenceQuery = {
  queryKey: ['service-reference'],
  queryFn: () => apiClient.get<ServiceReferenceItem[]>('/service-reference'),
  staleTime: 60_000,
};

export default function ServiceItemSelect({ value, onChange, disabled }: {
  value?: string; onChange: (item: ServiceReferenceItem) => void; disabled?: boolean;
}) {
  const id = useId();
  const { t, isEnglish } = useTranslation();
  const query = useQuery(serviceReferenceQuery);
  const items = query.data ?? [];
  const selected = items.find(item => item.code === value) ?? (value
    ? { code: value, labelFr: value, labelEn: value, legacyType: 'OTHER' } : null);
  return <Field>
    <FieldLabel htmlFor={id}>{t('serviceRequests.fields.serviceType')}</FieldLabel>
    {query.isPending ? <Skeleton className="h-10 w-full" /> : <Combobox items={items} value={selected}
      disabled={disabled || query.isError} itemToStringLabel={(item: ServiceReferenceItem) => isEnglish ? item.labelEn : item.labelFr}
      isItemEqualToValue={(a?: ServiceReferenceItem | null, b?: ServiceReferenceItem | null) => a?.code === b?.code}
      onValueChange={(item: ServiceReferenceItem | null) => { if (item) onChange(item); }}>
      <ComboboxInput id={id} className="w-full" />
      <ComboboxContent>
        <ComboboxEmpty>{t('serviceReference.empty')}</ComboboxEmpty>
        <ComboboxList>{(item: ServiceReferenceItem) => <ComboboxItem key={item.code} value={item}>
          {isEnglish ? item.labelEn : item.labelFr}
        </ComboboxItem>}</ComboboxList>
      </ComboboxContent>
    </Combobox>}
    {selected && 'executionMode' in selected && selected.executionMode === 'REMOTE' && <p className="text-xs text-muted-foreground">{t('serviceReference.remoteHelp')}</p>}
    {query.isError && <FieldError>{t('serviceReference.loadError')}</FieldError>}
  </Field>;
}
