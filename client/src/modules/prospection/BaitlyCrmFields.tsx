import React, { useId } from 'react';
import { Field, FieldLabel, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
export const BAITLY_CRM_CATEGORIES = ['OWNERS', 'PROVIDERS', 'CONCIERGERIES', 'MENAGE', 'ARTISANS', 'ENTRETIEN', 'BLANCHISSERIES'];
export const BAITLY_CRM_STATUSES = ['TO_CONTACT', 'IN_DISCUSSION', 'PARTNER', 'REJECTED'];
export function BaitlyCrmSelect({ label, value, values, onChange, disabled = false }: {
  label: string; value: string; values: string[]; onChange: (value: string) => void; disabled?: boolean;
}) {
  const id = useId(); const { t } = useTranslation();
  return <Field><FieldLabel htmlFor={id}>{label}</FieldLabel>
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="w-full cursor-pointer"><SelectValue /></SelectTrigger>
      <SelectContent>{values.map((key) => <SelectItem key={key} value={key} className="cursor-pointer">
        {t(`baitlyCrm.values.${key}`, key)}
      </SelectItem>)}</SelectContent>
    </Select></Field>;
}
export function baitlyCrmError(error: unknown, fallback: string): string {
  return typeof error === 'object' && error && 'message' in error && typeof error.message === 'string'
    ? error.message : fallback;
}
