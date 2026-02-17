import React from 'react';
import {
  Box,
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

// ─── Stable sx constants ────────────────────────────────────────────────────

const SECTION_TITLE_SX = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'text.secondary',
  mb: 1.5,
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PropertyFormBasicInfoProps {
  control: Control<PropertyFormValues>;
  errors: FieldErrors<PropertyFormValues>;
  propertyTypes: { value: string; label: string }[];
}

// ─── Component ──────────────────────────────────────────────────────────────

const PropertyFormBasicInfo: React.FC<PropertyFormBasicInfoProps> = React.memo(
  ({ control, errors, propertyTypes }) => {
    const { t } = useTranslation();

    return (
      <Box>
        <Typography sx={SECTION_TITLE_SX}>
          {t('properties.tabs.overview')}
        </Typography>

        <Grid container spacing={1.5}>
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
                  <Select {...field} label={t('properties.propertyType')} size="small">
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

          <Grid item xs={12}>
            <Controller
              name="description"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={t('properties.description')}
                  multiline
                  rows={2}
                  placeholder={t('properties.descriptionPlaceholder')}
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

PropertyFormBasicInfo.displayName = 'PropertyFormBasicInfo';

export default PropertyFormBasicInfo;
