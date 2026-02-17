import React, { useCallback } from 'react';
import {
  Box,
  Grid,
  Typography,
  TextField,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Euro,
  Bed,
  Bathroom,
  SquareFoot,
  Group,
} from '@mui/icons-material';
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

const CATEGORY_TITLE_SX = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'text.primary',
  mb: 0.75,
} as const;

const CHECKBOX_LABEL_SX = {
  fontSize: '0.8125rem',
} as const;

// ─── Amenities configuration ────────────────────────────────────────────────

const AMENITIES_CATEGORIES = [
  { key: 'comfort', items: ['WIFI', 'TV', 'AIR_CONDITIONING', 'HEATING'] },
  { key: 'kitchen', items: ['EQUIPPED_KITCHEN', 'DISHWASHER', 'MICROWAVE', 'OVEN'] },
  { key: 'appliances', items: ['WASHING_MACHINE', 'DRYER', 'IRON', 'HAIR_DRYER'] },
  { key: 'outdoor', items: ['PARKING', 'POOL', 'JACUZZI', 'GARDEN_TERRACE', 'BARBECUE'] },
  { key: 'safetyFamily', items: ['SAFE', 'BABY_BED', 'HIGH_CHAIR'] },
] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PropertyFormDetailsProps {
  control: Control<PropertyFormValues>;
  errors: FieldErrors<PropertyFormValues>;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PropertyFormDetails: React.FC<PropertyFormDetailsProps> = React.memo(
  ({ control, errors }) => {
    const { t } = useTranslation();

    return (
      <Box>
        <Typography sx={SECTION_TITLE_SX}>
          {t('properties.characteristics')}
        </Typography>

        <Grid container spacing={1.5}>
          <Grid item xs={6} md={4}>
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
                    startAdornment: <Bed sx={{ mr: 0.75, color: 'text.secondary', fontSize: 16 }} />,
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={6} md={4}>
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
                    startAdornment: <Bathroom sx={{ mr: 0.75, color: 'text.secondary', fontSize: 16 }} />,
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={6} md={4}>
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
                    startAdornment: <SquareFoot sx={{ mr: 0.75, color: 'text.secondary', fontSize: 16 }} />,
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={6} md={6}>
            <Controller
              name="maxGuests"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  type="number"
                  label={t('properties.maxGuests')}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  required
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  InputProps={{
                    startAdornment: <Group sx={{ mr: 0.75, color: 'text.secondary', fontSize: 16 }} />,
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={6}>
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
                    startAdornment: <Euro sx={{ mr: 0.75, color: 'text.secondary', fontSize: 16 }} />,
                  }}
                  placeholder={t('properties.nightlyPricePlaceholder')}
                  inputProps={{ step: '0.01', min: '0' }}
                />
              )}
            />
          </Grid>
        </Grid>

        {/* ─── Amenities Section ─────────────────────────────────────────── */}
        <Box sx={{ mt: 3 }}>
          <Typography sx={SECTION_TITLE_SX}>
            {t('properties.amenities.title')}
          </Typography>

          <Controller
            name="amenities"
            control={control}
            render={({ field }) => (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {AMENITIES_CATEGORIES.map((category) => (
                  <Box key={category.key}>
                    <Typography sx={CATEGORY_TITLE_SX}>
                      {t(`properties.amenities.categories.${category.key}`)}
                    </Typography>
                    <Grid container spacing={0.5}>
                      {category.items.map((amenity) => {
                        const checked = field.value?.includes(amenity) || false;
                        return (
                          <Grid item xs={6} md={4} key={amenity}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={checked}
                                  onChange={(e) => {
                                    const newValue = e.target.checked
                                      ? [...(field.value || []), amenity]
                                      : (field.value || []).filter((v: string) => v !== amenity);
                                    field.onChange(newValue);
                                  }}
                                  size="small"
                                />
                              }
                              label={
                                <Typography sx={CHECKBOX_LABEL_SX}>
                                  {t(`properties.amenities.items.${amenity}`)}
                                </Typography>
                              }
                            />
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Box>
                ))}
              </Box>
            )}
          />
        </Box>
      </Box>
    );
  }
);

PropertyFormDetails.displayName = 'PropertyFormDetails';

export default PropertyFormDetails;
