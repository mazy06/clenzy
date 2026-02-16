import React from 'react';
import {
  Grid,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@mui/material';
import { Controller } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import type { PropertyFormValues } from '../../schemas';

export interface PropertyFormBasicInfoProps {
  control: Control<PropertyFormValues>;
  errors: FieldErrors<PropertyFormValues>;
  propertyTypes: { value: string; label: string }[];
}

const PropertyFormBasicInfo: React.FC<PropertyFormBasicInfoProps> = React.memo(
  ({ control, errors, propertyTypes }) => {
    const { t } = useTranslation();

    return (
      <>
        {/* Informations de base */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
            {t('properties.tabs.overview')}
          </Typography>
        </Grid>

        <Grid item xs={12} md={8}>
          <Controller
            name="name"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                fullWidth
                label={t('properties.propertyName')}
                required
                placeholder={t('properties.propertyNamePlaceholder')}
                size="small"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <Controller
            name="type"
            control={control}
            render={({ field, fieldState }) => (
              <FormControl fullWidth required error={!!fieldState.error}>
                <InputLabel>{t('properties.propertyType')}</InputLabel>
                <Select
                  {...field}
                  label={t('properties.propertyType')}
                  size="small"
                >
                  {propertyTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
                {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
              </FormControl>
            )}
          />
        </Grid>
      </>
    );
  }
);

PropertyFormBasicInfo.displayName = 'PropertyFormBasicInfo';

export default PropertyFormBasicInfo;
