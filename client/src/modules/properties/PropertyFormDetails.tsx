import React, { useCallback } from 'react';
import { cn } from '../../utils/cn';
import {
  Field,
  FieldError,
  FieldLabel,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '../../components/ui';
import { Checkbox, FormControlLabel } from '@mui/material';
import {
  Euro,
  Bed,
  Bathroom,
  SquareFoot,
  Group,
  NightsStay,
} from '../../icons';
import { Controller } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import type { PropertyFormValues } from '../../schemas';

// ─── Stable sx constants ────────────────────────────────────────────────────

const SECTION_TITLE_SX = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'text.secondary',
  mb: 1.5,
} as const;

/** Report en classes de `SECTION_TITLE_SX`. */
const SECTION_TITLE_CLASS = 'text-[0.6875rem] font-bold uppercase tracking-[0.05em] text-[var(--muted)] mb-[9px]';

const CATEGORY_TITLE_SX = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'text.primary',
  mb: 0.75,
} as const;

/** Report en classes de `CATEGORY_TITLE_SX`. */
const CATEGORY_TITLE_CLASS = 'text-[0.75rem] font-semibold text-[var(--ink)] mb-[4.5px]';

const CHECKBOX_LABEL_SX = {
  fontSize: '0.8125rem',
} as const;

/** Report en classes de `CHECKBOX_LABEL_SX`. */
const CHECKBOX_LABEL_CLASS = 'text-[0.8125rem]';

// ─── Amenities configuration ────────────────────────────────────────────────

const AMENITIES_CATEGORIES = [
  { key: 'comfort', items: ['WIFI', 'TV', 'AIR_CONDITIONING', 'HEATING'] },
  { key: 'kitchen', items: ['EQUIPPED_KITCHEN', 'DISHWASHER', 'MICROWAVE', 'OVEN'] },
  { key: 'appliances', items: ['WASHING_MACHINE', 'DRYER', 'IRON', 'HAIR_DRYER'] },
  { key: 'outdoor', items: ['PARKING', 'POOL', 'JACUZZI', 'GARDEN_TERRACE', 'BARBECUE'] },
  { key: 'safetyFamily', items: ['SAFE', 'BABY_BED', 'HIGH_CHAIR'] },
] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PropertyFormDetailsProps {
  control: Control<PropertyFormValues>;
  errors: FieldErrors<PropertyFormValues>;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PropertyFormDetails: React.FC<PropertyFormDetailsProps> = React.memo(
  ({ control, errors }) => {
    const { t } = useTranslation();

    return (
      <div>
        <p className={cn(SECTION_TITLE_CLASS, 'cn-text-body1')}>
          {t('properties.characteristics')}
        </p>

        <div className="grid grid-cols-12 gap-[9px]">
          <div className="col-span-6 min-[900px]:col-span-4">
            <Controller
              name="bedroomCount"
              control={control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="property-bedroom-count">{t('properties.bedroomCount')}</FieldLabel>
                  {/* field.ref n'est pas transmis : les primitives du kit sont des
                      composants fonction sans forwardRef (React 18), le passer
                      declencherait un avertissement sans jamais s'attacher. */}
                  <InputGroup>
                    <InputGroupAddon>
                      <Bed size={16} strokeWidth={1.75} />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="property-bedroom-count"
                      type="number"
                      name={field.name}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      onBlur={field.onBlur}
                      required
                      aria-invalid={!!fieldState.error}
                    />
                  </InputGroup>
                  {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />
          </div>

          <div className="col-span-6 min-[900px]:col-span-4">
            <Controller
              name="bathroomCount"
              control={control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="property-bathroom-count">{t('properties.bathroomCount')}</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <Bathroom size={16} strokeWidth={1.75} />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="property-bathroom-count"
                      type="number"
                      name={field.name}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      onBlur={field.onBlur}
                      required
                      aria-invalid={!!fieldState.error}
                    />
                  </InputGroup>
                  {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />
          </div>

          <div className="col-span-6 min-[900px]:col-span-4">
            <Controller
              name="squareMeters"
              control={control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="property-square-meters">{t('properties.surface')}</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <SquareFoot size={16} strokeWidth={1.75} />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="property-square-meters"
                      type="number"
                      name={field.name}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      onBlur={field.onBlur}
                      required
                      aria-invalid={!!fieldState.error}
                    />
                  </InputGroup>
                  {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />
          </div>

          <div className="col-span-6 min-[900px]:col-span-6">
            <Controller
              name="maxGuests"
              control={control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="property-max-guests">{t('properties.maxGuests')}</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <Group size={16} strokeWidth={1.75} />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="property-max-guests"
                      type="number"
                      name={field.name}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      onBlur={field.onBlur}
                      required
                      aria-invalid={!!fieldState.error}
                    />
                  </InputGroup>
                  {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />
          </div>

          <div className="col-span-12 min-[900px]:col-span-6">
            <Controller
              name="nightlyPrice"
              control={control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="property-nightly-price">{t('properties.nightlyPriceField')}</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <Euro size={16} strokeWidth={1.75} />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="property-nightly-price"
                      type="number"
                      step="0.01"
                      min="0"
                      name={field.name}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      onBlur={field.onBlur}
                      placeholder={t('properties.nightlyPricePlaceholder')}
                      aria-invalid={!!fieldState.error}
                    />
                  </InputGroup>
                  {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />
          </div>

          <div className="col-span-12 min-[900px]:col-span-6">
            <Controller
              name="minimumNights"
              control={control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="property-minimum-nights">Nuitées minimum</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <NightsStay size={16} strokeWidth={1.75} />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="property-minimum-nights"
                      type="number"
                      step="1"
                      min="1"
                      name={field.name}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      onBlur={field.onBlur}
                      placeholder="1"
                      aria-invalid={!!fieldState.error}
                    />
                  </InputGroup>
                  {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />
          </div>
        </div>

        {/* ─── Amenities Section ─────────────────────────────────────────── */}
        <div className="mt-4">
          <p className={cn(SECTION_TITLE_CLASS, 'cn-text-body1')}>
            {t('properties.amenities.title')}
          </p>

          <Controller
            name="amenities"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-3">
                {AMENITIES_CATEGORIES.map((category) => (
                  <div key={category.key}>
                    <p className={cn(CATEGORY_TITLE_CLASS, 'cn-text-body1')}>
                      {t(`properties.amenities.categories.${category.key}`)}
                    </p>
                    <div className="grid grid-cols-12 gap-[3px]">
                      {category.items.map((amenity) => {
                        const checked = field.value?.includes(amenity) || false;
                        return (
                          <div className="col-span-6 min-[900px]:col-span-4" key={amenity}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={checked}
                                  onChange={(e) => {
                                    const newValue = e.target.checked
                                      ? [...(field.value || []), amenity]
                                      : (field.value || []).filter((v: string) => v !== amenity);
                                    field.onChange(newValue);
                                  }}
                                  size="small"
                                />
                              }
                              label={
                                <p className={cn(CHECKBOX_LABEL_CLASS, 'cn-text-body1')}>
                                  {t(`properties.amenities.items.${amenity}`)}
                                </p>
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          />
        </div>
      </div>
    );
  }
);

PropertyFormDetails.displayName = 'PropertyFormDetails';

export default PropertyFormDetails;
