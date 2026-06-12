import React, { useCallback } from 'react';
import {
  Box,
  Grid,
  Typography,
  TextField,
  MenuItem,
} from '@mui/material';
import { LocationOn } from '../../icons';
import { Controller, useWatch } from 'react-hook-form';
import type { Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';
import { CityAutocomplete } from '../../components/CityAutocomplete';
import { PropertyLocationPicker } from '../../components/PropertyLocationPicker';
import type { GeocodedAddress } from '../../services/geocoderApi';
import { COUNTRIES, COUNTRY_BY_CODE } from '../../constants/countries';
import type { PropertyFormValues } from '../../schemas';

// ─── Stable sx constants ────────────────────────────────────────────────────

const SECTION_TITLE_SX = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'text.secondary',
  mb: 1.5,
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
} as const;

// Fuseaux pertinents pour les marchés Clenzy (Europe + Maghreb + DOM-TOM). La
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
      <Box>
        <Typography sx={SECTION_TITLE_SX}>
          <LocationOn size={14} strokeWidth={1.75} />
          {t('properties.address')}
        </Typography>

        <Grid container spacing={1.5}>
          {/* Pays en premier — driver de l'autocomplete */}
          <Grid item xs={12} md={4}>
            <Controller
              name="countryCode"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  select
                  fullWidth
                  label={t('properties.country')}
                  required
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
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
                    <MenuItem key={c.code} value={c.code}>
                      <span style={{ marginRight: 8 }}>{c.flag}</span>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>

          <Grid item xs={12} md={8}>
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
          </Grid>

          <Grid item xs={12} md={6}>
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
          </Grid>

          <Grid item xs={12} md={6}>
            <Controller
              name="postalCode"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={t('properties.postalCode')}
                  required
                  placeholder={t('properties.postalCodePlaceholder')}
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Controller
              name="timezone"
              control={control}
              render={({ field, fieldState }) => {
                const opts = field.value && !TIMEZONES.includes(field.value)
                  ? [field.value, ...TIMEZONES]
                  : TIMEZONES;
                return (
                  <TextField
                    {...field}
                    value={field.value || 'Europe/Paris'}
                    select
                    fullWidth
                    size="small"
                    label={t('properties.timezone', 'Fuseau horaire')}
                    helperText={t('properties.timezoneHelp', "Heure locale du logement (codes d'accès, planning)")}
                    error={!!fieldState.error}
                  >
                    {opts.map((tz) => (
                      <MenuItem key={tz} value={tz}>{tz}</MenuItem>
                    ))}
                  </TextField>
                );
              }}
            />
          </Grid>

          {/* ─── Position GPS sur la carte ────────────────────────────── */}
          <Grid item xs={12}>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'text.secondary',
                mt: 0.5,
                mb: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <LocationOn size={14} strokeWidth={1.75} />
              Position GPS
              {latitude != null && longitude != null && (
                <Box
                  component="span"
                  sx={{
                    ml: 0.5,
                    px: 0.75,
                    py: 0.1,
                    borderRadius: 999,
                    bgcolor: 'var(--ok-soft)',
                    color: 'var(--ok)',
                    fontSize: '9.5px',
                    fontWeight: 700,
                  }}
                >
                  ✓ DÉFINIE
                </Box>
              )}
            </Typography>
            <PropertyLocationPicker
              latitude={latitude}
              longitude={longitude}
              onChange={handleMapChange}
              height={260}
              helperText="Aucune coordonnée GPS n'a été trouvée. Cliquez sur la carte ou faites glisser le pin pour positionner manuellement le logement."
            />
          </Grid>
        </Grid>
      </Box>
    );
  }
);

PropertyFormAddress.displayName = 'PropertyFormAddress';

export default PropertyFormAddress;
