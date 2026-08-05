import React from 'react';
import { Field, FieldLabel, NativeSelect, NativeSelectOption } from '../ui';
import { useTranslation } from '../../hooks/useTranslation';
import type { UseReservationFormResult } from './useReservationForm';

interface Props {
  form: UseReservationFormResult;
}

/** Sélecteur de propriété (création libre, étape 1). Auto-sélection 1er logement pour non platform-staff. */
const PropertySelectField: React.FC<Props> = ({ form }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1.5">
      <Field>
        <FieldLabel htmlFor="reservation-property">{t('reservations.fields.property')}</FieldLabel>
        <NativeSelect
          id="reservation-property"
          className="w-full"
          required
          disabled={!form.isPlatformStaff || form.propertiesLoading}
          value={form.propertyId === '' ? '' : form.propertyId}
          onChange={(e) => form.setPropertyId(Number(e.target.value))}
        >
          {/* Option vide desactivee : reprend le `displayEmpty` de MUI, elle sert
              de placeholder tant qu'aucun logement n'est choisi. */}
          <NativeSelectOption value="" disabled>
            {t('reservations.dialog.propertyPlaceholder')}
          </NativeSelectOption>
          {form.properties.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {!form.isPlatformStaff && form.propertyName && (
        <p className="text-[11px] text-muted-foreground italic">
          {t('reservations.dialog.propertyAutoSelected')}
        </p>
      )}
    </div>
  );
};

export default PropertySelectField;
