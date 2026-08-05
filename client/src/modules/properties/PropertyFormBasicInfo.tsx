import React from 'react';
import { cn } from '../../utils/cn';
import {
  Field,
  FieldError,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from '../../components/ui';
import { Description } from '../../icons';
import { Controller } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import type { PropertyFormValues } from '../../schemas';

// ─── Stable class constants ─────────────────────────────────────────────────

/** Titre de section — echelle « overline » de Baitly UI. */
const SECTION_TITLE_CLASS = 'text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-[9px]';

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
        <p className={SECTION_TITLE_CLASS}>
          {t('properties.tabs.overview')}
        </p>

        <div className="grid grid-cols-12 gap-[9px]">
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
                <div
                  className={cn(
                    'flex gap-1.5 py-[7.5px] px-[9px] rounded-lg bg-field border min-h-[80px] transition-[border-color] duration-150 ease-out',
                    fieldState.error ? 'border-destructive' : 'border-field-line',
                  )}
                >
                  <span className="inline-flex text-muted-foreground mt-0 shrink-0"><Description size={16} strokeWidth={1.75} /></span>
                  <Field className="flex-1">
                    <FieldLabel
                      htmlFor="property-description"
                      className="block text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-0.5"
                    >
                      {t('properties.description')}
                    </FieldLabel>
                    {/* Le champ est deshabille (ni bordure ni fond) : c'est la boite
                        englobante qui porte le cadre. field.ref n'est pas transmis
                        (primitives sans forwardRef, React 18). */}
                    <Textarea
                      id="property-description"
                      name={field.name}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      rows={2}
                      // `min-h-[2lh]` et non `rows` seul : le primitif pose
                      // `field-sizing: content`, qui neutralise `rows` et fait
                      // retomber le champ a une ligne quand il est vide.
                      placeholder={t('properties.descriptionPlaceholder')}
                      aria-invalid={!!fieldState.error}
                      className="min-h-[2lh] max-h-[101px] rounded-none border-0 bg-transparent p-0 text-xs leading-[1.4] text-muted-foreground placeholder:text-xs placeholder:text-faint focus-visible:border-0 focus-visible:ring-0 aria-invalid:ring-0"
                    />
                    {fieldState.error && (
                      <FieldError className="mt-0.5">{fieldState.error.message}</FieldError>
                    )}
                  </Field>
                </div>
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
