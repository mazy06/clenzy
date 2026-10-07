import React from 'react';
import {
  Field,
  FieldError,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from '../../components/ui';
import { Controller } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import type { PropertyFormValues } from '../../schemas';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PropertyFormBasicInfoProps {
  control: Control<PropertyFormValues>;
  errors: FieldErrors<PropertyFormValues>;
  propertyTypes: { value: string; label: string }[];
}

// ─── Component ──────────────────────────────────────────────────────────────

const PropertyFormBasicInfo: React.FC<PropertyFormBasicInfoProps> = React.memo(
  ({ control, errors, propertyTypes }) => {
    const { t } = useTranslation();

    return (
      <div>
        {/* Le titre de section est posé par PropertyForm (en-tête illustré). */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 min-[900px]:col-span-8">
            <Controller
              name="name"
              control={control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="property-name">{t('properties.propertyName')}</FieldLabel>
                  {/* field.ref n'est pas transmis : les primitives du kit sont des
                      composants fonction sans forwardRef (React 18), le passer
                      declencherait un avertissement sans jamais s'attacher. */}
                  <Input
                    id="property-name"
                    name={field.name}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    required
                    placeholder={t('properties.propertyNamePlaceholder')}
                    aria-invalid={!!fieldState.error}
                  />
                  {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />
          </div>

          <div className="col-span-12 min-[900px]:col-span-4">
            <Controller
              name="type"
              control={control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="property-type">{t('properties.propertyType')}</FieldLabel>
                  <NativeSelect
                    id="property-type"
                    className="w-full"
                    name={field.name}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    required
                    aria-invalid={!!fieldState.error}
                  >
                    {propertyTypes.map(type => (
                      <NativeSelectOption key={type.value} value={type.value}>
                        {type.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />
          </div>

          <div className="col-span-12">
            <Controller
              name="description"
              control={control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="property-description">{t('properties.description')}</FieldLabel>
                  {/* field.ref n'est pas transmis (primitives sans forwardRef, React 18).
                      `min-h-[4lh]` et non `rows` seul : le primitif pose
                      `field-sizing: content`, qui neutralise `rows`. */}
                  <Textarea
                    id="property-description"
                    name={field.name}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder={t('properties.descriptionPlaceholder')}
                    aria-invalid={!!fieldState.error}
                    className="min-h-[4lh] max-h-[12lh] w-full leading-[1.5]"
                  />
                  {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />
          </div>
        </div>
      </div>
    );
  }
);

PropertyFormBasicInfo.displayName = 'PropertyFormBasicInfo';

export default PropertyFormBasicInfo;
