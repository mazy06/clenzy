import { useId, useRef, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import { useTranslation } from '../hooks/useTranslation';
import { Field, FieldLabel, FieldError, Skeleton } from './ui';
import { Combobox, ComboboxInput, ComboboxContent, ComboboxEmpty, ComboboxItem, ComboboxList } from './ui/combobox';
import { InputGroupAddon } from './ui/input-group';
import { providerSectorImage } from '../modules/marketplace/providerSectorImages';
import './baitlyVisualSelect.css';

export interface ServiceReferenceItem { code: string; labelFr: string; labelEn: string; legacyType: string; executionMode?: 'ON_SITE' | 'REMOTE' | 'DELIVERY'; propertyRequired?: boolean; slotRequired?: boolean; domain?: string; categoryCode?: string; payer?: string }
export const serviceReferenceQuery = {
  queryKey: ['service-reference'],
  queryFn: () => apiClient.get<ServiceReferenceItem[]>('/service-reference'),
  staleTime: 60_000,
};

export default function ServiceItemSelect({ value, onChange, disabled, labelAction }: {
  value?: string; onChange: (item: ServiceReferenceItem) => void; disabled?: boolean; labelAction?: ReactNode;
}) {
  const id = useId();
  const anchor = useRef<HTMLDivElement>(null);
  const { t, isEnglish } = useTranslation();
  const query = useQuery(serviceReferenceQuery);
  const items = query.data ?? [];
  const selected = items.find(item => item.code === value) ?? (value
    ? { code: value, labelFr: value, labelEn: value, legacyType: 'OTHER' } : null);
  const artwork = (item: ServiceReferenceItem) => providerSectorImage([item.categoryCode ?? item.legacyType]);
  const picture = (item: ServiceReferenceItem) => <span className="baitly-visual-select__picture" data-artwork aria-hidden="true">
    <img src={artwork(item)} alt="" decoding="async" />
  </span>;
  return <Field className="baitly-visual-select">
    <div className="baitly-visual-select__label"><FieldLabel htmlFor={id}>{t('serviceRequests.fields.serviceType')}</FieldLabel>{labelAction}</div>
    {query.isPending ? <Skeleton className="h-10 w-full" /> : <Combobox items={items} value={selected}
      disabled={disabled || query.isError} itemToStringLabel={(item: ServiceReferenceItem) => isEnglish ? item.labelEn : item.labelFr}
      isItemEqualToValue={(a?: ServiceReferenceItem | null, b?: ServiceReferenceItem | null) => a?.code === b?.code}
      onValueChange={(item: ServiceReferenceItem | null) => { if (item) onChange(item); }}>
      <div ref={anchor} className="baitly-visual-select__anchor"><ComboboxInput id={id} className="baitly-visual-select__control w-full" disabled={disabled || query.isError}>
        {selected && <InputGroupAddon align="inline-start">{picture(selected)}</InputGroupAddon>}
      </ComboboxInput></div>
      <ComboboxContent anchor={anchor} sideOffset={0} className="baitly-visual-select__popup">
        <ComboboxEmpty>{t('serviceReference.empty')}</ComboboxEmpty>
        <ComboboxList>{(item: ServiceReferenceItem) => <ComboboxItem key={item.code} value={item} className="baitly-visual-select__option cursor-pointer">
          {picture(item)}<span className="baitly-visual-select__text">{isEnglish ? item.labelEn : item.labelFr}</span>
        </ComboboxItem>}</ComboboxList>
      </ComboboxContent>
    </Combobox>}
    {selected && 'executionMode' in selected && selected.executionMode === 'REMOTE' && <p className="text-xs text-muted-foreground">{t('serviceReference.remoteHelp')}</p>}
    {query.isError && <FieldError>{t('serviceReference.loadError')}</FieldError>}
  </Field>;
}
