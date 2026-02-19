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
import { Description } from '@mui/icons-material';
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
                <Box sx={{
                  display: 'flex',
                  gap: 1,
                  py: 1.25,
                  px: 1.5,
                  borderRadius: 1.5,
                  bgcolor: 'grey.50',
                  border: '1px solid',
                  borderColor: fieldState.error ? 'error.main' : 'grey.200',
                  minHeight: 80,
                  transition: 'border-color 0.15s ease',
                }}>
                  <Description sx={{ fontSize: 16, color: 'text.disabled', mt: 0.125, flexShrink: 0 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.disabled', mb: 0.5 }}>
                      {t('properties.description')}
                    </Typography>
                    <TextField
                      {...field}
                      value={field.value ?? ''}
                      fullWidth
                      multiline
                      minRows={2}
                      maxRows={6}
                      placeholder={t('properties.descriptionPlaceholder')}
                      size="small"
                      variant="standard"
                      InputProps={{ disableUnderline: true }}
                      sx={{
                        '& .MuiInputBase-root': { fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.4, p: 0 },
                        '& .MuiInputBase-input::placeholder': { fontSize: '0.75rem', color: 'text.disabled' },
                      }}
                    />
                    {fieldState.error && (
                      <FormHelperText error sx={{ mx: 0, mt: 0.5 }}>{fieldState.error.message}</FormHelperText>
                    )}
                  </Box>
                </Box>
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
