import { useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { serviceReferenceQuery } from './ServiceItemSelect';
import { useTranslation } from '../hooks/useTranslation';
import { Field, FieldLabel, FieldError, Button, Skeleton } from './ui';
import { Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput, ComboboxContent,
  ComboboxEmpty, ComboboxItem, ComboboxList, ComboboxValue, useComboboxAnchor } from './ui/combobox';

/** Le même catalogue alimente les capacités internes et les offres de la marketplace. */
export default function ServiceCapabilitySelect({ value, onChange, disabled = false }: {
  value: string[]; onChange: (codes: string[]) => void; disabled?: boolean;
}) {
  const id = useId();
  const anchor = useComboboxAnchor();
  const { t, isEnglish } = useTranslation();
  const query = useQuery(serviceReferenceQuery);
  const items = (query.data ?? []);
  const labels = new Map(items.map(item => [item.code, isEnglish ? item.labelEn : item.labelFr]));
  const codes = [...new Set([...items.map(item => item.code), ...value])];
  return <Field>
    <FieldLabel htmlFor={id}>{t('serviceReference.capabilities')}</FieldLabel>
    {query.isPending ? <Skeleton className="h-10 w-full" /> : query.isError ? <>
      <FieldError>{t('serviceReference.loadError')}</FieldError>
      <Button type="button" variant="outline" onClick={() => void query.refetch()}>{t('serviceReference.retry')}</Button>
    </> : <Combobox multiple items={codes} value={value} onValueChange={onChange} disabled={disabled}
      itemToStringLabel={(code: string) => labels.get(code) ?? code}>
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>{(selected: string[]) => <>
          {selected.map(code => <ComboboxChip key={code}>{labels.get(code) ?? code}</ComboboxChip>)}
          <ComboboxChipsInput id={id} />
        </>}</ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{t('serviceReference.empty')}</ComboboxEmpty>
        <ComboboxList>{(code: string) => <ComboboxItem key={code} value={code}>{labels.get(code) ?? code}</ComboboxItem>}</ComboboxList>
      </ComboboxContent>
    </Combobox>}
    <p className="text-xs text-muted-foreground">{t('serviceReference.capabilitiesHelp')}</p>
  </Field>;
}
