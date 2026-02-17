import React from 'react';
import {
  Box,
  Grid,
  Typography,
  TextField,
} from '@mui/material';
import { LocationOn } from '@mui/icons-material';
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
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PropertyFormAddressProps {
  control: Control<PropertyFormValues>;
  errors: FieldErrors<PropertyFormValues>;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PropertyFormAddress: React.FC<PropertyFormAddressProps> = React.memo(
  ({ control, errors }) => {
    const { t } = useTranslation();

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
                <TextField
                  {...field}
                  fullWidth
                  label={t('properties.fullAddress')}
                  required
                  placeholder={t('properties.fullAddressPlaceholder')}
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
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
