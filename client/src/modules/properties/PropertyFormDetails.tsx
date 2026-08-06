import React, { useCallback } from 'react';
import {
  Field,
  FieldError,
  FieldLabel,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '../../components/ui';
import { Checkbox } from '../../components/ui';
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

// ─── Stable class constants ─────────────────────────────────────────────────

/** Titre de section — echelle « overline » de Baitly UI. */
const SECTION_TITLE_CLASS = 'text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-[9px]';

/** Titre de categorie d'equipements. */
const CATEGORY_TITLE_CLASS = 'text-xs font-semibold text-foreground mb-[4.5px]';

/** Libelle de case a cocher — poids normal, contraste plein. */
const CHECKBOX_LABEL_CLASS = 'text-[0.8125rem] font-normal';

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
        <p className={SECTION_TITLE_CLASS}>
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
          <p className={SECTION_TITLE_CLASS}>
            {t('properties.amenities.title')}
          </p>

          <Controller
            name="amenities"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-3">
                {AMENITIES_CATEGORIES.map((category) => (
                  <div key={category.key}>
                    <p className={CATEGORY_TITLE_CLASS}>
                      {t(`properties.amenities.categories.${category.key}`)}
                    </p>
                    <div className="grid grid-cols-12 gap-[3px]">
                      {category.items.map((amenity) => {
                        const checked = field.value?.includes(amenity) || false;
                        return (
                          <div className="col-span-6 min-[900px]:col-span-4" key={amenity}>
                            <Field orientation="horizontal">
                              <Checkbox
                                id={`property-amenity-${amenity}`}
                                checked={checked}
                                onCheckedChange={(next) => {
                                  const newValue = next === true
                                    ? [...(field.value || []), amenity]
                                    : (field.value || []).filter((v: string) => v !== amenity);
                                  field.onChange(newValue);
                                }}
                              />
                              <FieldLabel
                                htmlFor={`property-amenity-${amenity}`}
                                className={CHECKBOX_LABEL_CLASS}
                              >
                                {t(`properties.amenities.items.${amenity}`)}
                              </FieldLabel>
                            </Field>
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
