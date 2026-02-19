import React, { useCallback } from 'react';
import {
  Box,
  Grid,
  Typography,
  TextField,
} from '@mui/material';
import { LocationOn } from '@mui/icons-material';
import { Controller } from 'react-hook-form';
import type { Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';
import type { BanAddress } from '../../services/banApi';
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

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PropertyFormAddressProps {
  control: Control<PropertyFormValues>;
  errors: FieldErrors<PropertyFormValues>;
  setValue: UseFormSetValue<PropertyFormValues>;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PropertyFormAddress: React.FC<PropertyFormAddressProps> = React.memo(
  ({ control, errors, setValue }) => {
    const { t } = useTranslation();

    const handleAddressSelect = useCallback(
      (address: BanAddress) => {
        // Construire l'adresse a partir du numero + rue
        const streetAddress = address.housenumber
          ? `${address.housenumber} ${address.street}`
          : address.street || address.label;

        setValue('address', streetAddress, { shouldValidate: true });
        setValue('city', address.city, { shouldValidate: true });
        setValue('postalCode', address.postcode, { shouldValidate: true });
        setValue('latitude', address.latitude);
        setValue('longitude', address.longitude);
        setValue('department', address.department);
        setValue('arrondissement', address.arrondissement || null);
      },
      [setValue]
    );

    return (
      <Box>
        <Typography sx={SECTION_TITLE_SX}>
          <LocationOn sx={{ fontSize: 14 }} />
          {t('properties.address')}
        </Typography>

        <Grid container spacing={1.5}>
          <Grid item xs={12}>
            <Controller
              name="address"
              control={control}
              render={({ field, fieldState }) => (
                <AddressAutocomplete
                  value={field.value || ''}
                  onSelect={handleAddressSelect}
                  onChange={(val) => field.onChange(val)}
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

          <Grid item xs={12} md={4}>
            <Controller
              name="city"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={t('properties.city')}
                  required
                  placeholder={t('properties.cityPlaceholder')}
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={4}>
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

          <Grid item xs={12} md={4}>
            <Controller
              name="country"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={t('properties.country')}
                  required
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Grid>
        </Grid>
      </Box>
    );
  }
);

PropertyFormAddress.displayName = 'PropertyFormAddress';

export default PropertyFormAddress;
