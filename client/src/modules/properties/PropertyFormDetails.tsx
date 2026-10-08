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
import { useAuth } from '../../hooks/useAuth';
import { resolveAmenityIcon } from '../settings/amenity-mapping/amenityIcons';
import { useAmenityIconOverrides } from '../settings/amenity-mapping/useAmenityIconOverrides';
import { AMENITY_CATEGORIES, amenityTone } from './amenityCategories';
import type { PropertyFormValues } from '../../schemas';

// ─── Stable class constants ─────────────────────────────────────────────────

/** Titre de categorie d'equipements. */
const CATEGORY_TITLE_CLASS = 'm-0 mb-1.5 text-xs font-semibold text-foreground';

/** Libelle de case a cocher — poids normal, contraste plein. */
const CHECKBOX_LABEL_CLASS = 'flex items-center gap-1.5 text-[0.8125rem] font-normal';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PropertyFormDetailsProps {
  control: Control<PropertyFormValues>;
  errors: FieldErrors<PropertyFormValues>;
  /** Bloc rendu : capacité et tarif, ou équipements — deux sections distinctes de PropertyForm. */
  part: 'characteristics' | 'amenities';
}

// ─── Équipements ────────────────────────────────────────────────────────────

/** Icône d'une commodité, prise dans la bibliothèque (Paramètres › Commodités), à la couleur de sa famille. */
function AmenityIcon({ code, overrides }: { code: string; overrides: Record<string, string> }) {
  const Icon = resolveAmenityIcon(code, overrides);
  return <Icon size={15} strokeWidth={1.75} aria-hidden="true" className="shrink-0" style={{ color: amenityTone(code).ink }} />;
}

/**
 * Cases à cocher des équipements, chacune précédée de son icône : la même que
 * sur la fiche et sur l'écran de mapping OTA (choix de l'organisation, sinon
 * icône Baitly par défaut). Les icônes ne sont chargées que pour cette section.
 */
function AmenityFields({ control }: { control: Control<PropertyFormValues> }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { overrides } = useAmenityIconOverrides(user?.organizationId ?? null);
  return (
    <Controller
      name="amenities"
      control={control}
      render={({ field }) => (
        <div className="flex flex-col gap-3">
          {AMENITY_CATEGORIES.map((category) => (
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
                          <AmenityIcon code={amenity} overrides={overrides} />
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
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

const PropertyFormDetails: React.FC<PropertyFormDetailsProps> = React.memo(
  ({ control, errors, part }) => {
    const { t } = useTranslation();

    // Les titres de section sont posés par PropertyForm (en-têtes illustrés).
    return (
      <div>
        {part === 'characteristics' && (
        <div className="grid grid-cols-12 gap-3">
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
                  <FieldLabel htmlFor="property-minimum-nights">{t('properties.form.minimumNights')}</FieldLabel>
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
        )}

        {part === 'amenities' && <AmenityFields control={control} />}
      </div>
    );
  }
);

PropertyFormDetails.displayName = 'PropertyFormDetails';

export default PropertyFormDetails;
