import React, { useCallback } from 'react';
import { cn } from '../../utils/cn';
import {
  Badge,
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  Input,
  NativeSelect,
  NativeSelectOption,
} from '../../components/ui';
import { Check, LocationOn } from '../../icons';
import { Controller, useWatch } from 'react-hook-form';
import type { Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';
import { CityAutocomplete } from '../../components/CityAutocomplete';
import { PropertyLocationPicker } from '../../components/PropertyLocationPicker';
import type { GeocodedAddress } from '../../services/geocoderApi';
import { COUNTRIES, COUNTRY_BY_CODE } from '../../constants/countries';
import type { PropertyFormValues } from '../../schemas';

// ─── Stable class constants ─────────────────────────────────────────────────

/** Titre de section (icone + texte) — echelle « overline » de Baitly UI. */
const SECTION_TITLE_CLASS = 'text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-[9px] flex items-center gap-[3px]';

// Fuseaux pertinents pour les marchés Baitly (Europe + Maghreb + DOM-TOM). La
// valeur courante est prepended si absente (édition d'un logement au fuseau exotique).
const TIMEZONES = [
  'Europe/Paris', 'Europe/London', 'Europe/Madrid', 'Europe/Lisbon', 'Europe/Brussels',
  'Europe/Amsterdam', 'Europe/Berlin', 'Europe/Rome', 'Europe/Zurich', 'Europe/Athens',
  'Europe/Istanbul', 'Atlantic/Canary', 'Africa/Casablanca', 'Africa/Tunis', 'Africa/Algiers',
  'Africa/Cairo', 'Asia/Dubai', 'America/New_York', 'America/Los_Angeles', 'America/Montreal',
  'America/Guadeloupe', 'America/Martinique', 'America/Cayenne', 'Indian/Reunion', 'Indian/Mauritius',
  'Pacific/Noumea', 'Pacific/Tahiti',
];

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PropertyFormAddressProps {
  control: Control<PropertyFormValues>;
  errors: FieldErrors<PropertyFormValues>;
  setValue: UseFormSetValue<PropertyFormValues>;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PropertyFormAddress: React.FC<PropertyFormAddressProps> = React.memo(
  ({ control, errors: _errors, setValue }) => {
    const { t } = useTranslation();

    // Reactive country code drives the geocoder used by AddressAutocomplete
    const countryCode = useWatch({ control, name: 'countryCode' }) || 'FR';
    // Coordonnées GPS surveillées en live pour le picker sur la carte
    const latitude = useWatch({ control, name: 'latitude' });
    const longitude = useWatch({ control, name: 'longitude' });

    const handleMapChange = useCallback(
      (lat: number, lng: number) => {
        setValue('latitude', lat, { shouldDirty: true });
        setValue('longitude', lng, { shouldDirty: true });
      },
      [setValue],
    );

    const handleAddressSelect = useCallback(
      (address: GeocodedAddress) => {
        const streetAddress = address.housenumber
          ? `${address.housenumber} ${address.street}`
          : address.street || address.label;

        setValue('address', streetAddress, { shouldValidate: true });
        setValue('city', address.city, { shouldValidate: true });
        setValue('postalCode', address.postcode, { shouldValidate: true });
        setValue('latitude', address.latitude);
        setValue('longitude', address.longitude);
        // FR-specific (vide pour autres pays — c'est OK, ils sont nullable)
        setValue('department', address.department || null);
        setValue('arrondissement', address.arrondissement || null);
        // Re-aligner le pays / code pays si Nominatim retourne autre chose
        if (address.countryCode && address.countryCode !== countryCode) {
          const c = COUNTRY_BY_CODE[address.countryCode];
          if (c) {
            setValue('country', c.name, { shouldValidate: true });
            setValue('countryCode', c.code, { shouldValidate: true });
          }
        }
      },
      [setValue, countryCode]
    );

    return (
      <div>
        <p className={SECTION_TITLE_CLASS}>
          <LocationOn size={14} strokeWidth={1.75} />
          {t('properties.address')}
        </p>

        <div className="grid grid-cols-12 gap-[9px]">
          {/* Pays en premier — driver de l'autocomplete */}
          <div className="col-span-12 min-[900px]:col-span-4">
            <Controller
              name="countryCode"
              control={control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="property-country-code">{t('properties.country')}</FieldLabel>
                  {/* field.ref n'est pas transmis : les primitives du kit sont des
                      composants fonction sans forwardRef (React 18), le passer
                      declencherait un avertissement sans jamais s'attacher. */}
                  <NativeSelect
                    id="property-country-code"
                    className="w-full"
                    name={field.name}
                    value={field.value}
                    onBlur={field.onBlur}
                    required
                    aria-invalid={!!fieldState.error}
                    onChange={(e) => {
                      const code = e.target.value;
                      if (code === field.value) return;
                      field.onChange(code);
                      const c = COUNTRY_BY_CODE[code];
                      if (c) {
                        setValue('country', c.name, { shouldValidate: true });
                      }
                      // Reset des champs dependants : adresse / ville / CP / GPS / departement / arrondissement
                      setValue('address', '', { shouldValidate: true });
                      setValue('city', '', { shouldValidate: true });
                      setValue('postalCode', '', { shouldValidate: true });
                      setValue('latitude', null);
                      setValue('longitude', null);
                      setValue('department', null);
                      setValue('arrondissement', null);
                    }}
                  >
                    {COUNTRIES.map((c) => (
                      <NativeSelectOption key={c.code} value={c.code}>
                        {c.flag} {c.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {fieldState.error?.message && (
                    <FieldError>{fieldState.error.message}</FieldError>
                  )}
                </Field>
              )}
            />
          </div>

          <div className="col-span-12 min-[900px]:col-span-8">
            <Controller
              name="address"
              control={control}
              render={({ field, fieldState }) => (
                <AddressAutocomplete
                  value={field.value || ''}
                  onSelect={handleAddressSelect}
                  onChange={(val) => field.onChange(val)}
                  countryCode={countryCode}
                  label={t('properties.fullAddress')}
                  placeholder={t('properties.addressAutocomplete') || t('properties.fullAddressPlaceholder')}
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  size="small"
                />
              )}
            />
          </div>

          <div className="col-span-12 min-[900px]:col-span-6">
            <Controller
              name="city"
              control={control}
              render={({ field, fieldState }) => (
                <CityAutocomplete
                  value={field.value || ''}
                  onSelect={(city) => {
                    setValue('city', city.city || city.label, { shouldValidate: true });
                    if (city.postcode) {
                      setValue('postalCode', city.postcode, { shouldValidate: true });
                    }
                    if (city.latitude && city.longitude) {
                      setValue('latitude', city.latitude);
                      setValue('longitude', city.longitude);
                    }
                    setValue('department', city.department || null);
                    setValue('arrondissement', city.arrondissement || null);
                  }}
                  onChange={(val) => field.onChange(val)}
                  countryCode={countryCode}
                  label={t('properties.city')}
                  required
                  placeholder={t('properties.cityPlaceholder')}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  size="small"
                />
              )}
            />
          </div>

          <div className="col-span-12 min-[900px]:col-span-6">
            <Controller
              name="postalCode"
              control={control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="property-postal-code">{t('properties.postalCode')}</FieldLabel>
                  <Input
                    id="property-postal-code"
                    name={field.name}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    required
                    placeholder={t('properties.postalCodePlaceholder')}
                    aria-invalid={!!fieldState.error}
                  />
                  {fieldState.error?.message && (
                    <FieldError>{fieldState.error.message}</FieldError>
                  )}
                </Field>
              )}
            />
          </div>

          <div className="col-span-12 min-[900px]:col-span-6">
            <Controller
              name="timezone"
              control={control}
              render={({ field, fieldState }) => {
                const opts = field.value && !TIMEZONES.includes(field.value)
                  ? [field.value, ...TIMEZONES]
                  : TIMEZONES;
                return (
                  <Field>
                    <FieldLabel htmlFor="property-timezone">
                      {t('properties.timezone', 'Fuseau horaire')}
                    </FieldLabel>
                    <NativeSelect
                      id="property-timezone"
                      className="w-full"
                      name={field.name}
                      value={field.value || 'Europe/Paris'}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      aria-invalid={!!fieldState.error}
                    >
                      {opts.map((tz) => (
                        <NativeSelectOption key={tz} value={tz}>{tz}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <FieldDescription>
                      {t('properties.timezoneHelp', "Heure locale du logement (codes d'accès, planning)")}
                    </FieldDescription>
                  </Field>
                );
              }}
            />
          </div>

          {/* ─── Position GPS sur la carte ────────────────────────────── */}
          <div className="col-span-12">
            <p className={cn(SECTION_TITLE_CLASS, 'mt-0.5 mb-1.5')}>
              <LocationOn size={14} strokeWidth={1.75} />
              Position GPS
              {latitude != null && longitude != null && (
                <Badge variant="success" className="ms-0.5 gap-0.5 rounded-full px-1 text-2xs font-semibold">
                  <Check size={10} strokeWidth={2.5} />
                  DÉFINIE
                </Badge>
              )}
            </p>
            <PropertyLocationPicker
              latitude={latitude}
              longitude={longitude}
              onChange={handleMapChange}
              height={260}
              helperText="Aucune coordonnée GPS n'a été trouvée. Cliquez sur la carte ou faites glisser le pin pour positionner manuellement le logement."
            />
          </div>
        </div>
      </div>
    );
  }
);

PropertyFormAddress.displayName = 'PropertyFormAddress';

export default PropertyFormAddress;
