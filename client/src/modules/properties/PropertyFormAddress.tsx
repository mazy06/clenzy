import React from 'react';
import {
  Grid,
  Typography,
  TextField,
} from '@mui/material';
import { LocationOn } from '@mui/icons-material';
import { Controller } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import type { PropertyFormValues } from '../../schemas';

export interface PropertyFormAddressProps {
  control: Control<PropertyFormValues>;
  errors: FieldErrors<PropertyFormValues>;
}

const PropertyFormAddress: React.FC<PropertyFormAddressProps> = React.memo(
  ({ control, errors }) => {
    const { t } = useTranslation();

    return (
      <>
        {/* Adresse */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LocationOn sx={{ fontSize: 18 }} />
            {t('properties.address')}
          </Typography>
        </Grid>

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
      </>
    );
  }
);

PropertyFormAddress.displayName = 'PropertyFormAddress';

export default PropertyFormAddress;
