import React from 'react';
import {
  Grid,
  Typography,
  TextField,
} from '@mui/material';
import {
  Euro,
  Bed,
  Bathroom,
  SquareFoot,
} from '@mui/icons-material';
import { Controller } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import type { PropertyFormValues } from '../../schemas';

export interface PropertyFormDetailsProps {
  control: Control<PropertyFormValues>;
  errors: FieldErrors<PropertyFormValues>;
}

const PropertyFormDetails: React.FC<PropertyFormDetailsProps> = React.memo(
  ({ control, errors }) => {
    const { t } = useTranslation();

    return (
      <>
        {/* Caractéristiques */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
            {t('properties.characteristics')}
          </Typography>
        </Grid>

        <Grid item xs={12} md={3}>
          <Controller
            name="bedroomCount"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                fullWidth
                type="number"
                label={t('properties.bedroomCount')}
                onChange={(e) => field.onChange(Number(e.target.value))}
                required
                size="small"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                InputProps={{
                  startAdornment: <Bed sx={{ mr: 0.75, color: 'text.secondary', fontSize: 18 }} />,
                }}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={3}>
          <Controller
            name="bathroomCount"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                fullWidth
                type="number"
                label={t('properties.bathroomCount')}
                onChange={(e) => field.onChange(Number(e.target.value))}
                required
                size="small"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                InputProps={{
                  startAdornment: <Bathroom sx={{ mr: 0.75, color: 'text.secondary', fontSize: 18 }} />,
                }}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={3}>
          <Controller
            name="squareMeters"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                fullWidth
                type="number"
                label={t('properties.surface')}
                onChange={(e) => field.onChange(Number(e.target.value))}
                required
                size="small"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                InputProps={{
                  startAdornment: <SquareFoot sx={{ mr: 0.75, color: 'text.secondary', fontSize: 18 }} />,
                }}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={3}>
          <Controller
            name="nightlyPrice"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                fullWidth
                type="number"
                label={t('properties.nightlyPriceField')}
                onChange={(e) => field.onChange(Number(e.target.value))}
                size="small"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                InputProps={{
                  startAdornment: <Euro sx={{ mr: 0.75, color: 'text.secondary', fontSize: 18 }} />,
                }}
                placeholder={t('properties.nightlyPricePlaceholder')}
                inputProps={{
                  step: "0.01",
                  min: "0"
                }}
              />
            )}
          />
        </Grid>
      </>
    );
  }
);

PropertyFormDetails.displayName = 'PropertyFormDetails';

export default PropertyFormDetails;
