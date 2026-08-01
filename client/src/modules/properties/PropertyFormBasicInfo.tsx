import React from 'react';
import { cn } from '../../utils/cn';
import { Grid, Typography, TextField, FormControl, InputLabel, Select, MenuItem, FormHelperText } from '@mui/material';
import { Description } from '../../icons';
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
      <div>
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
                <div className={cn('flex gap-1.5 py-[7.5px] px-[9px] rounded-[11px] bg-[var(--field)] border border-solid min-h-[80px]', fieldState.error ? 'border-[var(--err)]' : 'border-[var(--field-line)]')} style={{ transition: 'border-color 0.15s ease' }}>
                  <span className="inline-flex text-muted-foreground opacity-60 mt-0 shrink-0"><Description size={16} strokeWidth={1.75} /></span>
                  <div className="flex-1">
                    <p className="cn-text-body1 text-[0.625rem] font-bold uppercase tracking-[0.05em] text-muted-foreground opacity-60 mb-0.5">
                      {t('properties.description')}
                    </p>
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
                  </div>
                </div>
              )}
            />
          </Grid>
        </Grid>
      </div>
    );
  }
);

PropertyFormBasicInfo.displayName = 'PropertyFormBasicInfo';

export default PropertyFormBasicInfo;
